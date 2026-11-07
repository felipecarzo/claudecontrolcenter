# Guias de capacidades

Lista de todos os guias. Um guia por função pronta, escrito com o contexto fresco de quem acabou de construir, para a IA
entender o que a ferramenta faz sem ler o código. Modelo: skill `guia-de-capacidades`. Regra e ganchos: `docs/CC-1071.md`; desde 30/10 o guia de cada frente é gerado pelo Haiku, por código (`docs/CC-1076.md`).
Mexeu numa função pronta: atualize o guia (cabeçalho `atualizado:` incluído) e a linha aqui.

| função | guia | itens do backlog | código (arquivos) | atualizado | manual |
|---|---|---|---|---|---|
| Ganchos de conferência (teto de robô, ligar e derrubar só com frase dele, conferir pedido, fala e omissão, conferente, registro do turno) | [ganchos-de-conferencia.md](ganchos-de-conferencia.md) | CC-1069, CC-1070, CC-1073 | hooks/teto-robo.mjs, hooks/autonomia.mjs, hooks/quebra-guard.mjs, hooks/modelo-guard.mjs, hooks/confere-pedido.mjs, hooks/confere-fala.mjs, hooks/confere-omissao.mjs, hooks/conferente.mjs, hooks/anonimo-prompt.mjs, hooks/parada.mjs, src/registroTurno.mjs, src/conferente.mjs | 2026-10-28 |  |
| Encerrar uma sessão (`/encerrar` e `cc sessao encerrar`: commit, push, e a sessão some do painel) | [encerrar-sessao.md](encerrar-sessao.md) | CC-1075 | src/encerrarSessao.mjs, src/sessoes.mjs, src/remotecontrol.mjs, cc.mjs, test-encerrar.mjs | 2026-10-30 |  |
| Ganchos do PC refeitos em node (resumo em português ao compactar e título do terminal) | [ganchos-do-pc.md](ganchos-do-pc.md) | CC-1072 | hooks/compactar-idioma.mjs, hooks/titulo-terminal.mjs | 2026-10-29 |  |
| Guias de capacidades (cobrança de guia por função pronta e por contexto cheio) | [guias-de-capacidades.md](guias-de-capacidades.md) | CC-1071 | src/guias.mjs, hooks/guia-fim.mjs, hooks/guia-contexto.mjs, hooks/parada.mjs, src/registroTurno.mjs | 2026-10-28 |  |
| Botão terminal do Claude Code dentro do painel (Projetos, Sessões e Claude Code do projeto) | [terminal-do-claude-no-cartao.md](terminal-do-claude-no-cartao.md) | CC-1051 | src/ui_cockpit2.html, src/web.mjs, src/cockpit2.mjs, src/remotecontrol.mjs, test-terminal-claude.mjs | 2026-10-29 |  |
| Guia por frente, escrito pelo Haiku e disparado por código quando a frente fecha | [guia-por-frente.md](guia-por-frente.md) | CC-1076 | src/frenteConcluida.mjs, src/guiaHaiku.mjs, hooks/guia-frente.mjs, hooks/parada.mjs, hooks/teto-robo.mjs, cc.mjs | 2026-10-30 |  |
| Cápsula de projeto (backup que volta igual, sem IA: `cc capsula fazer\|provar\|ensaio` e o `restaurar.sh`) | [capsula.md](capsula.md) | CC-1080 | src/capsula.mjs, cc.mjs, test-capsula.mjs | 2026-11-02 |  |
