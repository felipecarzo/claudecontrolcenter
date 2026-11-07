#!/usr/bin/env python3
"""Servidor de traducao do app Tradutor (dev.lfs.tradutor), hospedado na VPS.

Adaptado do tradutor.py que rodava no proot do celular (CC-1078). Diferencas:
  - SO TEXTO: /audio responde 501 (a VPS nao tem whisper e esta carregada).
  - Ouve so em 127.0.0.1. Quem abre para a internet e uma regra de nginx (root).
  - TETO de traducoes por hora (padrao 300) -> 429 {"erro":"limite"}, e um interruptor
    (arquivo ~/.config/agent-cockpit/tradutor-desligado) -> 503. Cada traducao gasta o
    plano dele (Haiku), por isso o teto existe.
  - NENHUM conteudo de mensagem e gravado: o log so tem rota e tempo; /log guarda so o tamanho.
  - O `claude` filho roda com --setting-sources local: nao carrega os ganchos do usuario
    (conferente, guias, caixa de ponto), que dispararam a cada traducao.
  - Aceita o prefixo /tradutor/ (se o nginx nao o remover).

Um processo `claude` sempre aberto (stream-json): `claude -p` avulso leva ~10 s so para subir; vivo,
cada traducao sai em ~2 s. Ele e reciclado a cada RECICLAR pedidos para o contexto nao crescer.

SEGURANCA: todo pedido, menos GET /saude, exige Bearer token (~/.tradutor-token, 600).

Rotas (JSON):
  GET  /saude                         -> {"ok":true}
  GET  /uso                (Bearer)   -> {"ultima_hora":N,"teto":M}
  POST /traduzir  {"texto","para"}    -> {"traducao"}
  POST /log       {"texto"}           -> {"ok":true}  (so o tamanho vai para o log)
  POST /idioma    {"texto"}           -> {"lang"}  local/instantaneo; Claude so na duvida
  POST /recebida  {"texto"}           -> {"lang","traducao"} ou {"lang":"pt"} (ignorar)
  POST /audio                         -> 501 {"erro":"sem audio"}
"""
import collections, json, os, re, secrets, shutil, subprocess, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORTA = int(os.environ.get("TRADUTOR_PORTA", "8790"))
ARQ_TOKEN = os.path.expanduser(os.environ.get("TRADUTOR_TOKEN_ARQ", "~/.tradutor-token"))
ARQ_DESLIGADO = os.path.expanduser("~/.config/agent-cockpit/tradutor-desligado")
MODELO_CLAUDE = os.environ.get("TRADUTOR_MODELO", "haiku")
DIR_TRAB = os.path.expanduser("~/.tradutor")
TETO_HORA = int(os.environ.get("TRADUTOR_TETO_HORA", "300"))
RECICLAR = 40            # pedidos por processo claude
LIMITE_S = 60            # por traducao
MAX_TEXTO = 4000
PREFIXO = "/tradutor"

os.makedirs(DIR_TRAB, exist_ok=True)


def _token():
    if os.path.exists(ARQ_TOKEN):
        return open(ARQ_TOKEN).read().strip()
    t = secrets.token_urlsafe(24)
    fd = os.open(ARQ_TOKEN, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)  # nasce 600, sem janela aberta
    with os.fdopen(fd, "w") as f:
        f.write(t)
    return t


TOKEN = _token()

NOMES = {"en": "English", "es": "Spanish", "zh": "Simplified Chinese", "pt": "Brazilian Portuguese"}

SISTEMA = """You are a translation engine inside a chat app. Every user message is an independent JSON request; never refer to earlier ones.
- {"mode":"translate","to":LANG,"text":T}: reply ONLY with T translated into LANG. Keep tone, slang, emojis, line breaks and names. No quotes, no notes.
- {"mode":"detect","text":T}: reply ONLY with one line of JSON: {"lang":ISO639-1 code of T,"pt":T translated into Brazilian Portuguese}. If T is mostly Portuguese (even with some English/Spanish words, slang, typos or abbreviations), lang is "pt" and "pt":"".
If the text is empty or not language, return it unchanged (translate) or {"lang":"xx","pt":""} (detect)."""


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


class Limite(Exception):
    pass


class Teto:
    """Conta chamadas ao Claude na ultima hora. Acima do teto, recusa antes de gastar."""

    def __init__(self, teto):
        self.teto = teto
        self.marcas = collections.deque()
        self.trava = threading.Lock()

    def _limpar(self, agora):
        while self.marcas and agora - self.marcas[0] > 3600:
            self.marcas.popleft()

    def gastar(self):
        with self.trava:
            agora = time.time()
            self._limpar(agora)
            if len(self.marcas) >= self.teto:
                raise Limite()
            self.marcas.append(agora)

    def usadas(self):
        with self.trava:
            self._limpar(time.time())
            return len(self.marcas)


TETO = Teto(TETO_HORA)


def _achar_claude():
    return shutil.which("claude") or os.path.expanduser("~/.local/bin/claude")


def _ambiente():
    env = dict(os.environ)
    # defesa em profundidade: mesmo que algum gancho carregue, nenhum deles deve agir nesta chamada
    env.update({"CC_CONFERENTE": "1", "CC_GUIA_HAIKU": "1", "CC_SEM_PONTO": "1", "CC_TRADUTOR": "1"})
    return env


class Claude:
    """Um `claude -p` em modo stream-json, reaproveitado entre pedidos."""

    def __init__(self):
        self.p = None
        self.usos = 0
        self.trava = threading.Lock()

    def _subir(self):
        self._matar()
        self.p = subprocess.Popen(
            [_achar_claude(), "-p", "--model", MODELO_CLAUDE, "--input-format", "stream-json",
             "--output-format", "stream-json", "--verbose", "--no-session-persistence",
             "--setting-sources", "local", "--system-prompt", SISTEMA, "--tools", ""],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            text=True, cwd=DIR_TRAB, bufsize=1, env=_ambiente())
        self.usos = 0
        log("claude subiu pid", self.p.pid)

    def _matar(self):
        if self.p and self.p.poll() is None:
            self.p.kill()
            self.p.wait()
        self.p = None

    def _ler_resultado(self, prazo):
        # le linha a linha com prazo: um leitor em thread evita travar para sempre
        saida = {}
        p = self.p

        def ler():
            for linha in p.stdout:
                try:
                    ev = json.loads(linha)
                except ValueError:
                    continue
                if ev.get("type") == "result":
                    saida["r"] = ev
                    return
        t = threading.Thread(target=ler, daemon=True)
        t.start()
        t.join(prazo)
        return saida.get("r")

    def pedir(self, pedido):
        TETO.gastar()   # cada pedido ao modelo gasta o plano: recusa ANTES, nunca depois
        with self.trava:
            for tentativa in (1, 2):
                if self.p is None or self.p.poll() is not None or self.usos >= RECICLAR:
                    self._subir()
                msg = {"type": "user", "message": {"role": "user",
                       "content": json.dumps(pedido, ensure_ascii=False)}}
                try:
                    self.p.stdin.write(json.dumps(msg) + "\n")
                    self.p.stdin.flush()
                except (BrokenPipeError, OSError):
                    self._matar()
                    continue
                r = self._ler_resultado(LIMITE_S)
                self.usos += 1
                if r and not r.get("is_error") and r.get("result") is not None:
                    return r["result"].strip()
                log("claude falhou (tentativa %d)" % tentativa)   # nunca o texto do pedido
                self._matar()
            raise RuntimeError("claude nao respondeu")


CLAUDE = Claude()          # recebidas (pode formar fila); sobe quando precisar
RAPIDO = Claude()          # envio do teclado e duvidas de idioma: nunca espera a outra fila

CJK = re.compile(r"[぀-ヿ㐀-鿿가-힯]")


# --- deteccao local de idioma (instantanea). O Claude so entra na duvida. ---
MARCAS = {
    "pt": set("""nao não voce você vc vcs tô tá tbm também tambem entao então obrigado obrigada
        valeu né ne pra pro isso essa esse esses essas aqui ai aí agora gente sim eu ele ela eles
        elas nós meu minha meus minhas seu sua nossa nosso vou vai vamo tudo bem bom boa noite
        tarde oi olá ola kkk kkkk kkkkk kkkkkk rs rsrs cê ainda já ja depois hoje amanhã amanha
        ontem fazer faz fiz tenho tem tinha quero queria pode posso coisa coisas onde mas mais
        beleza blz cara mano estou estava foi era bora e é o os as do da dos das na nas num numa
        em um uma umas uns não ao aos pelo pela ser ter estar ir ver dar sei acho falar fala
        falou disse ficar fica fico chegar chegou chego casa amor saudade saudades beijo beijos
        bjs bj tchau querida querido vida dormir comer hora horas semana trabalho também lá cá
        ninguém nunca sempre muito muita muitos muitas só tava tô tamo partiu demais legal
        certeza verdade obg vlw tmj pq porque quando quem qual então mesmo mesma nada""".split()),
    "es": set("""el los las y pero es muy qué cómo hola gracias tengo puedo quiero mañana manana
        hoy ayer bueno buena buenos buenas días noches usted yo mi mis tus cosa cuando dónde
        donde más entonces eso esa ese aquí ahora sí hacer hay estoy estás estas está voy va
        bien jaja jajaja jajajaja vale oye llamo llamar llego luego después despues mucho
        muchas muchos ustedes nosotros soy eres también tambien gusto quieres puedes tienes
        hablamos nos vemos claro perdón""".split()),
    "en": set("""the you i is are and to of in it that what how thanks thank yes not my your we
        they be have will can just so for with on this hi hello see soon tomorrow today good
        morning night love call i'm im it's dont don't i'll you're was were would could should
        about where when why who there here sure please sorry miss""".split()),
}
# existem nas duas linguas: nao contam pra nenhuma
for _w in ("que", "como", "tu", "ya", "ta", "to", "no", "a", "de", "se", "me", "te", "nada", "casa",
           "hora", "horas", "amor", "vida", "querida", "querido", "semana", "comer", "dormir", "ver",
           "dar", "ir", "ser", "estar", "o", "mas", "sempre", "nunca", "quando", "quien"):
    for _l in ("pt", "es"):
        MARCAS[_l].discard(_w)


def pontuar(t):
    """Pontos {"pt","es","en"} do texto."""
    low = t.lower()
    pontos = {"pt": 0.0, "es": 0.0, "en": 0.0}
    if re.search(r"[ñ¿¡]", low): pontos["es"] += 2
    if re.search(r"[ãõç]|ção|ções", low): pontos["pt"] += 1.5
    for w in re.findall(r"[a-zà-ÿ']+", low):
        for l, m in MARCAS.items():
            if w in m: pontos[l] += 1
    return pontos


def tem_pt(t):
    return pontuar(t)["pt"] >= 1


def idioma_local(t):
    """ISO do idioma ou None se nao der para ter certeza. Portugues com palavras
    estrangeiras continua portugues: so traduz quando o estrangeiro domina (2x)."""
    if re.search(r"[぀-ヿ]", t): return "ja"
    if re.search(r"[가-힯]", t): return "ko"
    if CJK.search(t): return "zh"
    if re.search(r"[Ѐ-ӿ]", t): return "ru"
    if re.search(r"[؀-ۿ]", t): return "ar"
    p = pontuar(t)
    pt = p.pop("pt")
    (l1, p1), (l2, p2) = sorted(p.items(), key=lambda x: -x[1])
    if pt >= 1 and pt * 2 >= p1: return "pt"
    if p1 >= 1 and p1 >= p2 + 1: return l1
    return None


_CACHE_LANG = {}   # so em memoria; nunca vai para disco


def idioma(t):
    """Local primeiro; na duvida pergunta ao Claude (fila rapida). Com cache."""
    t = t.strip()[:600]
    if t in _CACHE_LANG: return _CACHE_LANG[t]
    if not CJK.search(t) and len(re.findall(r"[^\W\d_]+", t)) <= 1:
        return "xx"                                   # "ok", "kkk", emoji: nao decide
    l = idioma_local(t)
    if l is None and tem_pt(t): l = "pt"
    if l is None:
        if not re.search(r"[^\W\d_]{2,}", t):      # so emoji/numero/"ok"
            return "xx"
        bruto = RAPIDO.pedir({"mode": "detect", "text": t})
        m = re.search(r'"lang"\s*:\s*"([a-zA-Z-]+)"', bruto)
        l = m.group(1).lower()[:5] if m else "xx"
    if len(_CACHE_LANG) > 2000: _CACHE_LANG.clear()
    _CACHE_LANG[t] = l
    return l


def traduzir(texto, para, fila=None):
    nome = NOMES.get(para, para)
    return (fila or CLAUDE).pedir({"mode": "translate", "to": nome, "text": texto})


def detectar(texto):
    bruto = CLAUDE.pedir({"mode": "detect", "text": texto})
    m = re.search(r"\{.*\}", bruto, re.S)
    try:
        d = json.loads(m.group(0)) if m else {}
    except ValueError:
        d = {}
    lang = str(d.get("lang") or "xx").lower()[:5]
    return lang, (d.get("pt") or "").strip()


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _json(self, code, obj):
        d = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(d)))
        self.end_headers()
        self.wfile.write(d)

    def _caminho(self):
        p = self.path.split("?")[0]
        if p == PREFIXO or p.startswith(PREFIXO + "/"):
            p = p[len(PREFIXO):] or "/"
        return p

    def _autorizado(self):
        dado = self.headers.get("Authorization", "").encode("utf-8", "replace")
        if secrets.compare_digest(dado, ("Bearer " + TOKEN).encode()):
            return True
        self._json(401, {"erro": "token"})
        return False

    def _corpo(self, limite):
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0 or n > limite:
            raise ValueError("tamanho")
        return self.rfile.read(n)

    def do_GET(self):
        c = self._caminho()
        if c == "/saude":
            return self._json(200, {"ok": True})
        if c == "/uso":
            if not self._autorizado():
                return
            return self._json(200, {"ultima_hora": TETO.usadas(), "teto": TETO.teto})
        self._json(404, {"erro": "rota"})

    def do_POST(self):
        if not self._autorizado():
            return
        c = self._caminho()
        t0 = time.time()
        if os.path.exists(ARQ_DESLIGADO):
            return self._json(503, {"erro": "desligado"})
        try:
            if c == "/audio":
                return self._json(501, {"erro": "sem audio"})
            d = json.loads(self._corpo(64 * 1024))
            texto = (d.get("texto") or "").strip()[:MAX_TEXTO]
            if c == "/traduzir":
                para = (d.get("para") or "en").lower()
                # envio do usuario: fila rapida, nunca atras das recebidas
                self._json(200, {"traducao": traduzir(texto, para, RAPIDO) if texto else ""})
            elif c == "/log":
                log("app log, %d caracteres" % len(texto))   # nunca o conteudo
                return self._json(200, {"ok": True})
            elif c == "/idioma":
                self._json(200, {"lang": idioma(texto) if texto else "xx"})
            elif c == "/recebida":
                if not CJK.search(texto) and len(re.findall(r"[^\W\d_]{2,}", texto)) <= 1:
                    return self._json(200, {"lang": "xx"})
                lang = idioma_local(texto)
                if lang == "pt" or (lang is None and tem_pt(texto)):
                    return self._json(200, {"lang": "pt"})
                if lang:
                    trad = traduzir(texto, "pt")
                else:
                    lang, trad = detectar(texto)
                if lang == "pt" or not trad:
                    return self._json(200, {"lang": lang})
                self._json(200, {"lang": lang, "traducao": trad})
            else:
                return self._json(404, {"erro": "rota"})
            log(c, "%.1fs" % (time.time() - t0))
        except Limite:
            log(c, "LIMITE")
            self._json(429, {"erro": "limite"})
        except Exception as e:
            log(c, "ERRO", type(e).__name__)   # so o tipo: a mensagem pode conter o texto
            self._json(500, {"erro": "falhou"})


if __name__ == "__main__":
    srv = ThreadingHTTPServer(("127.0.0.1", PORTA), H)
    # aquece so a fila rapida (a do teclado, com o usuario esperando); a de recebidas sobe no primeiro uso
    # so sobe o processo, sem pedido: um pedido de aquecimento gastava o plano e 1 do teto a cada partida
    def _aquecer():
        with RAPIDO.trava:
            RAPIDO._subir()
    threading.Thread(target=_aquecer, daemon=True).start()
    log("tradutor ouvindo em 127.0.0.1:%d (teto %d/h)" % (PORTA, TETO_HORA))
    srv.serve_forever()
