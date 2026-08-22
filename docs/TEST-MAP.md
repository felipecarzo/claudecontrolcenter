# TEST-MAP: o que é testável e verificável no painel

> **Arquivo derivado. Não edite à mão.** Ele é gerado por `cc testmap`,
> e o gate recusa quando o conteúdo não bate com a varredura.

Pedido dele em 21/08: *"criar um test-map, de tudo que tem que ser
testavel e verificavel no site. botões, textos, descrições, etc."*, para
*"usar como teste em diversas ferramentas"*. O contrato para as
ferramentas é o `TEST-MAP.json` ao lado; este arquivo é a leitura humana.

## As cinco dimensões

| dimensão | o que ela quer dizer |
|---|---|
| `existe` | está na tela, abre, e o endereço responde |
| `funciona` | clicar faz o que promete, e o dado chega no servidor |
| `explica` | a palavra técnica da tela tem explicação escrita |
| `estreito` | cabe em 390px, sem corte e sem rolagem lateral |
| `profundo` | a explicação ensina, em vez de só definir |

## Onde estamos

| tipo | itens | `existe` | `funciona` | `explica` | `estreito` | `profundo` |
|---|---|---|---|---|---|---|
| tela | 28 | 28/28 | 25/28 | 28/28 | 0/28 | 28/28 |
| acao | 115 | 115/115 | 24/115 | 0/115 | 0/115 | 0/115 |
| dado-de-tela | 7 | 7/7 | 6/7 | 0/7 | 0/7 | 0/7 |
| endereco | 88 | 88/88 | 6/88 | 0/88 | 0/88 | 0/88 |
| palavra | 55 | 55/55 | 13/55 | 55/55 | 0/55 | 55/55 |

**Coberto quer dizer CITADO num arquivo de teste, não testado de ponta a
ponta.** A diferença está na coluna `como` do JSON, item a item. Inflar
este número tornaria o mapa um relatório bonito, e ele existe contra isso.

## tela (28)

| item | camada | onde | o que falta |
|---|---|---|---|
| `cockpit` | viva | src/ui_v2.html#view-cockpit | estreito |
| `projetos` | viva | src/ui_v2.html#view-projetos | estreito |
| `meus` | viva | src/ui_v2.html#view-meus | estreito |
| `gate` | viva | src/ui_v2.html#view-gate | estreito |
| `agora` | viva | src/ui_v2.html#view-agora | estreito |
| `trabalho` | viva | src/ui_v2.html#view-trabalho | estreito |
| `estrutura` | viva | src/ui_v2.html#view-estrutura | estreito |
| `agentes` | viva | src/ui_v2.html#view-agentes | estreito |
| `escritorio` | viva | src/ui_v2.html#view-escritorio | funciona, estreito |
| `remoto` | viva | src/ui_v2.html#view-remoto | funciona, estreito |
| `tempo` | viva | src/ui_v2.html#view-tempo | estreito |
| `travas` | viva | src/ui_v2.html#view-travas | estreito |
| `tendencias` | viva | src/ui_v2.html#view-tendencias | funciona, estreito |
| `custo` | viva | src/ui_v2.html#view-custo | estreito |
| `graficos` | viva | src/ui_v2.html#view-graficos | estreito |
| `digest` | viva | src/ui_v2.html#view-digest | estreito |
| `notas` | viva | src/ui_v2.html#view-notas | estreito |
| `documentos` | viva | src/ui_v2.html#view-documentos | estreito |
| `agenda` | viva | src/ui_v2.html#view-agenda | estreito |
| `glossario` | viva | src/ui_v2.html#view-glossario | estreito |
| `framework` | viva | src/ui_v2.html#view-framework | estreito |
| `hooks` | viva | src/ui_v2.html#view-hooks | estreito |
| `rotinas` | viva | src/ui_v2.html#view-rotinas | estreito |
| `bancada` | viva | src/ui_v2.html#view-bancada | estreito |
| `servidores` | viva | src/ui_v2.html#view-servidores | estreito |
| `docker` | viva | src/ui_v2.html#view-docker | estreito |
| `vps` | viva | src/ui_v2.html#view-vps | estreito |
| `maquina` | viva | src/ui_v2.html#view-maquina | estreito |

## acao (115)

| item | camada | onde | o que falta |
|---|---|---|---|
| `data-target` | viva | src/ui_v2.html | explica, estreito |
| `data-grupo` | viva | src/ui_v2.html | explica, estreito |
| `data-nav-grupo` | estatica | src/ui_v2.html | funciona, explica, estreito |
| `data-gate-ag` | estatica | src/ui_v2.html | funciona, explica, estreito |
| `data-srv-modo` | estatica | src/ui_v2.html | funciona, explica, estreito |
| `data-ver-agente` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-meu-feito` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-retomar` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-foco-dia` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-meu-feito-btn` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-meu-remover` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-meu-abrir` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-meu-marcar` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-zona` | viva | src/ui_v2.html | explica, estreito |
| `data-ag` | viva | src/ui_v2.html | explica, estreito |
| `data-trab-abrir` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-mapa-ordem` | estatica | src/ui_v2.html | funciona, explica, estreito |
| `data-rota` | viva | src/ui_v2.html | explica, estreito |
| `data-rota-ocupar` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-criar-todo-roadmap` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-nota-check` | viva | src/ui_v2.html | explica, estreito |
| `data-nota-item` | viva | src/ui_v2.html | explica, estreito |
| `data-nota-add` | viva | src/ui_v2.html | explica, estreito |
| `data-nota-titulo` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-modo` | viva | src/ui_v2.html | explica, estreito |
| `data-del` | viva | src/ui_v2.html | explica, estreito |
| `data-cc-modo` | estatica | src/ui_v2.html | funciona, explica, estreito |
| `data-cc-proj` | estatica | src/ui_v2.html | funciona, explica, estreito |
| `data-cc-dir` | estatica | src/ui_v2.html | funciona, explica, estreito |
| `data-cc-fw` | estatica | src/ui_v2.html | funciona, explica, estreito |
| `data-cc-ligar` | estatica | src/ui_v2.html | funciona, explica, estreito |
| `data-fw-modo` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-mod` | viva | src/ui_v2.html | explica, estreito |
| `data-mod-proj` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-mod-on` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-ent-abrir` | viva | src/ui_v2.html | explica, estreito |
| `data-fw` | viva | src/ui_v2.html | explica, estreito |
| `data-fw-proj` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-ent-voltar` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-ent-op` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-novo-campo` | estatica | src/ui_v2.html | funciona, explica, estreito |
| `data-abrir` | viva | src/ui_v2.html | explica, estreito |
| `data-copiar` | viva | src/ui_v2.html | explica, estreito |
| `data-srv-nome` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-srv-nota` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-srv-fav` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-kill` | viva | src/ui_v2.html | explica, estreito |
| `data-subir-cwd` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-subir-cmd` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-hk-toggle` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-rt-ver` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-rt-sync` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-rt-del` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-mercado` | viva | src/ui_v2.html | explica, estreito |
| `data-preco-abrir` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-preco-nivel` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-preco-horas` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-rasc-g` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-g-editar` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-g-remover` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-meus-ver` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-meus-bloco` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-bn-camada` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-bn-nivel` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-doc-editar` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-doc-apagar` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-doc-abrir` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-ag-remover` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-ag-dias` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-sinc-acao` | estatica | src/ui_v2.html | funciona, explica, estreito |
| `data-sinc-proj` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-fed-pedir` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-fed-proj` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-remoto-link` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-remoto-mais` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-remoto-dir` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-remoto-desligar` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-remoto-ligar` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-coderoom-abrir` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-coderoom-dir` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-coderoom-nova` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-coderoom-fechar` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-esc-ver` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-esc-desligar` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-esc-ligar` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-bb` | viva | src/ui_v2.html | explica, estreito |
| `data-bb-pos` | estatica | src/ui_v2.html | funciona, explica, estreito |
| `data-tg-fechar` | estatica | src/ui_v2.html | funciona, explica, estreito |
| `data-tg-ir` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-pa-fechar-arq` | estatica | src/ui_v2.html | funciona, explica, estreito |
| `data-pa-arquivo` | estatica | src/ui_v2.html | funciona, explica, estreito |
| `data-pa-alternar` | estatica | src/ui_v2.html | funciona, explica, estreito |
| `data-pa-fechar` | estatica | src/ui_v2.html | funciona, explica, estreito |
| `data-pj-abrir` | estatica | src/ui_v2.html | funciona, explica, estreito |
| `data-pj-pastas` | estatica | src/ui_v2.html | funciona, explica, estreito |
| `data-pj-sessao` | estatica | src/ui_v2.html | funciona, explica, estreito |
| `data-pj-dir` | estatica | src/ui_v2.html | funciona, explica, estreito |
| `data-pj-conversa` | estatica | src/ui_v2.html | funciona, explica, estreito |
| `data-trv-fechar-explica` | estatica | src/ui_v2.html | funciona, explica, estreito |
| `data-trv-explica` | estatica | src/ui_v2.html | funciona, explica, estreito |
| `data-trv-abrir` | estatica | src/ui_v2.html | funciona, explica, estreito |
| `data-trv-ajudou` | estatica | src/ui_v2.html | funciona, explica, estreito |
| `data-trv-atrapalhou` | estatica | src/ui_v2.html | funciona, explica, estreito |
| `data-tend-andar` | estatica | src/ui_v2.html | funciona, explica, estreito |
| `data-tend-hoje` | estatica | src/ui_v2.html | funciona, explica, estreito |
| `data-tend-dia` | estatica | src/ui_v2.html | funciona, explica, estreito |
| `data-tend-fechar` | estatica | src/ui_v2.html | funciona, explica, estreito |
| `data-tend-cheia` | estatica | src/ui_v2.html | funciona, explica, estreito |
| `data-rot` | estatica | src/ui_v2.html | explica, estreito |
| `data-conv` | viva | src/ui_v2.html | explica, estreito |
| `data-nova` | viva | src/ui_v2.html | explica, estreito |
| `data-proj` | viva | src/ui_v2.html | explica, estreito |
| `data-tira` | viva | src/ui_v2.html | explica, estreito |
| `data-meu-check` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-todo` | viva | src/ui_v2.html | explica, estreito |

## dado-de-tela (7)

| item | camada | onde | o que falta |
|---|---|---|---|
| `data-explica` | estatica | src/ui_v2.html | explica, estreito |
| `data-ajuda` | viva | src/ui_v2.html | explica, estreito |
| `data-meu-texto` | viva | src/ui_v2.html | funciona, explica, estreito |
| `data-i` | viva | src/ui_v2.html | explica, estreito |
| `data-note` | viva | src/ui_v2.html | explica, estreito |
| `data-como` | estatica | src/ui_v2.html | explica, estreito |
| `data-n` | viva | src/ui_v2.html | explica, estreito |

## endereco (88)

| item | camada | onde | o que falta |
|---|---|---|---|
| `/api/jobs` | estatica | src/web.mjs | explica |
| `/api/meta` | estatica | src/web.mjs | explica |
| `/api/notes` | estatica | src/web.mjs | explica |
| `/api/docs` | estatica | src/web.mjs | funciona, explica |
| `/api/servers` | estatica | src/web.mjs | funciona, explica |
| `/api/servidor` | estatica | src/web.mjs | funciona, explica |
| `/api/projetos` | estatica | src/web.mjs | funciona, explica |
| `/api/subir` | estatica | src/web.mjs | funciona, explica |
| `/api/abrir` | estatica | src/web.mjs | funciona, explica |
| `/api/remote-control` | estatica | src/web.mjs | funciona, explica |
| `/api/docker` | estatica | src/web.mjs | funciona, explica |
| `/api/processos` | estatica | src/web.mjs | funciona, explica |
| `/api/cockpit` | estatica | src/web.mjs | funciona, explica |
| `/api/visita` | estatica | src/web.mjs | funciona, explica |
| `/api/federacao` | estatica | src/web.mjs | funciona, explica |
| `/api/federacao/pedir` | estatica | src/web.mjs | funciona, explica |
| `/api/federacao/config` | estatica | src/web.mjs | funciona, explica |
| `/api/federacao/enviar` | estatica | src/web.mjs | funciona, explica |
| `/api/glossario` | estatica | src/web.mjs | funciona, explica |
| `/api/meu` | estatica | src/web.mjs | funciona, explica |
| `/api/fila-perdida` | estatica | src/web.mjs | funciona, explica |
| `/api/framework/projetos` | estatica | src/web.mjs | funciona, explica |
| `/api/modulos` | estatica | src/web.mjs | funciona, explica |
| `/api/bancada` | estatica | src/web.mjs | funciona, explica |
| `/api/framework` | estatica | src/web.mjs | funciona, explica |
| `/api/projeto/novo` | estatica | src/web.mjs | funciona, explica |
| `/api/entrevista` | estatica | src/web.mjs | funciona, explica |
| `/api/recados` | estatica | src/web.mjs | explica |
| `/api/marcos` | estatica | src/web.mjs | funciona, explica |
| `/api/hooks` | estatica | src/web.mjs | funciona, explica |
| `/api/hooks/provar` | estatica | src/web.mjs | funciona, explica |
| `/api/rotinas` | estatica | src/web.mjs | funciona, explica |
| `/api/paineis-meus` | estatica | src/web.mjs | funciona, explica |
| `/api/sincronia` | estatica | src/web.mjs | funciona, explica |
| `/api/sincronia/acao` | estatica | src/web.mjs | funciona, explica |
| `/api/tela` | estatica | src/web.mjs | explica |
| `/api/pip` | estatica | src/web.mjs | explica |
| `/api/gate/conversas` | estatica | src/web.mjs | funciona, explica |
| `/api/gate/modo` | estatica | src/web.mjs | funciona, explica |
| `/api/gate/modelos` | estatica | src/web.mjs | funciona, explica |
| `/api/gate/conversa` | estatica | src/web.mjs | funciona, explica |
| `/api/gate/nova` | estatica | src/web.mjs | funciona, explica |
| `/api/gate/mensagem` | estatica | src/web.mjs | funciona, explica |
| `/api/gate/parar` | estatica | src/web.mjs | funciona, explica |
| `/api/gate/apagar` | estatica | src/web.mjs | funciona, explica |
| `/api/gate/nota` | estatica | src/web.mjs | funciona, explica |
| `/api/gate/anexo` | estatica | src/web.mjs | funciona, explica |
| `/api/gate/rascunho` | estatica | src/web.mjs | funciona, explica |
| `/api/vps` | estatica | src/web.mjs | funciona, explica |
| `/api/vps/atualizar` | estatica | src/web.mjs | funciona, explica |
| `/api/calendario` | estatica | src/web.mjs | funciona, explica |
| `/api/calendario/remover` | estatica | src/web.mjs | funciona, explica |
| `/api/travas` | estatica | src/web.mjs | funciona, explica |
| `/api/travas/recolher` | estatica | src/web.mjs | funciona, explica |
| `/api/armazem` | estatica | src/web.mjs | funciona, explica |
| `/api/armazem/cruzar` | estatica | src/web.mjs | funciona, explica |
| `/api/armazem/csv` | estatica | src/web.mjs | funciona, explica |
| `/api/tempo` | estatica | src/web.mjs | funciona, explica |
| `/api/cambio` | estatica | src/web.mjs | funciona, explica |
| `/api/taxa` | estatica | src/web.mjs | funciona, explica |
| `/api/graficos` | estatica | src/web.mjs | funciona, explica |
| `/api/assinatura` | estatica | src/web.mjs | funciona, explica |
| `/api/tarefas` | estatica | src/web.mjs | funciona, explica |
| `/api/mercado` | estatica | src/web.mjs | funciona, explica |
| `/api/tarefa` | estatica | src/web.mjs | funciona, explica |
| `/api/projetos/painel` | estatica | src/web.mjs | funciona, explica |
| `/api/projetos/pastas` | estatica | src/web.mjs | funciona, explica |
| `/api/projetos/arquivo` | estatica | src/web.mjs | funciona, explica |
| `/api/projetos/um` | estatica | src/web.mjs | funciona, explica |
| `/api/trabalho` | estatica | src/web.mjs | funciona, explica |
| `/api/vi-tudo` | estatica | src/web.mjs | funciona, explica |
| `/api/roadmap` | estatica | src/web.mjs | funciona, explica |
| `/api/enriquecer` | estatica | src/web.mjs | funciona, explica |
| `/api/digest` | estatica | src/web.mjs | funciona, explica |
| `/api/git` | estatica | src/web.mjs | funciona, explica |
| `/api/maquina` | estatica | src/web.mjs | funciona, explica |
| `/api/midia` | estatica | src/web.mjs | funciona, explica |
| `/api/midia/acao` | estatica | src/web.mjs | funciona, explica |
| `/api/midia/volume` | estatica | src/web.mjs | funciona, explica |
| `/api/kill` | estatica | src/web.mjs | funciona, explica |
| `/api/paineis` | estatica | src/web.mjs | funciona, explica |
| `/api/paineis/ligar` | estatica | src/web.mjs | funciona, explica |
| `/api/paineis/desligar` | estatica | src/web.mjs | funciona, explica |
| `/api/escritorio` | estatica | src/web.mjs | funciona, explica |
| `/api/rotas` | estatica | src/web.mjs | funciona, explica |
| `/api/rotas/pedido` | estatica | src/web.mjs | funciona, explica |
| `/api/rotas/alternar` | estatica | src/web.mjs | funciona, explica |
| `/api/shutdown` | estatica | src/web.mjs | funciona, explica |

## palavra (55)

| item | camada | onde | o que falta |
|---|---|---|---|
| `tela: cockpit` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: gate` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: agora` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: meus` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: trabalho` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: estrutura` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: agentes` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: escritorio` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: remoto` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: framework` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: hooks` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: rotinas` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: bancada` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: servidores` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: docker` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: vps` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: maquina` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: tempo` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `janela: pastas` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: projetos` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: travas` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: tendencias` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: custo` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: graficos` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: digest` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: notas` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: documentos` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: agenda` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: glossario` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `agente` | estatica | docs/produto/PALAVRAS-DA-TELA.md | nada |
| `sem contato` | estatica | docs/produto/PALAVRAS-DA-TELA.md | nada |
| `esperando você` | estatica | docs/produto/PALAVRAS-DA-TELA.md | nada |
| `trabalhando` | estatica | docs/produto/PALAVRAS-DA-TELA.md | nada |
| `parado` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `quebrou` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `máquina` | estatica | docs/produto/PALAVRAS-DA-TELA.md | nada |
| `federação` | estatica | docs/produto/PALAVRAS-DA-TELA.md | nada |
| `frente` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `to-do` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `sprint` | estatica | docs/produto/PALAVRAS-DA-TELA.md | nada |
| `product backlog` | estatica | docs/produto/PALAVRAS-DA-TELA.md | nada |
| `token` | estatica | docs/produto/PALAVRAS-DA-TELA.md | nada |
| `cache lido` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `janela de 5h` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `janela semanal` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `custo de API` | estatica | docs/produto/PALAVRAS-DA-TELA.md | nada |
| `sobra` | estatica | docs/produto/PALAVRAS-DA-TELA.md | nada |
| `corte` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tempo ativo` | estatica | docs/produto/PALAVRAS-DA-TELA.md | nada |
| `rota` | estatica | docs/produto/PALAVRAS-DA-TELA.md | nada |
| `hook` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `gate` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `servidor de desenvolvimento` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `container` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `painel embutido` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |

