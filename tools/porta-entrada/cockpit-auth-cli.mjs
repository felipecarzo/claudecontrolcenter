#!/usr/bin/env node
// Administracao da porta de entrada do Agent Cockpit.
//
//   cockpit-auth senha "<nova senha>"   define ou troca a senha
//   cockpit-auth provisoria             senha temporaria + troca obrigatoria no site
//   cockpit-auth trocar                 mantem a senha e exige troca no site
//   cockpit-auth sessoes                lista dispositivos logados
//   cockpit-auth revogar                desloga TODOS os dispositivos
//   cockpit-auth revogar <id>           desloga um dispositivo
//   cockpit-auth json                   saida em json (pra aba VPS do painel)
//
// Separado do servidor de proposito: trocar senha ou revogar nao exige
// reiniciar nada. O servidor le os arquivos a cada requisicao.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
// CC-933: instalado, o registro de auditoria fica ao lado (./auditoria.mjs, copiado pelo instalar.sh); no repositório mora em ../auditoria/
const { registrar } = await import(new URL(fs.existsSync(new URL('./auditoria.mjs', import.meta.url)) ? './auditoria.mjs' : '../auditoria/auditoria.mjs', import.meta.url).href)
// pelo terminal não há IP nem aparelho: vale o usuário do sistema que rodou o comando
const porQuem = `terminal (${os.userInfo().username})`

const CASA = os.homedir()
const ARQ_SENHA = path.join(CASA, '.cockpit-auth.json')
const ARQ_SESSOES = path.join(CASA, '.cockpit-sessions.json')

const lerJson = (p, padrao) => {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return padrao
  }
}
const gravar = (p, d) => fs.writeFileSync(p, JSON.stringify(d, null, 1), { mode: 0o600 })

const quando = (ms) => (ms ? new Date(ms).toISOString().slice(0, 16).replace('T', ' ') : '-')

const hashear = (senha, sal) =>
  crypto.scryptSync(senha, sal, 64, { N: 16384, r: 8, p: 1 }).toString('hex')

const gravarSenha = (senha, extra = {}) => {
  const sal = crypto.randomBytes(16).toString('hex')
  gravar(ARQ_SENHA, { sal, hash: hashear(senha, sal), em: Date.now(), ...extra })
}

const revogarTudo = () => {
  const n = Object.keys(lerJson(ARQ_SESSOES, {})).length
  gravar(ARQ_SESSOES, {})
  return n
}

// Senha provisoria feita para ser DIGITADA NO CELULAR, e e por isso que ela nao
// e um `randomBytes().toString('hex')`: fora o alfabeto sem os pares que se
// confundem na tela (l com 1, o com 0), os hifens a cada quatro dao ao dedo um
// ponto de conferencia. Sao 12 letras de um alfabeto de 32, ou 60 bits, e ela
// vive poucos minutos — o tempo entre eu gerar e ele definir a definitiva.
const senhaProvisoria = () => {
  const alfabeto = 'abcdefghijkmnpqrstuvwxyz23456789'
  const letras = [...crypto.randomBytes(12)].map((b) => alfabeto[b % alfabeto.length])
  return [letras.slice(0, 4), letras.slice(4, 8), letras.slice(8, 12)]
    .map((p) => p.join(''))
    .join('-')
}

const [, , cmd, arg] = process.argv

switch (cmd) {
  case 'senha': {
    if (!arg || arg.length < 10) {
      console.error('senha muito curta: use pelo menos 10 caracteres')
      process.exit(1)
    }
    gravarSenha(arg)
    const n = revogarTudo()
    registrar({ acao: 'senha-trocada', quem: porQuem, ok: true, detalhe: `${n} sessão(ões) revogada(s)` })
    console.log(`senha definida. ${n} sessao(oes) anterior(es) revogada(s) por seguranca.`)
    break
  }

  // Para quando ele NAO lembra mais a senha: uma temporaria entra no lugar so
  // para abrir a porta, e o site exige a definitiva antes de mostrar qualquer
  // coisa. A definitiva nasce digitada por ele no telefone, entao nao passa por
  // aqui, nem por historico de shell, nem por conversa nenhuma.
  case 'provisoria': {
    const senha = senhaProvisoria()
    gravarSenha(senha, { trocar: true })
    const n = revogarTudo()
    registrar({ acao: 'senha-trocada', quem: porQuem, ok: true, detalhe: `senha provisória gerada, ${n} sessão(ões) revogada(s)` })
    console.log(`senha provisoria: ${senha}`)
    console.log(`${n} dispositivo(s) deslogado(s). Entre com ela e o site vai pedir a definitiva.`)
    break
  }

  // Para quando ele LEMBRA a senha e so quer trocar: nada muda no que abre a
  // porta hoje, e a tela de senha nova aparece na proxima entrada.
  case 'trocar': {
    const d = lerJson(ARQ_SENHA, null)
    if (!d || !d.hash) {
      console.error('nao ha senha definida ainda. Use: cockpit-auth senha "<senha>"')
      process.exit(1)
    }
    gravar(ARQ_SENHA, { ...d, trocar: true })
    const n = revogarTudo()
    console.log(`troca exigida na proxima entrada. ${n} dispositivo(s) deslogado(s).`)
    break
  }

  case 'sessoes': {
    const s = lerJson(ARQ_SESSOES, {})
    const itens = Object.entries(s)
    if (!itens.length) {
      console.log('nenhum dispositivo logado')
      break
    }
    console.log(`${itens.length} dispositivo(s) logado(s):\n`)
    for (const [token, d] of itens) {
      console.log(`  id:      ${token.slice(0, 12)}`)
      console.log(`  entrou:  ${quando(d.criadaEm)}   ultimo uso: ${quando(d.ultimoUso)}`)
      console.log(`  ip:      ${d.ip || '-'}`)
      console.log(`  aparelho:${(d.ua || '-').slice(0, 80)}\n`)
    }
    break
  }

  case 'revogar': {
    const s = lerJson(ARQ_SESSOES, {})
    if (!arg) {
      const n = Object.keys(s).length
      gravar(ARQ_SESSOES, {})
      registrar({ acao: 'sessao-revogada', quem: porQuem, alvo: 'todas', ok: true, detalhe: `${n} dispositivo(s)` })
      console.log(`${n} dispositivo(s) deslogado(s)`)
      break
    }
    const alvo = Object.keys(s).find((t) => t.startsWith(arg))
    if (!alvo) {
      console.error(`nenhuma sessao comeca com "${arg}"`)
      process.exit(1)
    }
    delete s[alvo]
    gravar(ARQ_SESSOES, s)
    registrar({ acao: 'sessao-revogada', quem: porQuem, alvo: 'sessão ' + alvo.slice(0, 12), ok: true })
    console.log(`dispositivo ${arg} deslogado`)
    break
  }

  case 'json': {
    const s = lerJson(ARQ_SESSOES, {})
    console.log(
      JSON.stringify(
        {
          temSenha: fs.existsSync(ARQ_SENHA),
          trocaPendente: !!lerJson(ARQ_SENHA, {}).trocar,
          sessoes: Object.entries(s).map(([t, d]) => ({
            id: t.slice(0, 12),
            criadaEm: d.criadaEm,
            ultimoUso: d.ultimoUso,
            ip: d.ip,
            ua: d.ua,
          })),
        },
        null,
        1,
      ),
    )
    break
  }

  /* CC-869: liga e desliga o código do autenticador (do Deploy seguro) no login em aparelho
     novo e no reinício de emergência. `ligar` TESTA a conexão antes: ligar sem o serviço de pé
     trancaria ele fora do painel. `desligar` não depende do serviço, e é o caminho de
     recuperação (celular perdido, serviço fora do ar): quem tem o terminal da VPS desliga. */
  case 'codigo': {
    const { lerFlag, gravarFlag, sondar, PORTA_DEPLOY } = await import('./segundo-fator.mjs')
    const sub = arg || 'estado'
    if (sub === 'ligar') {
      const s = await sondar({ porta: PORTA_DEPLOY })
      if (!s.ok) {
        console.error(s.motivo === 'sem-segredo'
          ? 'o servico do administrador responde, mas o autenticador nao esta configurado. Nao liguei.'
          : `o servico do Deploy seguro nao respondeu na porta ${PORTA_DEPLOY}. Nao liguei: ligar assim trancaria o painel.`)
        process.exit(1)
      }
      gravarFlag({ ativo: true, porta: PORTA_DEPLOY })
      registrar({ acao: 'segundo-fator-config', quem: porQuem, alvo: 'login e religar', ok: true, detalhe: 'ligado' })
      console.log('codigo do autenticador LIGADO: login em aparelho novo e religar da VPS passam a pedir o codigo.')
      console.log('Quem ja esta logado continua logado. Para desfazer: cockpit-auth codigo desligar')
    } else if (sub === 'desligar') {
      gravarFlag({ ativo: false, porta: PORTA_DEPLOY })
      registrar({ acao: 'segundo-fator-config', quem: porQuem, alvo: 'login e religar', ok: true, detalhe: 'DESLIGADO' })
      console.log('codigo do autenticador DESLIGADO: volta a valer so a senha.')
    } else if (sub === 'estado') {
      const f = lerFlag(); const s = await sondar({ porta: f.porta })
      console.log(`codigo do autenticador: ${f.ativo ? 'LIGADO' : 'desligado'}`)
      console.log(`servico do Deploy seguro (porta ${f.porta}): ${s.ok ? 'respondendo' : s.motivo === 'sem-segredo' ? 'responde, sem autenticador configurado' : 'FORA DO AR'}`)
      if (f.ativo && !s.ok) console.log('ATENCAO: ligado com o servico fora do ar, ninguem consegue entrar em aparelho novo. Use: cockpit-auth codigo desligar')
    } else { console.error('uso: cockpit-auth codigo ligar|desligar|estado'); process.exit(1) }
    break
  }

  default:
    console.log(`uso:
  cockpit-auth senha "<nova senha>"   define ou troca a senha (revoga tudo)
  cockpit-auth provisoria             senha temporaria + troca obrigatoria no site
  cockpit-auth trocar                 mantem a senha e exige troca no site
  cockpit-auth sessoes                lista dispositivos logados
  cockpit-auth revogar                desloga TODOS
  cockpit-auth revogar <id>           desloga um dispositivo
  cockpit-auth codigo ligar|desligar|estado   codigo do autenticador no login (aparelho novo) e no religar
  cockpit-auth json                   saida em json`)
    process.exit(cmd ? 1 : 0)
}
