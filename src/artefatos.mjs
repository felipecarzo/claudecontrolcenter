// CC-927: os artefatos de engenharia que um sprint pede (MER, mapa de telas e afins).
// O sprint lista o que vai ser criado e por que importa; o agente produz antes do
// código que depende deles. Nada é gravado: tudo sai do texto dos itens do sprint
// e de olhar se o arquivo já existe no projeto.

import fs from 'node:fs'
import path from 'node:path'

const sem = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const textoDe = (i) => sem([i.titulo, i.intencao, i.pronto].filter(Boolean).join(' '))

const MUITOS_NOVOS = 5 // ponytail: corte fixo; calibrar quando houver sprint real com casos de uso pedidos

/** `quando(item)` diz se o item pede o artefato; `quandoSprint(itens)` devolve os ids quando a regra é do sprint inteiro. */
export const CATALOGO = [
  {
    id: 'mer', nome: 'MER (modelo das tabelas)', arquivo: 'docs/engenharia/MER.md',
    porque: 'mostra quais tabelas o banco tem e como se ligam; sem ele cada trecho do código inventa o seu formato de dado',
    quando: (i) => /\b(banco|tabelas?|cadastr\w*|guardar|guarda|salvar|salva)\b/.test(textoDe(i)),
  },
  {
    id: 'mapa-de-telas', nome: 'Mapa de telas', arquivo: 'docs/engenharia/MAPA-DE-TELAS.md',
    porque: 'lista as telas e o caminho entre elas; evita tela órfã e botão que não leva a lugar nenhum',
    quando: (i) => i.area === 'tela',
  },
  {
    id: 'contrato-das-rotas', nome: 'Contrato das rotas', arquivo: 'docs/engenharia/CONTRATO-DAS-ROTAS.md',
    porque: 'diz o que cada endereço do servidor recebe e devolve; a tela e o servidor deixam de discordar do formato',
    quando: (i) => /\b(apis?|endpoints?)\b|\brotas? (http|da api|de api|do servidor)\b|\/api\//.test(textoDe(i)),
  },
  {
    id: 'casos-de-uso', nome: 'Casos de uso', arquivo: 'docs/engenharia/CASOS-DE-USO.md',
    porque: 'diz quem faz o que no sistema; é o que impede construir bem uma coisa que ninguém pediu',
    quando: (i) => /\b(produto novo|novo produto|do zero|requisitos)\b/.test(textoDe(i)),
    quandoSprint: (itens) => (itens.filter((i) => i.natureza === 'PED').length >= MUITOS_NOVOS ? itens.filter((i) => i.natureza === 'PED').map((i) => i.id) : []),
  },
  {
    id: 'modelo-de-ameacas', nome: 'Modelo de ameaças', arquivo: 'docs/engenharia/MODELO-DE-AMEACAS.md',
    porque: 'lista o que pode dar errado em segurança antes de existir o login, o pagamento ou o dado de pessoa',
    quando: (i) => /\b(login|senhas?|autentic\w*|pagamentos?|cobranca|cartao|pix|upload|cpf|lgpd|dados? (de |da )?pessoa\w*)\b/.test(textoDe(i)),
  },
  {
    id: 'diagrama-de-sequencia', nome: 'Diagrama de sequência', arquivo: 'docs/engenharia/DIAGRAMA-DE-SEQUENCIA.md',
    porque: 'desenha quem chama quem, e em que ordem, quando dois sistemas conversam; é onde a integração costuma quebrar',
    quando: (i) => /\b(integra\w*|webhooks?|servicos? externos?|gateway)\b/.test(textoDe(i)),
  },
]

/** Os artefatos que os itens (abertos) de um sprint pedem, com o que já existe em `raiz`. */
export function artefatosDoSprint(itensDoSprint, raiz) {
  const itens = (itensDoSprint || []).filter((i) => i && i.estado !== 'OK' && i.estado !== 'KO')
  const out = []
  for (const a of CATALOGO) {
    const ids = new Set(itens.filter(a.quando).map((i) => i.id))
    for (const id of a.quandoSprint?.(itens) || []) ids.add(id)
    if (!ids.size) continue
    out.push({ id: a.id, nome: a.nome, porque: a.porque, arquivo: a.arquivo, existe: fs.existsSync(path.join(raiz, a.arquivo)), itens: [...ids] })
  }
  return out
}
