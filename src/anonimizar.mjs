/* Anonimização no navegador (docs/PIERRE-03.md).

   Este arquivo é a peça central da promessa do produto: com ele, o dado pessoal
   **não sai da máquina de quem usa**. O servidor recebe o texto já mascarado e
   nunca teve como ver o original.

   É uma tradução do que o `svc_pierre/privacidade.py` faz hoje em Python, com
   uma diferença importante: lá existe um modelo de linguagem de 500 MB que
   reconhece nome de pessoa. Aqui não existe, e a estratégia para nomes é outra
   (ver `porAncora`).

   Nada aqui faz requisição. Nada aqui escreve em lugar nenhum. Entra texto,
   sai texto mascarado e o mapa — e quem decide o que fazer com o mapa é o
   cofre, não este módulo. */



/* ── validação de dígito: o que separa "parece CPF" de "é CPF" ───────────────
   Sem isto, qualquer sequência de 11 dígitos vira CPF — número de processo,
   código de barras, sequência de contrato. O dígito verificador derruba
   praticamente todos os falsos positivos, e é a mesma conta do serviço. */

export function cpfValido(cru) {
  const n = cru.replace(/\D/g, "");
  if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false;
  for (const [tamanho, posicao] of [
    [9, 9],
    [10, 10],
  ]) {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(n[i]) * (tamanho + 1 - i);
    const digito = ((soma * 10) % 11) % 10;
    if (digito !== Number(n[posicao])) return false;
  }
  return true;
}

export function cnpjValido(cru) {
  const n = cru.replace(/\D/g, "");
  if (n.length !== 14 || /^(\d)\1{13}$/.test(n)) return false;
  const pesos = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  for (const tamanho of [12, 13]) {
    const usados = pesos.slice(13 - tamanho);
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(n[i]) * usados[i];
    const resto = soma % 11;
    const digito = resto < 2 ? 0 : 11 - resto;
    if (digito !== Number(n[tamanho])) return false;
  }
  return true;
}

/* ── os padrões ──────────────────────────────────────────────────────────────
   Mesmos do serviço. A confiança baixa em CEP e RG não é desleixo: `\d{5}-\d{3}`
   também casa com número de processo e código interno, e um RG sem contexto é
   indistinguível de qualquer número com dígito. Por isso os dois só entram
   quando há palavra de contexto por perto. */


/* ── endereço ────────────────────────────────────────────────────────────────
   ⚠️ ACHADO RODANDO O FLUXO NOVO PONTA A PONTA, e é o tipo de coisa que só
   aparece assim: o CEP era mascarado, mas **"Avenida das Nacoes 1200, conjunto
   71" subia em claro**. Endereço é dado pessoal, e o caminho antigo pegava —
   lá o spaCy reconhece LOCATION. Trocar aquele modelo por âncora sem cobrir
   endereço teria sido uma regressão de privacidade escondida atrás de uma
   melhoria.

   O reconhecimento é pelo TIPO DE LOGRADOURO, que é palavra fechada e quase não
   dá falso positivo. Duas coisas que a medição contra contrato real ensinou:

   · o endereço **quebra no meio da linha** com frequência ("Rua Sete de\n
     Setembro"), então o corpo atravessa uma quebra simples — e nunca uma linha
     em branco, que já seria outro parágrafo;
   · ele para antes de `CEP`, porque o CEP tem etiqueta própria e engoli-lo
     junto deixaria dois dados pessoais debaixo de uma etiqueta só. */
const LOGRADOURO = "(?:Rua|Avenida|Av\\.|Alameda|Travessa|Pra[çc]a|Rodovia|Estrada|Largo)";
const CORPO_ENDERECO = "(?:(?!CEP|<CEP)[^,\\n]|\\n(?!\\s*\\n))";

/* o último caractere não pode ser espaço nem vírgula: sem isto a etiqueta
   engolia a pontuação ("Rua Sete de Abril 88, " virava tudo `<ENDERECO_1>`) e o
   texto que segue para o modelo perdia a vírgula que separava as informações */
const FIM_ENDERECO = "(?:(?!CEP|<CEP)[^,\\n\\s])";

/* o que pode vir depois da vírgula e ainda ser endereço. Sem esta lista, a
   parte opcional aceitava QUALQUER coisa, e "Avenida Paulista 1000, doravante
   CONTRATADA" virava uma etiqueta só — mascarando justamente o que diz qual
   parte é qual. Achado ao portar este arquivo pra cá, e devolvido ao Pierre no
   commit `46999be` do inovallbond, que é a origem dele. */
const COMPLEMENTO =
  "(?:n[ºo°.]?\\s*)?\\d|conjunto|conj|sala|bloco|bl|apto|ap|andar|casa|lote|quadra|qd|galp[ãa]o|fundos|t[ée]rreo|bairro|jardim|vila|centro|s\\/n";

const RE_ENDERECO = new RegExp(
  `\\b${LOGRADOURO}\\s+${CORPO_ENDERECO}{1,69}${FIM_ENDERECO}` +
    /* a segunda parte (número, conjunto, bairro) é opcional: "Rua X, 190" e
       "Rua X 190, conjunto 71" são igualmente comuns */
    `(?:,\\s*(?=${COMPLEMENTO})(?:(?!CEP|<CEP)[^,\\n]){0,39}${FIM_ENDERECO})?`,
  "gi",
);

/* ── cidade, estado e comarca ────────────────────────────────────────────────
   Pedido do Felipe em 2026-08-10, olhando uma análise de verdade: *"ele colocou
   a comarca de São Paulo, ele não omitiu esse dado. Eu acho que ele possa ser
   importante pra não identificar qual a comarca que está analisando"*.

   Ele tem razão, e o endereço sozinho não cobria: `Rua X` virava etiqueta e
   `Sao Paulo/SP` logo depois ficava em claro, junto com `comarca de Sao Paulo`.
   Cidade e comarca estreitam muito quem são as partes.

   ⚠️ **Custo que isto tem, e é real:** o foro de eleição é julgado pelo
   desequilíbrio que cria, e a distância entre a comarca escolhida e a parte
   mais fraca faz parte disso. Mascarando a comarca, o modelo perde esse fio.
   A cláusula continua sendo avaliada; o parecer sobre foro fica mais pobre.
   Decisão dele, registrada para não ser revista por acidente. */
const NOME_LUGAR = "[A-ZÁ-Ú][\\wÁ-ú'.-]*(?:\\s+(?:d[eao]s?\\s+)?[A-ZÁ-Ú][\\wÁ-ú'.-]*){0,3}";

/* "Sao Paulo/SP", "Rio de Janeiro/RJ". A parte antes da barra precisa ter
   minúscula: sem isso, `SSP/SP` (órgão emissor do RG) e `DETRAN/RJ` virariam
   lugar — foi o que a medição contra contrato real mostrou. */
const RE_CIDADE_UF = new RegExp(`\\b${NOME_LUGAR}\\s*/\\s*[A-Z]{2}\\b`, "g");

/* "comarca de São Paulo", "cidade de Florianópolis", "foro da comarca de X"
   ⚠️ SEM a flag `i`, e as duas grafias escritas à mão. Com `i`, o `[A-ZÁ-Ú]`
   do nome do lugar passa a aceitar minúscula — e aí "foro da" virava a âncora e
   o grupo engolia a própria palavra "comarca", deixando `<LOCAL_1>/SP` no lugar
   de "comarca de <LOCAL_1>". Foi assim que apareceu na primeira medição. */
const RE_COMARCA = new RegExp(
  `\\b[CcSs]?(?:[Cc]omarca|[Cc]idade|[Mm]unic[íi]pio|[Ff]oro)\\s+d[eao]s?\\s+(${NOME_LUGAR})`,
  "g",
);

const PADROES = [
  {
    tipo: "ENDERECO",
    re: RE_ENDERECO,
    /* 0,75: o tipo de logradouro é sinal forte, mas onde o endereço termina é
       palpite — e é por isso que a revisão mostra o que foi mascarado */
    confianca: 0.75,
  },
  {
    tipo: "LOCAL",
    re: RE_CIDADE_UF,
    confianca: 0.8,
    /* a sigla de órgão emissor não é lugar: exige uma minúscula do lado
       esquerdo da barra */
    valida: (v) => /[a-zá-ú]/.test(v.split("/")[0]),
  },
  {
    tipo: "LOCAL",
    re: RE_COMARCA,
    confianca: 0.8,
    /* só o nome do lugar entra na etiqueta, não a palavra "comarca": trocar a
       frase inteira apagaria a informação de que existe cláusula de foro, que é
       exatamente o que a análise precisa enxergar */
    grupo: 1,
  },
  {
    tipo: "CPF",
    re: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,
    confianca: 0.95,
    valida: cpfValido,
  },
  {
    tipo: "CNPJ",
    re: /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g,
    confianca: 0.95,
    valida: cnpjValido,
  },
  {
    tipo: "EMAIL",
    re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    confianca: 0.9,
  },
  {
    tipo: "OAB",
    re: /\bOAB[/\s-]?[A-Z]{2}\s?n?[ºo°.]?\s?\d{3,6}\b/gi,
    confianca: 0.85,
  },
  {
    tipo: "TELEFONE",
    re: /(?:\+55\s?)?(?:\(?\d{2}\)?\s?)?9?\d{4}[-\s]?\d{4}\b/g,
    confianca: 0.5,
    contexto: ["telefone", "celular", "whatsapp", "contato", "fone", "tel"],
  },
  {
    tipo: "CEP",
    re: /\b\d{5}-?\d{3}\b/g,
    confianca: 0.45,
    contexto: ["cep", "endereço", "endereco", "rua", "avenida", "av.", "bairro"],
  },
  {
    tipo: "RG",
    re: /\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dXx]\b/g,
    confianca: 0.4,
    contexto: ["rg", "identidade", "ssp", "órgão emissor", "orgao emissor"],
  },
];

/** Janela de 60 caracteres para cada lado: onde a palavra de contexto vale. */
const JANELA = 60;

function temContexto(texto, inicio, fim, palavras) {
  const trecho = texto
    .slice(Math.max(0, inicio - JANELA), Math.min(texto.length, fim + JANELA))
    .toLowerCase();
  return palavras.some((p) => trecho.includes(p));
}

/* ── nomes, sem modelo de linguagem ──────────────────────────────────────────
   Contrato brasileiro qualifica as partes num padrão previsível:

     MARIA SILVA OLIVEIRA, brasileira, casada, portadora do CPF nº ...
     TECNOLOGIA ALFA LTDA., inscrita no CNPJ sob o nº ...

   A âncora é a palavra de qualificação; o nome são as palavras capitalizadas
   imediatamente antes dela. Não pega tudo — nome solto no meio de uma cláusula
   escapa — e por isso a tela de revisão continua obrigatória. O que este método
   garante é o caso que mais importa: a qualificação das partes, que é onde os
   nomes completos estão. */

const ANCORAS = [
  "brasileir[oa]",
  "portador(?:a)?\\s+d[oa]",
  "inscrit[oa]\\s+n[oa]",
  "residente",
  "domiciliad[oa]",
  "com\\s+sede",
  "neste\\s+ato",
  "doravante",
  "CPF",
  "CNPJ",
];

/* Palavras capitalizadas que NÃO são nome: aparecem em maiúscula por serem
   início de frase, título de cláusula ou termo do contrato. Sem esta lista, a
   âncora captura "CLÁUSULA PRIMEIRA" como se fosse gente. */
const NAO_E_NOME = new Set([
  "a","o","as","os","de","da","do","das","dos","e","em","no","na","nos","nas",
  "cláusula","clausula","primeira","segunda","terceira","quarta","quinta","sexta",
  "sétima","setima","oitava","nona","décima","decima","parágrafo","paragrafo",
  "contrato","contratante","contratada","contratado","contratante","instrumento",
  "particular","prestação","prestacao","serviços","servicos","objeto","partes",
  "empresa","sociedade","pessoa","física","fisica","jurídica","juridica",
  "nº","no","sob","the","of","rg","cpf","cnpj","oab","ltda","me","epp","sa",
]);

const PALAVRA_NOME = "[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][\\wÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúç.]*";

/* ⚠️ Sufixo de razão social só vale no FIM e como palavra inteira. A primeira
   versão testava `/LTDA|S\.?A\.?|ME|EPP|EIRELI/i` em qualquer posição, e o `ME`
   casava dentro de nome de gente: al**me**ida, **me**ndes. Nos contratos de
   exemplo isso etiquetou "Ricardo Almeida Tavares" e "Otavio Mendes Ribeiro"
   como empresa. */
const SUFIXO_EMPRESA = /\b(LTDA|EIRELI|EPP|MEI|ME|S\/A|S\.A|SA)\b\.?\s*$/i;

/* palavras que praticamente só aparecem em razão social, em qualquer posição */
const PALAVRA_DE_EMPRESA =
  /\b(tecnologia|participa\w*|holding|consultoria|com[ée]rcio|ind[úu]stria|servi[çc]os|associa\w*|instituto|funda[çc][ãa]o|banco|capital|labs?|sistemas|solu[çc][õo]es)\b/i;

function ehEmpresa(nome) {
  return SUFIXO_EMPRESA.test(nome) || PALAVRA_DE_EMPRESA.test(nome);
}

function porAncora(texto) {
  const achados = [];
  /* duas a seis palavras capitalizadas, seguidas de vírgula opcional e de uma
     âncora de qualificação */
  const re = new RegExp(
    `((?:${PALAVRA_NOME}\\s+){1,5}${PALAVRA_NOME})\\s*,?\\s*(?:${ANCORAS.join("|")})`,
    "g",
  );
  for (const m of texto.matchAll(re)) {
    const bruto = m[1].trim();
    const palavras = bruto.split(/\s+/);
    /* corta pela frente enquanto a primeira palavra for das que não são nome:
       "DO CONTRATO MARIA SILVA" vira "MARIA SILVA" */
    while (palavras.length && NAO_E_NOME.has(palavras[0].toLowerCase().replace(/[.,]/g, ""))) {
      palavras.shift();
    }
    if (palavras.length < 2) continue;
    const nome = palavras.join(" ");
    /* se sobrou só termo de contrato, não é nome de ninguém */
    const uteis = palavras.filter(
      (p) => !NAO_E_NOME.has(p.toLowerCase().replace(/[.,]/g, "")),
    );
    if (uteis.length < 2) continue;

    const inicio = (m.index ?? 0) + m[0].indexOf(nome);
    achados.push({
      valor: nome,
      inicio,
      fim: inicio + nome.length,
      tipo: ehEmpresa(nome) ? "EMPRESA" : "PESSOA",
      /* 0,7 e não 0,95: a âncora acerta muito e não é prova. Quem confere é
         quem está lendo. */
      confianca: 0.7,
    });
  }
  return achados;
}

/* ── a montagem ──────────────────────────────────────────────────────────────*/

function achar(texto) {
  const achados = [];

  for (const p of PADROES) {
    /* `matchAll` cria o próprio iterador e não sofre do `lastIndex` que já
       mordeu este projeto uma vez com `.test()` em regex global */
    for (const m of texto.matchAll(p.re)) {
      /* `grupo` existe para o caso da comarca: o padrão precisa reconhecer
         "comarca de São Paulo" inteiro para ter certeza do que é, mas só o nome
         do lugar vira etiqueta. Trocar a frase toda apagaria a informação de que
         existe cláusula de foro, que é o que a análise precisa enxergar. */
      const valor = p.grupo ? m[p.grupo] : m[0];
      if (!valor) continue;
      const inicio = (m.index ?? 0) + (p.grupo ? m[0].indexOf(valor) : 0);
      if (p.valida && !p.valida(valor)) continue;
      if (p.contexto && !temContexto(texto, inicio, inicio + valor.length, p.contexto)) continue;
      achados.push({
        valor,
        inicio,
        fim: inicio + valor.length,
        tipo: p.tipo,
        confianca: p.confianca,
      });
    }
  }

  achados.push(...porAncora(texto));

  /* Sobreposição: um CPF dentro de um trecho capturado como nome, por exemplo.
     Ordena por posição e, no empate, mantém o mais confiável e o mais longo. */
  achados.sort((a, b) => a.inicio - b.inicio || b.confianca - a.confianca || b.fim - a.fim);
  const limpos = [];
  for (const a of achados) {
    const ultimo = limpos[limpos.length - 1];
    if (ultimo && a.inicio < ultimo.fim) continue;
    limpos.push(a);
  }
  return limpos;
}

/**
 * Troca cada dado pessoal por uma etiqueta e devolve o mapa para desfazer.
 *
 * O mesmo valor recebe sempre a mesma etiqueta: se "MARIA SILVA" aparece oito
 * vezes, é `<PESSOA_1>` nas oito. Sem isso o modelo de análise perderia a
 * noção de que é a mesma pessoa, e a explicação sairia sem sentido.
 */
export function anonimizar(texto) {
  const achados = achar(texto);
  const mapa = {};
  const etiquetaDe = new Map();
  const contador = {};

  let saida = "";
  let cursor = 0;
  for (const a of achados) {
    const chave = `${a.tipo}:${a.valor.toLowerCase()}`;
    let etiqueta = etiquetaDe.get(chave);
    if (!etiqueta) {
      contador[a.tipo] = (contador[a.tipo] ?? 0) + 1;
      etiqueta = `<${a.tipo}_${contador[a.tipo]}>`;
      etiquetaDe.set(chave, etiqueta);
      mapa[etiqueta] = a.valor;
    }
    saida += texto.slice(cursor, a.inicio) + etiqueta;
    cursor = a.fim;
  }
  saida += texto.slice(cursor);

  return { texto: saida, mapa, achados };
}

/** Desfaz a troca. Roda só no navegador de quem tem o mapa. */
export function reidentificar(texto, mapa) {
  let saida = texto;
  for (const [etiqueta, valor] of Object.entries(mapa)) {
    saida = saida.split(etiqueta).join(valor);
  }
  return saida;
}

/**
 * Rede de segurança: procura no texto JÁ anonimizado qualquer valor do mapa que
 * tenha escapado. Se isto achar alguma coisa, o texto não pode subir.
 */
export function vazou(textoAnon, mapa) {
  const sujos = [];
  for (const valor of Object.values(mapa)) {
    if (valor.length >= 4 && textoAnon.includes(valor)) sujos.push(valor);
  }
  return sujos;
}

/**
 * Mascara termos que a pessoa marcou à mão na tela de revisão: o apelido, o
 * nome fora do comum, a razão social criativa. É a rede que cobre o que a
 * âncora não pegou.
 */
export function mascararTermos(
  texto,
  termos,
  mapa,
) {
  const novo = { ...mapa };
  let saida = texto;
  let n = Object.keys(novo).filter((k) => k.startsWith("<MARCADO_")).length;
  for (const termo of termos) {
    const limpo = termo.trim();
    if (limpo.length < 3 || !saida.includes(limpo)) continue;
    n += 1;
    const etiqueta = `<MARCADO_${n}>`;
    novo[etiqueta] = limpo;
    saida = saida.split(limpo).join(etiqueta);
  }
  return { texto: saida, mapa: novo };
}
