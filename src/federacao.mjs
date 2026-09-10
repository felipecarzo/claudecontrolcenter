/**
 * Federação: um painel só, com as duas máquinas dentro.
 *
 * Pedido do Felipe em 14/08: "eu queria abrir os dois e estar sempre os dois
 * online, sempre os dois pegando tudo que os dois estão fazendo", com filtro no
 * topo e a origem escrita ao lado de cada agente.
 *
 * ## A topologia é torta, e não por escolha
 *
 * O desktop alcança a VPS (`cockpit.carzo.com.br`); a VPS **nunca** alcança o
 * desktop atrás de NAT. Então a VPS é o servidor e o desktop é cliente que
 * empurra. Qualquer desenho simétrico não sai do papel.
 *
 * ## O que trafega é resumo, nunca arquivo
 *
 * Os transcritos do PC têm centenas de MB. O pacote leva o que a tela precisa
 * (jobs já derivados, uso do plano, totais de tempo, portas em escuta) e nunca
 * o material bruto. `LIMITE_PACOTE` existe para isso não degenerar com o tempo.
 *
 * ## Falha de rede é silenciosa
 *
 * Mesma regra do câmbio: sem contato, cada painel continua inteiro com o que é
 * local, e a máquina ausente aparece como "sem contato há Xmin". Nunca sumir
 * calada, que faria parecer que o trabalho não existiu.
 */
import fs from 'node:fs'
import path from 'node:path'
import { casaClaude } from './platform.mjs'

/* `casaClaude()`, nunca `os.homedir()`: é o único lugar que resolve a pasta
   `.claude`, e `CC_HOME` redireciona tudo para uma casa isolada. Achado em
   17/08 ao tentar provar a tela de rotas de outra máquina com um pacote de
   laboratório: a instância de teste continuava lendo a pasta REAL, então o
   teste não podia funcionar e um pacote de mentira teria acabado no painel
   dele. Função e não constante, porque `CC_HOME` pode mudar entre chamadas. */
export const dirFederacao = () => path.join(casaClaude(), 'control-center-federacao')
export const DIR = dirFederacao()

/** Acima disto o pacote é recusado: 2 MB já é muito para um resumo de tela. */
export const LIMITE_PACOTE = 2 * 1024 * 1024

/** Depois disso a máquina conta como sem contato, mas o dado continua visível
 *  (marcado como velho) em vez de sumir. */
export const SEM_CONTATO_MS = 5 * 60 * 1000

/**
 * CC-440 — o número do CONTRATO entre quem manda e quem recebe.
 *
 * ## Por que existe
 *
 * Proposta dele em 30/08: *"assim independente da versão do programa aqui, a
 * vps vai receber os dados e ela processa lá"*. Sem um número, isso é esperança:
 * a validação campo a campo perdoa muita coisa, mas **a VPS não tem como dizer
 * "este coletor está velho demais", e o coletor não tem como saber que a outra
 * ponta espera algo novo**. As duas pontas ficam adivinhando pelo silêncio, que
 * é a família de defeito mais cara deste painel.
 *
 * ## Quando SOBE, e é a regra inteira
 *
 * Só quando o SIGNIFICADO de um campo muda: ele passa a querer dizer outra
 * coisa, muda de unidade, ou sai.
 *
 * **Acrescentar campo NÃO sobe.** Campo desconhecido já é ignorado por
 * `validarPacote`, que recorta campo a campo, e é isso que permite as duas
 * pontas andarem em ritmos diferentes. Subir a cada campo novo transformaria o
 * número num contador de commits, e a primeira coisa que alguém faria seria
 * ignorá-lo.
 *
 * ## O que NÃO fazer com ele
 *
 * **Nunca recusar o pacote por causa do número.** Dado velho com aviso é melhor
 * que silêncio: recusar calado é a máquina sumindo do painel sem explicação, e
 * quem olha conclui que aquele computador está desligado. A divergência vira
 * aviso na tela, nunca porta fechada.
 *
 * 1 = o formato de 30/08, o primeiro a se declarar. Pacote sem o campo é `0`,
 * "não diz", e continua valendo: são todas as versões anteriores a esta.
 */
export const CONTRATO = 1

const seguro = (s) => String(s || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40)

/**
 * Valida o que chegou pela rede. Nada aqui confia no remetente: id sujo vira
 * caminho de arquivo, e lista gigante vira memória.
 */
export function validarPacote(bruto) {
  if (!bruto || typeof bruto !== 'object') return { ok: false, erro: 'pacote vazio' }
  const id = seguro(bruto.maquina?.id)
  if (!id) return { ok: false, erro: 'pacote sem identidade de máquina' }

  const lista = (v, max) => (Array.isArray(v) ? v.slice(0, max) : [])
  return {
    ok: true,
    pacote: {
      maquina: { id, nome: String(bruto.maquina?.nome || id).slice(0, 60) },
      /* CC-440: qual formato esta máquina fala. Ausente vira `0`, "não diz", que
         é toda versão anterior a 30/08 — e continua sendo aceita, porque recusar
         por causa do número faria a máquina sumir do painel sem explicação. O
         número serve para a tela AVISAR, nunca para fechar a porta. */
      contrato: Number.isFinite(bruto.contrato) ? Math.max(0, Math.trunc(bruto.contrato)) : 0,
      jobs: lista(bruto.jobs, 500),
      /* CC-353: recortado campo a campo como todo o resto, e não aceito cru.
         Ele nunca chegou preenchido até hoje, então não há formato antigo a
         preservar: dá para fechar a porta agora, que é mais barato do que
         depois. */
      servidores: Array.isArray(bruto.servidores)
        ? bruto.servidores.slice(0, 200).map((x) => ({
          pid: Number(x?.pid) || null,
          name: String(x?.name || '').slice(0, 80),
          ports: (Array.isArray(x?.ports) ? x.ports : []).slice(0, 10).map((n) => Number(n) || 0).filter(Boolean),
          kind: x?.kind ? String(x.kind).slice(0, 40) : null,
          project: x?.project ? String(x.project).slice(0, 80) : null,
          path: x?.path ? String(x.path).slice(0, 260) : null,
          sub: x?.sub ? String(x.sub).slice(0, 80) : null,
          since: Number(x?.since) || null,
        })).filter((x) => x.ports.length || x.pid)
        : null,
      uso: bruto.uso && typeof bruto.uso === 'object' ? bruto.uso : null,
      tempo: bruto.tempo && typeof bruto.tempo === 'object' ? bruto.tempo : null,
      /* CC-48: 40 projetos é folgado e limita o estrago de um pacote malformado.
         CC-449: `null` sobrevive à validação, e a razão está no bloco abaixo. */
      rotas: bruto.rotas == null ? null : lista(bruto.rotas, 40),
      /* CC-165: o resumo dos backlogs. Mesmo teto das rotas, e cada item é
         recortado campo a campo em vez de aceito inteiro: um `titulos` com
         mil entradas de 10 KB passaria pelo limite do pacote e só apareceria
         como tela travada, que é o tipo de defeito que não se lê no código. */
      /* CC-449: `null` e `[]` deixam de ser a mesma coisa aqui, e a diferença é
         o que faz a herança funcionar.
         `gravarPacote` preserva o campo que o pacote novo NÃO traz, testando
         `== null`. Como este recorte convertia ausente em `[]`, o campo nunca
         era ausente: um pacote em que a varredura do roadmap FALHOU na outra
         ponta chegava com lista vazia, e vazio apagava o mapa inteiro que já
         tinha chegado antes. Sem erro, sem descarte registrado, e com
         `idades.backlogs` carimbado como se fosse dado fresco.
         Medido em 01/09, em casa isolada e lado a lado: no mesmo caso, `tempo`
         herdava e `backlogs` era zerado. E o retrato real do PC guardado aqui
         estava assim, com `backlogs: 0` e `rotas: 0`.
         `servidores`, duas dezenas de linhas acima, sempre fez o certo — este é
         o formato que os dois campos passam a seguir.
         ⚠️ Vazio de VERDADE continua vazio: máquina sem nenhum projeto com
         roadmap manda `[]` e grava `[]`. Herdar isso também seria trocar um
         defeito por outro pior, com mapa de anteontem posando de atual. */
      backlogs: bruto.backlogs == null ? null : lista(bruto.backlogs, 40).map((b) => ({
        projeto: String(b?.projeto || '').slice(0, 80),
        atualizadoEm: Number(b?.atualizadoEm) || null,
        frentes: Number(b?.frentes) || 0,
        abertas: Number(b?.abertas) || 0,
        titulos: (Array.isArray(b?.titulos) ? b.titulos : [])
          .slice(0, 6).map((t) => String(t).slice(0, 160)),
        /* CC-440: o mapa de verdade, recortado com o mesmo rigor do resto.
           Isto é REDE entrando em disco: cada campo é convertido e cortado, e
           nada do que chega é copiado como veio. O teto aqui é o mesmo do
           remetente, e existe de novo porque quem manda pode ser qualquer um. */
        sprints: (Array.isArray(b?.sprints) ? b.sprints : []).slice(0, TETO_FRENTES).map((s) => ({
          titulo: String(s?.titulo || '').slice(0, 200),
          estado: s?.estado ? String(s.estado).slice(0, 24) : null,
          frentes: Number(s?.frentes) || 0,
          itens: Number.isFinite(s?.itens) ? Number(s.itens) : null,
          feitos: Number.isFinite(s?.feitos) ? Number(s.feitos) : null,
        })).filter((s) => s.titulo),
        lista: (Array.isArray(b?.lista) ? b.lista : []).slice(0, TETO_FRENTES).map((f) => ({
          titulo: String(f?.titulo || '').slice(0, 200),
          grupo: String(f?.grupo || '').slice(0, 200),
          estado: f?.estado ? String(f.estado).slice(0, 24) : null,
          itens: Number.isFinite(f?.itens) ? Number(f.itens) : null,
          feitos: Number.isFinite(f?.feitos) ? Number(f.feitos) : null,
          peso: Number.isFinite(f?.peso) ? Number(f.peso) : null,
          citacao: f?.citacao ? String(f.citacao).slice(0, 300) : null,
        })).filter((f) => f.titulo),
        cortado: Boolean(b?.cortado),
      })).filter((b) => b.projeto),
      /* CC-263: os três campos novos, e a validação existe porque **nada aqui
         confia no remetente**: um pacote é rede entrando em disco.
         `undefined` vira `null` de propósito: "esta máquina não sabe dizer" é
         resposta legítima, e some no `JSON.stringify` se ficar `undefined`,
         virando "o campo nem existe". Foi o que aconteceu na primeira rodada. */
      meu: Array.isArray(bruto.meu)
        ? bruto.meu.slice(0, 200).map((t) => ({
          id: String(t?.id || '').slice(0, 40),
          texto: String(t?.texto || '').slice(0, 400),
          projeto: t?.projeto ? String(t.projeto).slice(0, 80) : null,
          frente: t?.frente ? String(t.frente).slice(0, 120) : null,
          porque: t?.porque ? String(t.porque).slice(0, 400) : null,
          em: Number(t?.em) || null,
        })).filter((t) => t.texto)
        : null,
      agentes: Array.isArray(bruto.agentes)
        ? bruto.agentes.slice(0, 20).map((a) => ({
          id: String(a?.id || '').slice(0, 40),
          rotulo: String(a?.rotulo || '').slice(0, 60),
          paga: a?.paga ? String(a.paga).slice(0, 80) : null,
          instalado: typeof a?.instalado === 'boolean' ? a.instalado : null,
        })).filter((a) => a.id)
        : null,
      limites: bruto.limites && typeof bruto.limites === 'object' && !Array.isArray(bruto.limites)
        ? bruto.limites : null,
      /* CC-340: as travas e o framework daquela máquina.
         Nasceu de uma pergunta que não tinha resposta em tela nenhuma: se os
         ganchos estão mesmo registrados no PC. Sem isto, uma pendência ficou
         dez dias sem poder ser confirmada nem fechada.
         `registrado` e `ligado` são três estados, não dois: `true`, `false` e
         `null` para "aquela máquina não soube dizer". Coagir para booleano aqui
         transformaria "não sei" em "não está", que é a mentira exata que este
         campo existe para acabar. */
      travas: Array.isArray(bruto.travas)
        ? bruto.travas.slice(0, 60).map((t) => ({
          id: String(t?.id || '').slice(0, 40),
          evento: String(t?.evento || '').slice(0, 40),
          registrado: typeof t?.registrado === 'boolean' ? t.registrado : null,
          ligado: typeof t?.ligado === 'boolean' ? t.ligado : null,
        })).filter((t) => t.id)
        : null,
      framework: Array.isArray(bruto.framework)
        ? bruto.framework.slice(0, 60).map((f) => ({
          projeto: String(f?.projeto || '').slice(0, 80),
          existe: Boolean(f?.existe),
          ligado: typeof f?.ligado === 'boolean' ? f.ligado : null,
          modo: f?.modo ? String(f.modo).slice(0, 40) : null,
          fase: f?.fase ? String(f.fase).slice(0, 40) : null,
          perfil: f?.perfil ? String(f.perfil).slice(0, 40) : null,
          erro: f?.erro ? String(f.erro).slice(0, 120) : null,
          /* CC-344: as travas daquele projeto, recortadas chave a chave, como
             todo campo que chega pela rede neste arquivo. */
          modulos: f?.modulos && typeof f.modulos === 'object' && !Array.isArray(f.modulos)
            ? Object.fromEntries(Object.entries(f.modulos).slice(0, 20)
              .filter(([, v]) => typeof v === 'boolean')
              .map(([k, v]) => [String(k).slice(0, 40), v]))
            : null,

          /* CC-445: o resto do que o projeto sabe sobre si.
             ⚠️ **Estes campos precisam existir AQUI para chegarem do outro
             lado.** Esta função recorta campo a campo de propósito, porque é
             rede entrando em disco, e campo que ela não conhece some CALADO: o
             pacote sai rico e chega magro, sem erro em lugar nenhum. Aconteceu
             no CC-440 com o roadmap, e o alinhamento entre as máquinas avisou
             disto com todas as letras antes de acontecer de novo.
             `metodo` é o que mais falta: a fase viajava sozinha (`execucao`), e
             fase sem o método que a define não diz de quantas ela é nem o que
             vem depois. */
          metodo: f?.metodo ? String(f.metodo).slice(0, 40) : null,
          mvp: f?.mvp && typeof f.mvp === 'object' && !Array.isArray(f.mvp)
            ? {
              nome: String(f.mvp.nome || '').slice(0, 300),
              criterios: (Array.isArray(f.mvp.criterios) ? f.mvp.criterios : [])
                .slice(0, 40)
                .map((c) => ({ texto: String(c?.texto || '').slice(0, 300), feito: Boolean(c?.feito) }))
                .filter((c) => c.texto),
            }
            : null,
          /* O que o projeto já liberou, e o que espera resposta. Sem os dois, o
             cartão remoto desenha a trava e não tem como dizer por que ela está
             segurando alguém agora. */
          autorizado: (Array.isArray(f?.autorizado) ? f.autorizado : [])
            .slice(0, 40).map((a) => String(a).slice(0, 200)).filter(Boolean),
          pedidos: (Array.isArray(f?.pedidos) ? f.pedidos : [])
            .slice(0, 20)
            .map((p) => ({
              alvo: String(p?.alvo || '').slice(0, 200),
              motivo: p?.motivo ? String(p.motivo).slice(0, 300) : null,
              quando: p?.quando ? String(p.quando).slice(0, 40) : null,
            }))
            .filter((p) => p.alvo),
        })).filter((f) => f.projeto)
        : null,
      /* CC-452: mesmo recorte campo a campo dos vizinhos. `instalado`/`rodando`
         viram `null` (nunca `false`) quando o valor que chegou não é booleano:
         coagir aqui trocaria "esta máquina não sabe dizer" por "não está
         instalado", que é a mentira exata que este campo existe para acabar. */
      servico: bruto.servico && typeof bruto.servico === 'object' && !Array.isArray(bruto.servico)
        ? {
          instalado: typeof bruto.servico.instalado === 'boolean' ? bruto.servico.instalado : null,
          rodando: typeof bruto.servico.rodando === 'boolean' ? bruto.servico.rodando : null,
          detalhe: bruto.servico.detalhe ? String(bruto.servico.detalhe).slice(0, 200) : null,
          /* CC-453: onde o cockpit mora naquela máquina, dito por ela mesma.
             Teto de 260 como os outros caminhos que chegam pela rede (é o
             limite clássico do Windows, e o mesmo que `servidores.path` usa). */
          raiz: bruto.servico.raiz ? String(bruto.servico.raiz).slice(0, 260) : null,
        }
        : null,
      /* CC-456: rótulo de diagnóstico, e o remetente pode mentir — então o
         `tipo` é recortado contra lista FECHADA, como toda ação da fila. Nome
         desconhecido vira `avulso` em vez de entrar cru: é texto que vai parar
         na tela, e a tela não pode virar eco do que a rede mandou. */
      origem: bruto.origem && typeof bruto.origem === 'object' && !Array.isArray(bruto.origem)
        ? {
          pid: Number(bruto.origem.pid) || null,
          tipo: ['painel', 'reporte', 'avulso'].includes(bruto.origem.tipo) ? bruto.origem.tipo : 'avulso',
        }
        : null,
      em: Number(bruto.em) || Date.now(),
      recebidoEm: Date.now(),
    },
  }
}

/**
 * Escrita atômica, a mesma regra do `meta.json`: leitor concorrente nunca
 * pode pegar arquivo pela metade.
 *
 * **O que o pacote novo não traz é PRESERVADO do anterior**, e isso não é
 * zelo: é a correção de um defeito medido em 19/08. As horas viajam de vez em
 * quando (varrer centenas de MB é caro, então vai a cada 15 minutos), mas o
 * pacote é empurrado a cada 30 segundos. Substituindo o arquivo inteiro, os
 * 29 empurrões seguintes APAGAM as horas que o primeiro trouxe, e a VPS
 * passa 14 minutos e meio de cada 15 sem saber o tempo do PC.
 *
 * O sintoma era exatamente esse: na VPS, `porMaquina` da aba de tempo listava
 * só a máquina local, e o PC aparecia com os agentes mas sem hora nenhuma.
 * O painel do PC dizia "último envio com as horas" e estava certo: o envio
 * teve, o arquivo é que já tinha sido sobrescrito por outro sem.
 *
 * Cada campo preservado carrega o carimbo de quando chegou, porque hora velha
 * exibida como atual é pior que hora ausente.
 */
const CAMPOS_QUE_PERSISTEM = ['tempo', 'uso', 'servidores', 'rotas', 'backlogs', 'travas', 'framework', 'servico']

/**
 * CC-342: validade POR CAMPO, porque 12 horas não serve para todo mundo.
 *
 * `travas` e `framework` ficaram fora da herança no CC-340, de propósito, com o
 * argumento de que o retrato é barato e vai em TODO empurrão. O argumento
 * estava certo e a premissa não: **uma máquina pode ter mais de um empurrador**,
 * e basta um deles rodar versão antiga para o campo ser apagado a cada ciclo.
 *
 * Medido no PC dele em 25/08, minutos depois de subir o recurso: o campo
 * alternava entre 3 projetos e nulo a cada 15 segundos, dois empurradores de
 * 30s defasados. Na tela isso é o controle do framework aparecendo e sumindo
 * sozinho, que foi exatamente a queixa dele.
 *
 * Herdar por 12 horas seria trocar um defeito por outro mais difícil de notar:
 * trava tirada do ar continuando a posar de ativa. Dois minutos atravessam
 * qualquer alternância de empurradores de 30s e ainda deixam o buraco de
 * verdade aparecer no minuto seguinte.
 */
const VALIDADE_POR_CAMPO = { travas: 2 * 60 * 1000, framework: 2 * 60 * 1000, servico: 2 * 60 * 1000 }
export const validadeDe = (campo) => VALIDADE_POR_CAMPO[campo] ?? VALIDADE_HERDADO_MS

/**
 * CC-205: até quando um campo herdado continua valendo.
 *
 * Preservar o que o pacote novo não traz conserta o defeito das horas que
 * sumiam, e cria outro se não tiver fim: se a varredura passar a FALHAR na
 * outra máquina, ela continua empurrando pacotes sem `tempo`, o arquivo
 * continua devolvendo o último `tempo` bom, e a tela mostra as horas de
 * anteontem com a máquina marcada em verde. Ninguém descobre.
 *
 * Doze horas é folgado para o ciclo real (as horas viajam a cada 15 minutos) e
 * curto o bastante para o buraco aparecer no mesmo dia. Passou disso, o campo
 * é descartado: **campo ausente a tela sabe dizer, campo velho ela não.**
 */
export const VALIDADE_HERDADO_MS = 12 * 60 * 60 * 1000

/**
 * CC-204: teto do arquivo gravado, que é diferente do teto do pacote recebido.
 *
 * `LIMITE_PACOTE` mede o que chega pela rede. O arquivo é o que chegou MAIS o
 * que foi herdado do anterior, então ele pode passar do limite sem nenhum
 * pacote ter passado. E é este arquivo que entra no caminho de 2 em 2 segundos.
 *
 * Estourando, os herdados caem primeiro, do mais pesado para o mais leve: o
 * que veio agora é o dado de verdade, e o herdado já era conveniência.
 */
export const LIMITE_ARQUIVO = 4 * 1024 * 1024

export function gravarPacote(pacote) {
  const dir = dirFederacao()
  fs.mkdirSync(dir, { recursive: true })
  const alvo = path.join(dir, `${pacote.maquina.id}.json`)

  let anterior = null
  try { anterior = JSON.parse(fs.readFileSync(alvo, 'utf8')) } catch { /* primeiro pacote desta máquina */ }

  const agora = Date.now()
  const final = { ...pacote }
  const descartados = []
  if (anterior) {
    const idades = { ...(anterior.idades || {}) }
    for (const campo of CAMPOS_QUE_PERSISTEM) {
      if (final[campo] == null && anterior[campo] != null) {
        /* Herdado: mantém a idade que já tinha, ou carimba com a chegada do
           pacote que o trouxe. */
        const desde = idades[campo] ?? anterior.em ?? null
        // CC-205: herdado com prazo. Velho demais some, em vez de posar de novo.
        if (desde && agora - desde > validadeDe(campo)) {
          delete idades[campo]
          descartados.push({ campo, motivo: 'velho', desde })
          continue
        }
        final[campo] = anterior[campo]
        idades[campo] = desde
      } else if (final[campo] != null) {
        idades[campo] = final.em ?? agora
      }
    }
    final.idades = idades
  } else {
    final.idades = Object.fromEntries(
      CAMPOS_QUE_PERSISTEM.filter((c) => final[c] != null).map((c) => [c, final.em ?? agora]),
    )
  }

  /* CC-456: a LISTA de quem empurrou, e é aqui que ela precisa morar.
   *
   * O pacote é sobrescrito a cada 30 segundos, então guardar só a origem do
   * último envio não revela nada: com dois empurradores alternando, cada
   * leitura mostra um, e os dois parecem o mesmo processo trocando de humor.
   * Foi exatamente o que fez a alternância do contrato precisar de SEIS
   * amostras seguidas para aparecer, em 10/09.
   *
   * Guardando os vistos recentemente, a mesma pergunta vira uma leitura só.
   *
   * ⚠️ **A janela é curta (5 min) de propósito.** Empurrador que morreu tem de
   * sumir da lista sozinho, senão o painel acusaria dois para sempre depois de
   * um único dia com dois — e alarme que não some é alarme que ninguém lê. É a
   * mesma razão da validade curta de `travas` e `framework`. */
  const JANELA_EMPURRADORES_MS = 5 * 60 * 1000
  if (final.origem) {
    const vistos = Array.isArray(anterior?.empurradores) ? anterior.empurradores : []
    const chave = (o) => `${o.tipo}:${o.pid}`
    const atual = { ...final.origem, em: agora }
    final.empurradores = [
      ...vistos.filter((v) => agora - (v.em || 0) < JANELA_EMPURRADORES_MS && chave(v) !== chave(atual)),
      atual,
    ].slice(-10)
  }

  /* CC-204: o arquivo tem teto próprio, e ele é medido no que vai para o
     disco. Herdado sai primeiro, começando pelo maior: o que chegou agora é
     dado, o herdado é conveniência. */
  let corpo = JSON.stringify(final)
  if (corpo.length > LIMITE_ARQUIVO) {
    const herdados = CAMPOS_QUE_PERSISTEM
      .filter((c) => pacote[c] == null && final[c] != null)
      .map((c) => ({ campo: c, peso: JSON.stringify(final[c]).length }))
      .sort((a, b) => b.peso - a.peso)
    for (const { campo } of herdados) {
      delete final[campo]
      delete final.idades[campo]
      descartados.push({ campo, motivo: 'arquivo grande demais' })
      corpo = JSON.stringify(final)
      if (corpo.length <= LIMITE_ARQUIVO) break
    }
  }
  if (descartados.length) final.descartados = descartados
  corpo = JSON.stringify(final)

  const tmp = `${alvo}.tmp`
  fs.writeFileSync(tmp, corpo)
  fs.renameSync(tmp, alvo)
  return alvo
}

/* ===================== CC-166: pedidos de uma máquina para outra =====================
 *
 * Pedido dele: abrir uma sessão no desktop a partir do celular, *"daí eu já
 * abro a sessão no app, que é onde eu mais uso"*.
 *
 * ## Por que é pergunta, e não ordem
 *
 * A VPS **nunca** alcança o PC atrás do NAT. Então quem pergunta é sempre o
 * PC: no mesmo ciclo de 30s em que ele já empurra o pacote, ele lê o que
 * ficou guardado para ele. Nenhuma porta nova, nenhum serviço novo.
 *
 * ## O que um pedido pode dizer, e o que não pode
 *
 * Decisão dele em 18/08, escolhendo entre três desenhos: **só projeto que a
 * máquina-alvo já conhece**. Um pedido carrega um NOME de projeto, nunca um
 * comando, nunca um caminho. Quem executa resolve o nome contra a própria
 * lista de projetos e recusa o que não achar.
 *
 * A diferença importa: com comando livre, quem escrevesse na fila da VPS
 * rodaria qualquer coisa no PC do Felipe. Com nome de projeto, o pior caso é
 * abrir uma sessão numa pasta que já era dele.
 *
 * Pedido é de uso único e some ao ser lido: fila que não esvazia reabriria a
 * mesma sessão a cada 30 segundos, para sempre. */

const arquivoPedidos = () => path.join(dirFederacao(), '_pedidos.json')

const lerPedidosBrutos = () => {
  try { return JSON.parse(fs.readFileSync(arquivoPedidos(), 'utf8')) } catch { return [] }
}

const gravarPedidos = (lista) => {
  const dir = dirFederacao()
  fs.mkdirSync(dir, { recursive: true })
  const tmp = `${arquivoPedidos()}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(lista, null, 1))
  fs.renameSync(tmp, arquivoPedidos())
}

/** Pedido velho é pedido que ninguém foi buscar: a máquina estava desligada, e
 *  abrir a sessão horas depois seria surpresa, não serviço. */
export const VALIDADE_PEDIDO_MS = 10 * 60 * 1000

/**
 * Enfileira "abra uma sessão no projeto X" para a máquina Y.
 *
 * `projeto` é um nome, e é higienizado como tal: quem executa ainda vai
 * conferir se conhece esse projeto, mas nada que pareça caminho pode sequer
 * ser gravado aqui.
 */
/**
 * CC-341: o recado passa a ter TIPO, e o segundo tipo é o framework.
 *
 * Queixa dele em 25/08, olhando o cockpit online com o PC ligado ao lado:
 * *"o que eu quero é que na VPS ele reconheça o desktop conectado e funcione na
 * VPS"*. Até aqui a resposta vinha sendo "não dá, a VPS não alcança o PC" — e
 * isso é verdade sobre a REDE e falso sobre o produto: o canal de recado existe
 * desde 18/08 e já resolve o mesmo problema para abrir sessão. Faltava ligar o
 * fio, não inventar topologia.
 *
 * A trava que ele escolheu continua inteira, e é o que separa isto de execução
 * remota: **o recado carrega um NOME de projeto e uma AÇÃO de lista fechada,
 * nunca um comando e nunca um caminho**. Quem executa resolve o nome contra a
 * própria lista de projetos, e a ação contra este mesmo conjunto. O pior caso
 * segue sendo mexer no framework de uma pasta que já era dele.
 *
 * `modo` viaja como texto e **não é validado aqui de propósito**: quem sabe
 * dizer se um modo existe é o motor do framework, do lado que executa. Validar
 * pela metade nos dois lugares é como um apelido de modo passou a desligar as
 * travas em silêncio, em 18/08.
 */
/* CC-434: `recado` é a sexta, e é de espécie diferente das cinco primeiras.
 *
 * As outras MEXEM em algo do outro lado (abrem sessão, ligam trava, trocam
 * modo). Esta só ENTREGA TEXTO: do lado que executa ela vira uma linha em
 * `docs/.recados.json` daquele projeto, e quem lê é o hook do Routia, na
 * próxima ferramenta que o agente de lá usar.
 *
 * ## Por que precisou existir
 *
 * Ele pediu, em 30/08: *"mande um recado pra sessão no pc"*. Eu respondi que o
 * canal não existia, e ele corrigiu: *"como não?! a gente se comunica via
 * hooks"*.
 *
 * Ele tinha razão sobre o mecanismo, eu sobre o alcance, e as duas coisas cabem
 * juntas: os hooks do Routia são mesmo o canal entre sessões, e
 * `docs/.recados.json` está no `.gitignore`, então esse canal morre dentro de
 * UMA máquina. Entre máquinas só atravessava o git, que exige alguém do outro
 * lado dar `pull` — e o aviso de dar pull não podia viajar por ele.
 *
 * Esta fila é a única tubulação viva entre as pontas, e `pegarPedidos` repassa
 * qualquer ação sem consultar esta lista. É o lugar certo.
 *
 * ⚠️ **Ação desconhecida do lado que executa é ignorada com log, sem quebrar.**
 * Medido antes de escrever: o PC com código velho só imprime "ação desconhecida"
 * e segue. Então mandar recado hoje é seguro, e ele passa a chegar de verdade
 * assim que o outro lado baixar — o que o lançador de lá já faz sozinho ao
 * arrancar, porque ele dá `git pull` antes de subir o painel.
 */
/* CC-433 caminho 2, escolhido por ele em 30/08 ("quero"): `framework-mvp` é a
 * sétima, e a segunda que carrega texto que um humano escreveu.
 *
 * A pergunta que originou tudo: *"por que nas versões dos projetos do PC eu não
 * tenho as mesmas configurações que eu tenho nos que estão na VPS, exemplo
 * definição de MVP?"*. O caminho 1 (ver de lá) já está pronto; este é o de
 * ESCREVER de lá, e o custo dele estava registrado como decisão de risco.
 *
 * ⚠️ **Por que isto NÃO afrouxa a trava que a lista fechada protege.** O medo
 * escrito no ticket era a fila virar execução remota. Continua não sendo:
 *
 * - o que viaja é TEXTO que vira DADO num arquivo de estado, nunca comando,
 *   nunca caminho, nunca nome de arquivo;
 * - o projeto continua sendo resolvido por `cwdDoProjeto` do lado que executa,
 *   que só conhece o que aquela máquina já tem;
 * - quem executa RECUSA criar framework onde não existe. Escrever MVP num
 *   projeto sem framework seria ligar o gate de longe, e ligar trava é decisão
 *   de quem senta na máquina.
 *
 * O que ele ganha: definir o pronto de um projeto do PC pelo celular, que era o
 * pedido. O que ele não ganha, de propósito: rodar qualquer coisa.
 */
export const ACOES_DE_PEDIDO = [
  'sessao', 'framework-ligar', 'framework-desligar', 'framework-modo', 'framework-modulo',
  'recado', 'framework-mvp',
  /* CC-447: o botão de sincronizar passa a alcançar a OUTRA máquina.
   *
   * Pergunta dele em 31/08, olhando o vaivém do dia: *"o pc fez algumas coisas
   * e aqui você fez outras, o pc tá dando um pull lá pra gente baixar aqui,
   * atualizar e mandar de volta pra lá, tem ideia melhor?"*.
   *
   * A peça já existia inteira desde o CC-269 (`src/sincronia.mjs`), com as
   * travas certas: não commita, recusa se houver arquivo solto, e roda o gate
   * antes de enviar. O que faltava era alcance — ela só mexia nos projetos da
   * máquina onde alguém clicava. É a peça construída e inalcançável de novo,
   * no formato "alcançável só de onde ninguém está".
   *
   * ⚠️ **Isto NÃO resolve divergência.** `puxar` usa `merge --ff-only` de
   * propósito: quando as duas andaram por caminhos diferentes, ele recusa e
   * devolve "precisa de você". Foi exatamente o caso de 31/08, com 21 commits
   * de um lado contra 1 do outro. O botão remoto serve para o caso comum, que
   * é uma ponta atrás da outra; o encontro de dois trabalhos continua sendo
   * decisão de gente. Prometer mais que isso seria inventar junção sozinho na
   * máquina dele, e é o acidente que este projeto inteiro existe para evitar. */
  'sincronia-puxar', 'sincronia-enviar', 'sincronia-ambos',
]

/** Teto de critérios num pedido de MVP. O maior MVP real deste PC tem 8, e 40 é
 *  o mesmo teto que o retrato usa na volta: os dois lados combinam. */
export const TETO_CRITERIOS = 40

/**
 * O nome do projeto vira CAMINHO do outro lado, então ele é entrada perigosa.
 *
 * ## Por que uma barra passou a ser aceita, em 30/08
 *
 * Print dele com o erro na tela: *"o seu clique não foi gravado: nome de
 * projeto inválido"*, ao trocar o modo do `games/hutukara`. O nome com barra
 * nasceu no mesmo dia, para consertar o projeto que morava dentro de uma pasta
 * que só agrupa, e esta validação o recusava inteiro.
 *
 * ⚠️ **A recusa estava CERTA em existir**, e afrouxá-la sem critério abriria
 * travessia de caminho: com `..` ou barra no começo, o pedido escreveria fora
 * da pasta de projetos da outra máquina. O que muda é o critério, não a
 * proteção.
 *
 * A regra: **no máximo dois segmentos**, cada um com o mesmo alfabeto de antes,
 * nenhum deles `.` ou `..`, sem barra invertida, sem dois pontos, sem barra no
 * começo nem no fim. `games/hutukara` passa; `../etc`, `/etc`, `a/b/c` e
 * `C:\Windows` não.
 */
export function nomeDeProjetoSeguro(nome) {
  const cru = String(nome || '').trim()
  if (!cru || cru.length > 120) return false
  if (/[\\:]/.test(cru)) return false
  if (cru.startsWith('/') || cru.endsWith('/')) return false
  const partes = cru.split('/')
  if (partes.length > 2) return false
  return partes.every((p) => p && p !== '.' && p !== '..' && !/[\0<>|*?"]/.test(p))
}

export function pedirSessao({
  paraMaquina, projeto, de = null, acao = 'sessao', modo = null,
  modulo = null, ligar = null, texto = null, para = null, tipo = null,
  mvp = null,
  now = Date.now(),
}) {
  const alvo = seguro(paraMaquina)
  const nome = String(projeto || '').trim()
  if (!alvo) return { ok: false, erro: 'sem máquina de destino' }
  if (!nomeDeProjetoSeguro(nome)) return { ok: false, erro: 'nome de projeto inválido' }
  if (!ACOES_DE_PEDIDO.includes(acao)) return { ok: false, erro: `ação desconhecida: ${acao}` }
  const modoLimpo = modo ? String(modo).trim().slice(0, 40) : null
  if (modoLimpo && !/^[a-zà-ú-]+$/i.test(modoLimpo)) return { ok: false, erro: 'modo inválido' }
  if (acao === 'framework-modo' && !modoLimpo) return { ok: false, erro: 'trocar de modo exige dizer qual' }

  /* CC-344: ligar ou desligar UM grupo de travas naquele projeto. Mesma regra
     dos outros campos: nome curto, sem pontuação, e quem executa confere contra
     o próprio catálogo. */
  const moduloLimpo = modulo ? String(modulo).trim().slice(0, 40) : null
  if (moduloLimpo && !/^[a-zà-ú-]+$/i.test(moduloLimpo)) return { ok: false, erro: 'trava inválida' }
  if (acao === 'framework-modulo') {
    if (!moduloLimpo) return { ok: false, erro: 'mexer numa trava exige dizer qual' }
    if (typeof ligar !== 'boolean') return { ok: false, erro: 'a trava precisa dizer se liga ou desliga' }
  }

  /* CC-434: o recado é o único pedido que carrega TEXTO LIVRE, então é a única
     entrada aqui que um humano escreve por extenso. Três cortes, e nenhum deles
     tenta adivinhar conteúdo:

     - o TAMANHO é limitado aqui e de novo do lado que grava (600), porque quem
       executa não pode depender de quem pede ter limitado;
     - o DESTINATÁRIO é id curto de sessão ou `todos`, e nada mais: ele vira
       comparação de igualdade lá, nunca caminho;
     - o TIPO viaja como texto e é conferido contra o catálogo do lado que
       executa, pela mesma razão que o modo: validar pela metade nos dois
       lugares foi como um apelido desligou trava em silêncio em 18/08.

     O que NÃO viaja: `arquivo`. Ele é caminho, e caminho vindo da rede é a
     entrada perigosa que `nomeDeProjetoSeguro` existe para conter. Quem grava
     do outro lado põe `null` fixo. */
  const textoLimpo = texto == null ? null : String(texto).replace(/\s+/g, ' ').trim().slice(0, 600)
  const paraLimpo = para == null ? null : String(para).trim().slice(0, 12)
  const tipoLimpo = tipo == null ? null : String(tipo).trim().slice(0, 20)
  if (paraLimpo && paraLimpo !== 'todos' && !/^[0-9a-z]{4,12}$/i.test(paraLimpo)) {
    return { ok: false, erro: 'destinatário inválido' }
  }
  if (tipoLimpo && !/^[a-z_]+$/i.test(tipoLimpo)) return { ok: false, erro: 'tipo de recado inválido' }
  if (acao === 'recado' && !textoLimpo) return { ok: false, erro: 'recado sem texto' }

  /* CC-433: o MVP que ele define de outra máquina. Texto que vira DADO, com os
     mesmos cortes do retrato que volta, para os dois lados combinarem.
     `feito` é booleano de verdade e não o que vier: uma string "false" marcaria
     o critério como pronto, e critério pronto por acidente é a coisa que este
     framework inteiro existe para não deixar acontecer. */
  let mvpLimpo = null
  if (mvp != null) {
    if (typeof mvp !== 'object' || Array.isArray(mvp)) return { ok: false, erro: 'MVP tem que ser um objeto' }
    mvpLimpo = {
      nome: String(mvp.nome || '').replace(/\s+/g, ' ').trim().slice(0, 300),
      criterios: (Array.isArray(mvp.criterios) ? mvp.criterios : [])
        .slice(0, TETO_CRITERIOS)
        .map((c) => ({
          texto: String(c?.texto || '').replace(/\s+/g, ' ').trim().slice(0, 300),
          feito: c?.feito === true,
        }))
        .filter((c) => c.texto),
    }
  }
  if (acao === 'framework-mvp') {
    if (!mvpLimpo) return { ok: false, erro: 'definir o MVP exige mandar o MVP' }
    if (!mvpLimpo.nome && !mvpLimpo.criterios.length) {
      /* Pedido vazio apagaria o MVP do projeto do outro lado, sem ninguém
         perceber, e ele não teria como saber que apagou. Apagar tem que ser um
         gesto declarado, e este não é o caminho para isso. */
      return { ok: false, erro: 'MVP vazio: diga o nome ou pelo menos um critério' }
    }
  }

  const lista = lerPedidosBrutos().filter((p) => now - (p.em || 0) < VALIDADE_PEDIDO_MS)
  /* Mesmo projeto pedido duas vezes seguidas é dedo duplo no botão, não duas
     sessões. Abrir duas sem querer é o desperdício que a própria tela avisa.
     A AÇÃO entra na comparação: querer abrir sessão e mexer no framework do
     mesmo projeto no mesmo minuto é pedido legítimo, e sem isto o segundo seria
     engolido como se fosse dedo duplo. */
  /* A TRAVA entra na chave junto da ação, pela mesma razão que a ação entrou:
     mexer em duas travas diferentes do mesmo projeto são dois pedidos, e sem
     isto o segundo seria engolido como dedo duplo. */
  /* CC-434: o TEXTO entra na chave junto da ação e da trava, pela mesma razão
     que elas entraram. Dois recados diferentes para o mesmo projeto no mesmo
     minuto são duas mensagens, não dedo duplo, e sem isto a segunda seria
     engolida em silêncio — que é o pior jeito de perder um aviso. Recado
     idêntico repetido continua sendo dedo duplo, e esse a chave pega. */
  if (lista.some((p) => p.paraMaquina === alvo && p.projeto === nome
    && (p.acao || 'sessao') === acao && (p.modulo || null) === moduloLimpo
    && (p.texto || null) === textoLimpo)) {
    return { ok: true, jaPedido: true }
  }
  lista.push({
    id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    paraMaquina: alvo, projeto: nome, de, acao, modo: modoLimpo,
    modulo: moduloLimpo, ligar: typeof ligar === 'boolean' ? ligar : null,
    texto: textoLimpo, para: paraLimpo, tipo: tipoLimpo, mvp: mvpLimpo, em: now,
  })
  gravarPedidos(lista)
  return {
    ok: true, projeto: nome, paraMaquina: alvo, acao,
    modo: modoLimpo, modulo: moduloLimpo, texto: textoLimpo, para: paraLimpo,
    mvp: mvpLimpo,
  }
}

/**
 * Os pedidos de uma máquina, e a leitura os CONSOME.
 *
 * Some ao ser lido de propósito: fila que não esvazia reabriria a mesma sessão
 * a cada ciclo de 30 segundos, para sempre. O preço é que uma falha de rede
 * entre ler e executar perde o pedido, e esse é o lado certo de errar: pedido
 * perdido custa um clique, pedido repetido custa uma sessão fantasma por
 * ciclo.
 */
export function pegarPedidos(maquina, now = Date.now()) {
  const alvo = seguro(maquina)
  if (!alvo) return []
  const todos = lerPedidosBrutos()
  const meus = todos.filter((p) => p.paraMaquina === alvo && now - (p.em || 0) < VALIDADE_PEDIDO_MS)
  if (!meus.length) {
    /* Aproveita para varrer o que venceu, mas só grava se algo mudou: escrita
       a cada 30 segundos por máquina, sem motivo, é disco à toa. */
    const vivos = todos.filter((p) => now - (p.em || 0) < VALIDADE_PEDIDO_MS)
    if (vivos.length !== todos.length) gravarPedidos(vivos)
    return []
  }
  gravarPedidos(todos.filter((p) => !meus.includes(p) && now - (p.em || 0) < VALIDADE_PEDIDO_MS))
  return meus
}

/** Só para a tela e para o teste: o que está na fila, sem consumir. */
export const pedidosPendentes = (now = Date.now()) =>
  lerPedidosBrutos().filter((p) => now - (p.em || 0) < VALIDADE_PEDIDO_MS)

/** O que as outras máquinas mandaram. Arquivo corrompido é ignorado, nunca
 *  derruba a leitura das demais. */
export function lerPacotes(now = Date.now()) {
  const dir = dirFederacao()
  let arquivos = []
  try {
    /* O `_` na frente marca o que é da casa e não é pacote de máquina
       (`_pedidos.json`, do CC-166). O `if (!p?.maquina?.id)` abaixo já
       descartaria, mas por acidente: quem lesse isto depois não teria como
       saber que existe outro arquivo nesta pasta de propósito. */
    arquivos = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !f.startsWith('_'))
  } catch {
    return []
  }
  const pacotes = []
  for (const f of arquivos) {
    try {
      const p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
      if (!p?.maquina?.id) continue
      const idade = now - (p.recebidoEm || p.em || 0)
      pacotes.push({ ...p, idadeMs: idade, semContato: idade > SEM_CONTATO_MS })
    } catch { /* pacote quebrado não pode cegar o painel inteiro */ }
  }
  return pacotes.sort((a, b) => a.maquina.nome.localeCompare(b.maquina.nome))
}

/**
 * Carimba a origem numa lista local. Feito na leitura, e não na gravação, para
 * o dado em disco continuar do jeito que sempre foi: renomear a máquina não
 * pode exigir reescrever histórico.
 */
export const carimbar = (lista, origem) =>
  (Array.isArray(lista) ? lista : []).map((x) => ({ ...x, origem }))

/**
 * Junta local com remoto.
 *
 * A chave é `origem.id + id`, nunca só `id`: duas máquinas podem ter job com o
 * mesmo identificador curto, e o de uma sobrescreveria o da outra em silêncio.
 */
export function mesclar(locais, pacotes, origemLocal, campo = 'jobs') {
  const fora = pacotes.flatMap((p) =>
    carimbar(p[campo], { ...p.maquina, idadeMs: p.idadeMs, semContato: p.semContato }))
  const tudo = [...carimbar(locais, { ...origemLocal, idadeMs: 0, semContato: false }), ...fora]

  const vistos = new Set()
  return tudo.filter((x) => {
    const chave = `${x.origem?.id}:${x.id ?? x.pid ?? JSON.stringify(x).slice(0, 40)}`
    if (vistos.has(chave)) return false
    vistos.add(chave)
    return true
  })
}

/**
 * Soma a aba tempo das várias máquinas, por projeto.
 *
 * O Felipe pediu "os dados de todos os meus dispositivos, somados, e eu poder
 * filtrar pra separar o que é da VPS e o que é deste desktop". Some-se o que é
 * físico (horas e tokens) e guarde-se a quebra por origem, que é o que o filtro
 * usa e o que responde "onde eu trabalhei mais".
 *
 * O que NÃO é somado, de propósito: dinheiro. `valor`, `custoReal` e `sobra`
 * saem da taxa e da assinatura, que moram no config de CADA máquina e podem
 * divergir. Somar dois números calculados com tabelas diferentes daria um total
 * que não é de ninguém. Eles são recalculados na máquina que exibe, sobre as
 * horas já somadas.
 */
export function mesclarTempo(local, pacotes, origemLocal) {
  const porProjeto = new Map()

  const juntar = (resumo, origem) => {
    for (const p of resumo?.projetos || []) {
      const atual = porProjeto.get(p.projeto) || {
        /* Os campos que a tela formata precisam EXISTIR, mesmo quando o
           projeto só é conhecido pela outra máquina.

           O pacote que viaja é enxuto de propósito (só projeto, horas e
           tokens: `dias` e `sessoes` são o que engorda). Um projeto que nunca
           rodou aqui nascia sem `custo`, `taxaHora` e `diasTrabalhados`, e a
           tela de tempo quebrava inteira ao formatar o primeiro deles, com
           `Cannot read properties of undefined (reading 'toFixed')`.

           O sintoma não parecia erro: a aba ficava para sempre em "lendo os
           transcritos", porque o desenho morria antes de escrever qualquer
           coisa. Foi assim que a tela de tempo da VPS nunca funcionou desde
           que existe federação, sem ninguém ver uma mensagem de erro. */
        taxaHora: 0, taxaPropria: false,
        dias: [], sessoes: [], uso: [], usoDias: [],
        ...p,
        /* Tudo o que é SOMADO abaixo nasce zerado DEPOIS do spread. Ficando
           antes, o spread devolvia o valor de `p` para dentro e a soma logo
           abaixo contava a mesma quantia duas vezes: `custo` e `custoBrl`
           saíam DOBRADOS em todo projeto de toda máquina, com ou sem
           federação. É a mesma razão de `ativoMs` e `tokens` já estarem
           aqui, e eu tinha colocado os novos do lado errado. */
        ativoMs: 0, tokens: 0, custo: 0, custoBrl: null,
        diasTrabalhados: 0, diasSomados: 0, diasIncerto: false,
        porMaquina: [],
        // zerados: quem exibe recalcula com a própria taxa
        valor: 0, custoReal: null, sobra: null,
      }
      atual.ativoMs += p.ativoMs || 0
      atual.tokens += p.tokens || 0
      /* Custo só existe no resumo de quem calculou (a máquina local); o pacote
         não carrega. Somar o que vier, tratando ausência como zero, mantém o
         total honesto sem inventar preço para a máquina remota. */
      atual.custo = (atual.custo || 0) + (p.custo || 0)
      if (p.custoBrl != null) atual.custoBrl = (atual.custoBrl || 0) + p.custoBrl
      /* CC-206: `diasTrabalhados` some com as horas e o número não bate.
       *
       * As horas SOMAM as duas máquinas; os dias vinham de `Math.max`, que é o
       * número de UMA delas. Com 10 dias no PC e 3 na VPS, a divisão punha as
       * horas das duas dentro dos 10 dias do PC, e "horas por dia" saía inflada.
       *
       * O certo seria a união dos dias de calendário, e ela não existe aqui: o
       * pacote carrega a contagem, nunca a lista. Então o que se guarda é a
       * FAIXA em que a resposta certa mora, com o `max` como piso (nenhuma
       * máquina sozinha trabalhou mais dias que isso) e a soma como teto (o
       * caso em que nenhum dia coincide). Quem exibe decide o que fazer com a
       * incerteza; o que não pode é ela sumir e virar um número exato falso. */
      if (p.diasTrabalhados) {
        atual.diasTrabalhados = Math.max(atual.diasTrabalhados || 0, p.diasTrabalhados)
        atual.diasSomados = (atual.diasSomados || 0) + p.diasTrabalhados
        atual.diasIncerto = atual.diasSomados > atual.diasTrabalhados
      }
      atual.porMaquina.push({ maquina: origem, ativoMs: p.ativoMs || 0, tokens: p.tokens || 0 })
      porProjeto.set(p.projeto, atual)
    }
  }

  juntar(local, origemLocal)
  for (const pac of pacotes) {
    /* A idade do TEMPO é própria, e não a do pacote: as horas viajam a cada 15
       minutos e ficam guardadas entre um envio e outro, então um pacote de 10
       segundos atrás pode carregar hora de 14 minutos. Dizer a idade do pacote
       aqui faria a tela afirmar que o número é mais fresco do que é. */
    if (pac.tempo) {
      const em = pac.idades?.tempo ?? pac.em
      juntar(pac.tempo, {
        ...pac.maquina,
        idadeMs: Number.isFinite(em) ? Date.now() - em : pac.idadeMs,
        semContato: pac.semContato,
      })
    }
  }

  const projetos = [...porProjeto.values()].sort((a, b) => b.ativoMs - a.ativoMs)
  return { ...(local || {}), projetos, federado: pacotes.some((p) => p.tempo) }
}

/** As máquinas conhecidas, para montar o filtro do topo. A local vem primeiro:
 *  é a que o Felipe está olhando. */
/**
 * CC-48: as rotas ocupadas em TODAS as máquinas, por projeto.
 *
 * A resposta que o `rota-guard` precisa antes de liberar uma rota: ela pode
 * estar livre no quadro daqui e ocupada por uma sessão do outro lado que ainda
 * não commitou.
 *
 * ⚠️ **Rota ocupada em qualquer máquina conta como ocupada.** Na dúvida entre
 * bloquear demais e deixar duas sessões se pisarem, bloquear demais custa uma
 * mensagem; a colisão custa trabalho perdido. O `veredito` acompanha para quem
 * lê decidir — órfã do outro lado continua sendo órfã.
 */
export function rotasDeTodos(locais = [], pacotes = [], origemLocal = 'local') {
  const porProjeto = new Map()

  const juntar = (quadros, origem, idade = 0) => {
    for (const q of quadros || []) {
      if (!q?.projeto) continue
      const lista = porProjeto.get(q.projeto) || []
      for (const o of q.ocupadas || []) {
        // mesma rota reportada pelas duas máquinas: fica a de sinal mais novo
        const igual = lista.find((x) => x.rota === o.rota && x.id === o.id)
        if (igual) {
          if ((o.ultimoSinal || 0) > (igual.ultimoSinal || 0)) Object.assign(igual, o, { origem, idade })
          continue
        }
        lista.push({ ...o, origem, idade })
      }
      porProjeto.set(q.projeto, lista)
    }
  }

  juntar(locais, origemLocal)
  for (const p of pacotes) juntar(p.rotas, p.maquina?.nome || p.maquina?.id || 'remota', p.idade)

  return Object.fromEntries(porProjeto)
}

export function maquinasConhecidas(pacotes, origemLocal, retratoLocal = null) {
  return [
    /* CC-340: a máquina local entra com o MESMO retrato das remotas.
       Ficou de fora na primeira rodada e o defeito foi visível na hora: a tela
       dizia "não sabe reportar" sobre a própria máquina em que estava rodando.
       Sem os dois lados no mesmo formato não há comparação, e comparar é a
       única coisa que a pergunta dele pedia. Vem de fora porque este módulo é
       puro: quem chama é que tem licença para tocar em disco. */
    {
      ...origemLocal,
      local: true,
      idadeMs: 0,
      semContato: false,
      travas: retratoLocal?.travas ?? null,
      framework: retratoLocal?.framework ?? null,
    },
    ...pacotes.map((p) => ({
      ...p.maquina,
      local: false,
      idadeMs: p.idadeMs,
      semContato: p.semContato,
      /* CC-263: onde o projeto mora NAQUELA máquina, tirado do que ela mesma
         reportou. É o que permite a tela montar o comando de instalar o serviço
         com o caminho certo, em vez de chutar um `D:\...` que pode não existir.
         `null` quando a máquina nunca rodou um agente lá dentro. */
      /* CC-453: a máquina DIZ onde o cockpit dela está, e isso vem primeiro.
         A busca por texto abaixo é a versão original, de quando não havia como
         perguntar, e ela estava quebrada desde 23/08: procurava
         `proj_controlcenter`, nome que a pasta deixou de ter quando ele tirou o
         prefixo de tipo. Devolvia `null` sempre, e o cartão de instalar o
         serviço sumia da tela sem erro nenhum — peça construída e inalcançável,
         o formato de defeito que este projeto mais repete.
         Ela FICA, e não como zelo: máquina rodando versão anterior a hoje não
         manda `servico.raiz`, e para essas o palpite velho ainda é melhor que
         nada. Some sozinha quando as duas pontas estiverem em dia. */
      raizDoCockpit: p.servico?.raiz
        || (p.jobs || []).map((j) => j.cwd).find((c) => c && /proj_controlcenter/i.test(c))
        || null,
      /* Quais ferramentas existem lá, para a tela não oferecer o que não há. */
      agentes: p.agentes || null,
      /* CC-340: as travas e o framework daquela máquina, para a tela poder
         responder "os ganchos estão registrados lá?" em vez de deixar a
         pergunta sem dono. `null` é máquina que ainda não sabe reportar (versão
         antiga do outro lado), e a tela precisa distinguir isso de "nenhuma
         trava registrada" — são conclusões opostas sobre o mesmo silêncio. */
      travas: p.travas || null,
      framework: p.framework || null,
      /* CC-345: o resumo dos backlogs daquela máquina, que já viajava no pacote
         e parava aqui. Sem ele o "ver tudo" de um projeto de fora só sabia
         dizer "não achei a pasta", porque tentava ler o disco DESTA máquina
         um projeto que mora em outra. */
      backlogs: p.backlogs || null,
    })),
  ]
}

/**
 * Monta o que ESTA máquina manda para o servidor.
 *
 * Recebe os dados prontos em vez de ir buscá-los: mantém o módulo testável e
 * evita que a montagem do pacote dispare, sem querer, a varredura de 800 MB da
 * aba tempo dentro do tique de 2 segundos.
 */
/**
 * CC-48: as rotas viajam no pacote, e por isso deixam de esperar commit.
 *
 * Antes, marcar rota no PC só chegava na VPS depois de commit, push e pull —
 * latência e ruído justamente no arquivo mais disputado, que foi a queixa do
 * Felipe ("a gente faz muitos testes internos"). O quadro em markdown continua
 * sendo a verdade legível e versionada; o que muda é **o canal**.
 *
 * Vai só o essencial de cada rota ocupada, nunca o arquivo inteiro: o quadro do
 * inovallbond passa de 60 KB, quase todo histórico de rota fechada, e o limite
 * de pacote é 2 MB para a federação inteira.
 */
/* CC-449: `null` entra e `null` sai, em vez de estourar.
   Desde que ausente deixou de virar lista vazia na validação, "não consegui ler
   os quadros" é um valor que a montagem precisa saber carregar: o remetente que
   não pôde varrer manda ausente, e a outra ponta herda o que já tinha. Sem esta
   linha, o mesmo caso derruba a montagem do pacote INTEIRO, e a máquina some do
   painel por causa de um campo. */
export const enxugarRotas = (quadros) => (quadros == null ? null : quadros
  .filter((q) => q?.projeto)
  .map((q) => ({
    projeto: q.projeto,
    ocupadas: (q.ocupadas || []).map((o) => ({
      rota: o.rota, id: o.id, ultimoSinal: o.ultimoSinal, veredito: o.veredito,
    })),
  })))

/**
 * CC-165: o backlog de cada projeto, reduzido ao que cabe numa tela.
 *
 * Pedido dele ao desenhar o serviço: *"fazendo uma varredura nos projetos
 * onlines e nos seus backlogs"*. Até aqui o pacote levava agentes, uso e
 * horas, nunca o que cada projeto tem para fazer, então a VPS sabia QUEM
 * estava trabalhando e nunca EM QUÊ.
 *
 * ## O que viaja, e o que fica
 *
 * **Nunca o TEXTO do `ROADMAP.md`**, e a razão é o CC-161: o arquivo viaja pelo
 * git, que é o transporte com histórico e resolução de conflito. Mandar o
 * conteúdo aqui criaria uma segunda cópia, mais nova ou mais velha que a do git
 * dependendo do dia, e ninguém saberia qual vale. **Esta regra continua
 * valendo.** O que viaja é o MAPA lido do arquivo, que é leitura derivada e não
 * disputa a fonte com o git.
 *
 * Medido em 19/08: ler o roadmap dos 23 projetos custa **14ms**, então isto
 * cabe no ciclo sem o cuidado que as horas exigiram.
 *
 * ## CC-440, 30/08: de contagem para o mapa inteiro
 *
 * Até aqui viajavam a contagem e SEIS títulos por projeto, e o comentário
 * original dizia o porquê: *"quem quiser a lista inteira abre o projeto, onde o
 * arquivo está por completo"*. Isso pressupõe que quem olha está na mesma
 * máquina. **Da VPS ele não tem como abrir**, e a queixa dele foi exatamente
 * essa: *"não tenho acesso a todos os formatos (…) dos projetos do PC quando
 * vou ver lá no cockpit na VPS"*.
 *
 * Medido antes de mudar, no PC dele: **581 frentes e 621 itens** nos projetos
 * daqui. O que viajava eram **5 KB**; o mapa inteiro custa **170 KB**, contra um
 * teto de 2.048 KB. Cabe com margem de doze vezes, então o corte de seis nunca
 * foi limitação técnica: foi escolha de quando o consumidor era a tela local.
 */
/**
 * Teto por projeto, e o número saiu da medição, não de um palpite redondo.
 *
 * Medido no PC dele em 30/08: 581 frentes nos 11 projetos com roadmap, e a
 * distribuição é torta. O `cockpit` sozinho tem **292**; o segundo maior tem 77.
 * Um teto de 200 pareceria generoso e cortaria justamente o projeto que ele mais
 * olha, que é o pior resultado possível.
 *
 * 600 cobre o maior de hoje com o dobro de folga, e ainda impede que um arquivo
 * estranho encha o pacote sozinho. Com o mapa inteiro dos 11, o campo custa 170
 * KB contra um teto de 2.048 KB.
 */
export const TETO_FRENTES = 600

export function resumirBacklogs(mapas = []) {
  return mapas
    .filter((m) => m && m.mapa)
    .map(({ projeto, mapa }) => {
      const grupos = mapa.grupos || []
      const frentes = grupos.flatMap((g) => (g.frentes || []).map((f) => ({ ...f, grupo: g.titulo })))
      const abertas = frentes.filter((f) => f.estado !== 'feito')
      return {
        projeto,
        atualizadoEm: mapa.atualizadoEm || null,
        frentes: frentes.length,
        abertas: abertas.length,
        /* Mantido: era o campo inteiro até 30/08, e alguma tela pode estar
           lendo dele. Campo que some é tela que quebra sem erro. */
        titulos: abertas.slice(0, 6).map((f) => f.titulo),

        /* CC-440: o mapa de verdade, e não só a contagem.
           Condição dele em 30/08: *"é importante que as informações que o pc
           passe pra vps sejam as mais ricas possíveis pra gente ter controle
           dos projetos, das tarefas, das sprints, roadmaps, enfim, tudo"*. */
        sprints: grupos.slice(0, TETO_FRENTES).map((g) => ({
          titulo: String(g.titulo || '').slice(0, 200),
          estado: g.estado || null,
          frentes: (g.frentes || []).length,
          itens: g.itens ?? null,
          feitos: g.feitos ?? null,
        })),
        lista: frentes.slice(0, TETO_FRENTES).map((f) => ({
          titulo: String(f.titulo || '').slice(0, 200),
          grupo: String(f.grupo || '').slice(0, 200),
          estado: f.estado || null,
          itens: f.itens ?? null,
          feitos: f.feitos ?? null,
          peso: f.peso ?? null,
          /* A citação é o que dá sentido à frente para ele, porque são as
             palavras dele. Cortada, porque uma fala longa multiplicada por 581
             frentes seria a maior parte do pacote. */
          citacao: f.citacao ? String(f.citacao).slice(0, 300) : null,
        })),
        /* Cortar em silêncio faria a VPS mostrar 200 de 400 sem ninguém saber,
           que é o mesmo formato de defeito de campo vazio contra campo ausente. */
        cortado: frentes.length > TETO_FRENTES,
      }
    })
}

/**
 * CC-263: o pacote passou a levar TUDO que a máquina sabe.
 *
 * Escolha dele em 21/08: *"quero tudo, os limites do agy e do opencode se
 * possível, e o que mais os agentes puderem compartilhar de dados pra deixar o
 * cockpit bem completo"*.
 *
 * Os três campos novos, e por que cada um:
 *
 * - `meu`: a lista de tarefas DELE daquela máquina. Sem isso cada máquina tem a
 *   sua, e as do PC ele nunca via daqui. É o mesmo defeito do gasto do plano,
 *   noutra roupa.
 * - `agentes`: o que o agy e o opencode estão fazendo lá, junto do Claude. Ele
 *   citou o agy no pedido, e um cockpit que só enxerga uma das três ferramentas
 *   mostra um terço do trabalho.
 * - `limites`: o teto de cada ferramenta naquela máquina, quando ela souber
 *   dizer. `null` é resposta legítima e diferente de zero.
 *
 * O `LIMITE_PACOTE` de 2 MB continua valendo, e agora tem mais o que caber:
 * campo novo entra enxuto, e o que não couber é cortado por quem monta, nunca
 * silenciosamente aqui.
 */
/**
 * CC-456: QUEM empurrou este pacote.
 *
 * ## Por que existe
 *
 * Uma máquina pode ter mais de um empurrador, e isso não é hipótese: é a causa
 * do CC-342 (o retrato piscando na tela dele) e do CC-451. O problema é que
 * **até hoje não havia como perguntar**, só como deduzir — e a dedução exigia
 * seis amostras seguidas vendo o número do contrato alternar entre `0` e `1`.
 *
 * Pior: em 10/09 eu fechei o CC-451 como resolvido medindo as PORTAS em escuta
 * no PC, achei uma só, e concluí que havia um empurrador só. **A medida estava
 * certa e a conclusão errada**: o segundo empurrador é o serviço instalado, que
 * roda `cc reportar` e, nas palavras do próprio código, "empurra e não abre
 * tela". Contar tela nunca ia achá-lo.
 *
 * ## Como sabe qual é qual
 *
 * Os dois caminhos chamam a MESMA `empurrar()` em `web.mjs`, então não dá para
 * distinguir por função. O que os separa é a linha de comando que subiu o
 * processo, e é ela que se lê aqui. Fica dentro deste arquivo de propósito:
 * assim `montarPacote` se identifica sozinho, e nenhum chamador precisa mudar
 * (o de `web.mjs`, o de `cc.mjs` e os dos testes seguem iguais).
 *
 * ## O que NÃO fazer com isto
 *
 * Não é identidade de máquina nem credencial: é rótulo de diagnóstico, e o
 * remetente pode mentir. Serve para a tela dizer "dois empurradores aqui", e
 * nunca para decidir se um pacote vale.
 */
export function origemDoEmpurrao() {
  const linha = (process.argv || []).join(' ')
  const tipo = /\breportar\b/.test(linha) ? 'reporte'
    : /--web-only|\bweb\b|--port\b/.test(linha) ? 'painel'
      : 'avulso'
  return { pid: process.pid || null, tipo }
}

export function montarPacote({
  maquina, jobs = [], servidores = [], uso = null, tempo = null, rotas = [], backlogs = null,
  meu = null, agentes = null, limites = null, travas = null, framework = null, servico = null,
}) {
  const enxuto = jobs.map((j) => ({
    id: j.id, status: j.status, subject: j.subject, project: j.project, sub: j.sub,
    route: j.route, frente: j.frente, model: j.model, tokens: j.tokens, tipo: j.tipo || 'background',
    remoto: j.remoto || false, todos: j.todos, todosDone: j.todosDone, blockers: j.blockers,
    detail: j.detail, createdAt: j.createdAt, updatedAt: j.updatedAt, cwd: j.cwd,
    lastPrompt: j.lastPrompt, entregueEmAberto: j.entregueEmAberto, sinais: j.sinais,
  }))
  return {
    /* CC-440: primeiro campo do pacote, de propósito. Quem for depurar isto
       lendo o JSON cru vê o formato antes de tentar entender o conteúdo. */
    contrato: CONTRATO,
    maquina, jobs: enxuto, servidores, uso, tempo, rotas: enxugarRotas(rotas), backlogs,
    /* Campo ausente e campo vazio são coisas diferentes na federação: `null`
       quer dizer "esta máquina não sabe dizer", e `[]` quer dizer "sabe, e não
       tem nenhum". A tela precisa dos dois para não inventar. */
    meu, agentes, limites,
    /* CC-340: quais travas valem naquela máquina, e em que estado o framework
       de cada projeto está lá.
       Fora de `CAMPOS_QUE_PERSISTEM` de propósito, e é decisão, não esquecimento:
       o retrato é barato e vai em TODO empurrão, então campo ausente quer dizer
       "esta máquina roda versão que ainda não sabe reportar". Herdando o
       anterior por 12 horas, uma trava tirada do ar continuaria aparecendo como
       ativa, que é exatamente o engano que o campo existe para acabar. */
    travas, framework,
    /* CC-452: instalado/rodando/detalhe do serviço de fundo nesta máquina.
       Mesma regra do retrato (travas/framework): barato, calculado sozinho a
       cada empurrão, `null` quando a máquina não sabe dizer (nunca `false` —
       "não sei" e "não está instalado" levam a conclusões opostas). */
    servico,
    /* CC-456: quem empurrou. Calculado aqui, não recebido por parâmetro, para
       nenhum chamador precisar mudar — e porque quem sabe qual processo é este
       é este processo. FORA de `CAMPOS_QUE_PERSISTEM` de propósito: herdar
       origem apagaria justamente a alternância que o campo existe para revelar. */
    origem: origemDoEmpurrao(),
    em: Date.now(),
  }
}

/**
 * Empurra o pacote para o servidor. Nunca lança: se a rede cair, o painel local
 * segue inteiro e a próxima tentativa resolve.
 */
export async function enviar({ enviarPara, token, pacote }) {
  if (!enviarPara || !token) return { ok: false, erro: 'federação não configurada' }
  const corpo = JSON.stringify(pacote)
  if (corpo.length > LIMITE_PACOTE) return { ok: false, erro: 'pacote grande demais' }
  try {
    const r = await fetch(`${enviarPara}/api/federacao`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-cc-token': token },
      body: corpo,
      signal: AbortSignal.timeout(10_000),
    })
    /* O CORPO da resposta importa desde o CC-166: é por ele que voltam os
       pedidos guardados para esta máquina, e é a única direção possível
       (o servidor nunca alcança quem está atrás de NAT). Até 19/08 esta
       função devolvia só `ok` e `status`, então o pedido chegava e era
       descartado aqui, sem erro nenhum — o envio dizia 200 e nada acontecia
       do outro lado. Resposta sem JSON válido não é problema: o servidor
       pode ser uma versão antiga, e aí simplesmente não há pedido. */
    let corpoResposta = null
    try { corpoResposta = await r.json() } catch { /* servidor antigo ou resposta vazia */ }
    return { ok: r.ok, status: r.status, ...(corpoResposta && typeof corpoResposta === 'object' ? corpoResposta : {}) }
  } catch (e) {
    return { ok: false, erro: String(e?.message || e) }
  }
}
