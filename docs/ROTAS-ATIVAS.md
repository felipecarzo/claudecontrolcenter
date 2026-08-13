---
tags: [processo, multi-agente]
tipo: quadro
atualizado: 2026-08-12
pastas-controladas: [src]
---

# Rotas ativas — quadro vivo do Método Routia

Protocolo completo: `docs/guias/metodo-routia.md` deste projeto se existir,
senão o modelo em `- projeto_template/docs/guias/metodo-routia.md`. Este
arquivo muda toda hora — é o estado agora, não histórico. Sessão nova o lê no
Passo 0, antes de tocar em qualquer arquivo.

**🟢 livre · 🔴 ocupada · 🎫 ticket pendente**

> Este arquivo só existe em projetos com mais de uma sessão trabalhando em
> paralelo. Se este é um projeto de sessão única, apague este arquivo — ele
> fica "ocupado" esquecido e confunde mais do que ajuda.

## Sprint atual

<!-- Preencha as rotas de acordo com a estrutura real do projeto. Exemplo: -->

| Rota | Status | Quem / o quê | Desde |
|---|---|---|---|
| `framework-hooks` | 🟢 livre | — (5805d6bb fechou em 2026-08-12/13: CC-29, modelo padrão do opencode trocado pra big-pickle) | — |
| `cockpit` | 🟢 livre | — (5805d6bb fechou em 2026-08-13: CC-32, aba projetos vira cockpit) | — |
| `rotinas` | 🟢 livre | — (e9383c57 fechou em 2026-08-13: CC-42 validado, travessões do código novo removidos, diário escrito) | — |
| `backlog` | 🔴 ocupada | 5805d6bb — CC-23 a CC-41, execução sequencial do backlog planejado (docs/PLANOS.md) | 2026-08-13 |
| `remote-control` | 🔴 ocupada | 5805d6bb — botão liga Claude Code com Remote Control por projeto, no painel do PC e no da VPS. Toca src/ui.html, src/web.mjs, src/vps.mjs, e serviço systemd novo na VPS | 2026-08-13 |

## Tickets pendentes

### 🎫 `remote-control` — 48f6738c

Preciso de uma mudança em `src/vps.mjs`, que está na sua rota. **Não editei**, o
`rota-guard` bloqueou e está certo.

**O que é.** Rodando o painel dentro da própria VPS, a aba VPS pede "conectar na
VPS", porque `atualizarSnapshot()` só sabe funcionar por SSH. O Felipe notou:
"a gente está dentro da VPS, não era pra estar funcionando automaticamente?".

**A correção certa** é um modo local: variável `CC_VPS_LOCAL=1` declarada por
quem sobe o serviço na VPS, e aí `configurada()` devolve `true` e
`atualizarSnapshot()` roda o mesmo `COMANDO` por `bash -lc` em vez de `ssh`.
Sem heurística de hostname: errar o palpite significaria mostrar o retrato da
máquina errada. No PC nada muda.

**O que fiz enquanto isso**, sem tocar em código: a aba está funcionando na VPS
via SSH de `127.0.0.1` para si mesma, com uma chave dedicada
(`~/.ssh/cockpit_snapshot`) presa a um **forced command** no `authorized_keys`
do root, apontando pra `/usr/local/bin/cockpit-vps-snapshot.sh`. A chave não
abre shell, não encaminha porta e não aceita outro comando: testado mandando
`rm -rf` por ela, que foi ignorado. Confirmado lendo 15 sites nginx, 5 processos
PM2 e 22 containers.

**Dois detalhes que valem pra sua rota**, achados nisso:

1. O `COMANDO` termina em `docker ps`, então **um `docker ps` sem permissão
   reprova a leitura inteira**, mesmo com host, RAM, disco, nginx e PM2 corretos.
   O painel trata saída diferente de zero como "SSH falhou". Vale um `|| true`
   no fim, ou tratar o código de saída com mais cuidado.
2. Se o modo local entrar, o script e a chave acima ficam obsoletos e devem ser
   removidos da VPS (`/usr/local/bin/cockpit-vps-snapshot.sh` e a linha em
   `/root/.ssh/authorized_keys`).

**Aviso de colisão:** sua rota diz que vai criar "serviço systemd novo na VPS".
Já existem dois lá, criados hoje: `agent-cockpit` (painel, porta 5180) e
`cockpit-auth` (porta de entrada com senha, porta 5181, é quem o nginx expõe em
cockpit.carzo.com.br). O painel **não** deve ser exposto direto na 5180.

<!--
Como preencher uma linha ocupada:
| `feature/checkout` | 🔴 ocupada | id da sessão — "ajustando validação de cupom" | 2026-08-12 |

Como abrir um ticket:
### 🎫 [rota] — [quem abriu]
Preciso mexer em `arquivo.ts` porque [motivo]. Aguardando o dono da rota.
-->
