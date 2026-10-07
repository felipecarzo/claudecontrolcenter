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
| tela | 17 | 17/17 | 11/17 | 17/17 | 0/17 | 17/17 |
| acao | 337 | 337/337 | 47/337 | 0/337 | 0/337 | 0/337 |
| dado-de-tela | 7 | 7/7 | 6/7 | 0/7 | 0/7 | 0/7 |
| endereco | 159 | 159/159 | 3/159 | 0/159 | 0/159 | 0/159 |
| palavra | 85 | 85/85 | 10/85 | 85/85 | 0/85 | 85/85 |

**Coberto quer dizer CITADO num arquivo de teste, não testado de ponta a
ponta.** A diferença está na coluna `como` do JSON, item a item. Inflar
este número tornaria o mapa um relatório bonito, e ele existe contra isso.

## tela (17)

| item | camada | onde | o que falta |
|---|---|---|---|
| `framework` | viva | src/ui_cockpit2.html#view-framework | estreito |
| `infra` | viva | src/ui_cockpit2.html#view-infra | funciona, estreito |
| `inicio` | viva | src/ui_cockpit2.html#view-inicio | estreito |
| `tarefas` | viva | src/ui_cockpit2.html#view-tarefas | estreito |
| `caminho` | viva | src/ui_cockpit2.html#view-caminho | estreito |
| `decisoes` | viva | src/ui_cockpit2.html#view-decisoes | funciona, estreito |
| `armario` | viva | src/ui_cockpit2.html#view-armario | funciona, estreito |
| `ideias` | viva | src/ui_cockpit2.html#view-ideias | funciona, estreito |
| `design` | viva | src/ui_cockpit2.html#view-design | estreito |
| `gate` | viva | src/ui_cockpit2.html#view-gate | estreito |
| `trabalho` | viva | src/ui_cockpit2.html#view-trabalho | estreito |
| `analise` | viva | src/ui_cockpit2.html#view-analise | estreito |
| `escritorio` | viva | src/ui_cockpit2.html#view-escritorio | funciona, estreito |
| `tempo` | viva | src/ui_cockpit2.html#view-tempo | estreito |
| `agenda` | viva | src/ui_cockpit2.html#view-agenda | estreito |
| `conhecimento` | viva | src/ui_cockpit2.html#view-conhecimento | funciona, estreito |
| `remoto` | viva | src/ui_cockpit2.html#view-remoto | estreito |

## acao (337)

| item | camada | onde | o que falta |
|---|---|---|---|
| `data-tema` | estatica | src/ui_cockpit2.html | explica, estreito |
| `data-ses-acao` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-atalho` | estatica | src/ui_cockpit2.html | explica, estreito |
| `data-target` | viva | src/ui_cockpit2.html | explica, estreito |
| `data-grupo` | viva | src/ui_cockpit2.html | explica, estreito |
| `data-nav-grupo` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-fonte` | estatica | src/ui_cockpit2.html | explica, estreito |
| `data-analise` | estatica | src/ui_cockpit2.html | explica, estreito |
| `data-gate-barra` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-gate-vista` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-gate-ag` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-gate-info` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-numeros` | estatica | src/ui_cockpit2.html | explica, estreito |
| `data-infra` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-srv-modo` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-conh` | estatica | src/ui_cockpit2.html | explica, estreito |
| `data-foco-dia` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-meu-feito-btn` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-ver-agente` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-meu-remover` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-meu-abrir` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-meu-marcar` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-ag-modo` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-zona` | viva | src/ui_cockpit2.html | explica, estreito |
| `data-ag` | viva | src/ui_cockpit2.html | explica, estreito |
| `data-retomar` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-trab-abrir` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-mapa-faixa` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-mapa-ordem` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-bloco` | viva | src/ui_cockpit2.html | explica, estreito |
| `data-rota` | viva | src/ui_cockpit2.html | explica, estreito |
| `data-rota-ocupar` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-criar-todo-roadmap` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-nota-check` | viva | src/ui_cockpit2.html | explica, estreito |
| `data-nota-item` | viva | src/ui_cockpit2.html | explica, estreito |
| `data-nota-add` | viva | src/ui_cockpit2.html | explica, estreito |
| `data-nota-titulo` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-modo` | viva | src/ui_cockpit2.html | explica, estreito |
| `data-del` | viva | src/ui_cockpit2.html | explica, estreito |
| `data-ent-voltar` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-ent-op` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-remoto-ligar` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-remoto-dir` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-remoto-quieto` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-novo-campo` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-abrir` | viva | src/ui_cockpit2.html | explica, estreito |
| `data-copiar` | viva | src/ui_cockpit2.html | explica, estreito |
| `data-srv-nome` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-srv-nota` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-srv-fav` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-kill` | viva | src/ui_cockpit2.html | explica, estreito |
| `data-subir-cwd` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-subir-cmd` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-hk-toggle` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-rt-ver` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-rt-sync` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-rt-del` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-mercado` | viva | src/ui_cockpit2.html | explica, estreito |
| `data-preco-abrir` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-preco-nivel` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-preco-horas` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-rasc-g` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-g-cheio` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-g-editar` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-g-remover` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-ia-testar` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-ia-remover` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-ia-chave` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-ia-salvar` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-tend-fechar` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-pasta-tirar` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-modo-proj` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-meus-ver` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-meus-bloco` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-bn-camada` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-bn-nivel` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-doc-editar` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-doc-apagar` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-doc-abrir` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-ag-remover` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-ag-dias` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-sinc-acao` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-sinc-proj` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-fed-pedir` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-fed-proj` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-remoto-conectar` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-remoto-soltar` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-remoto-mais` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-remoto-desligar` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-remoto-reabrir` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-coderoom-abrir` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-coderoom-dir` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-coderoom-nova` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-coderoom-fechar` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-remoto-link` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-esc-ver` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-esc-desligar` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-esc-ligar` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-tg-fechar` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-tg-ir` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-pa-fechar-arq` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-pa-arquivo` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-pa-alternar` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-pa-fechar` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-estado-abrir` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-estado-dir` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-estado-escolher` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-estado-fechar` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-mod-remoto` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-mod-proj` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-mod-maquina` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-mod-on` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-fw-remoto` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-fw-maquina` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-sinc-remoto` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-sinc-maquina` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-mod` | estatica | src/ui_cockpit2.html | explica, estreito |
| `data-fw` | estatica | src/ui_cockpit2.html | explica, estreito |
| `data-fw-proj` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-fw-alvo` | estatica | src/ui_cockpit2.html | explica, estreito |
| `data-ent-abrir` | estatica | src/ui_cockpit2.html | explica, estreito |
| `data-sessao-modo` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-sessao-proj` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-cc-dir` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-remoto-perfil` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-agy-abrir` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-agy-remoto` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-agy-dir` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-pj-abrir` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-abrir-sessao` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-abrir-dir` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-pj-pastas` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-risco` | estatica | src/ui_cockpit2.html | explica, estreito |
| `data-trv-fechar-explica` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-trv-explica` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-trv-abrir` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-trv-ajudou` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-trv-atrapalhou` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-tend-andar` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-tend-hoje` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-tend-dia` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-tend-cheia` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-rot` | estatica | src/ui_cockpit2.html | explica, estreito |
| `data-info-ag` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-gal` | estatica | src/ui_cockpit2.html | explica, estreito |
| `data-perm` | estatica | src/ui_cockpit2.html | explica, estreito |
| `data-perm-conv` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-perm-id` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-gate-cmds` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-gate-inteira` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-gate-salvar` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-gate-acao` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-gate-form` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-gate-fop` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-gate-extra` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-gate-enviar` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-gctx-ir` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-gate-sug` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-conv` | viva | src/ui_cockpit2.html | explica, estreito |
| `data-nova` | viva | src/ui_cockpit2.html | explica, estreito |
| `data-proj` | viva | src/ui_cockpit2.html | explica, estreito |
| `data-gate-ficha` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-pj-ir` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-pj-nome` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-pj-chave` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-gate-citar` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-painel-k` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-gctx-colapsar` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-gctx-ocultar` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-gctx-mostrar` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-gl-nova` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-gl-conv` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-gl-k` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-gl-recolher` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-gl-acao` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-tira` | viva | src/ui_cockpit2.html | explica, estreito |
| `data-kb-card` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-kb-mover` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-kb-mais-col` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-kb-proj` | estatica | src/ui_cockpit2.html | explica, estreito |
| `data-kb-aba` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-esq-acao` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-esq-alvo` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-esq-nome` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-sino-ir` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-aviso-id` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-acoes-tg` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-cad` | estatica | src/ui_cockpit2.html | explica, estreito |
| `data-ord-mov` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-ord-dir` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-novos-topo` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-faixa-tudo` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-faixa-itens` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-faixa` | estatica | src/ui_cockpit2.html | explica, estreito |
| `data-bb` | estatica | src/ui_cockpit2.html | explica, estreito |
| `data-lat-bloco` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-ctx` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-dec-aba` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-hist-proj` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-dec-trazer` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-dec-reabrir` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-dec-marca` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-ses-modo` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-repetidas` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-grupo-fechar` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-grupo-abrir` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-eti-k` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-eti` | estatica | src/ui_cockpit2.html | explica, estreito |
| `data-meu-feito` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-dec-depois` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-dec-x` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-dec-fechar` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-dec-depois-modo` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-dec-id` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-gate-renomear` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-gate-titulo` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-gate-arquivar` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-tdr-abrir` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-anda-refazer` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-anda-tirar` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-dec` | estatica | src/ui_cockpit2.html | explica, estreito |
| `data-dec-multi` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-dec-txt` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-dec-livre` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-dec-op` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-dec-enviar` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-arq` | estatica | src/ui_cockpit2.html | explica, estreito |
| `data-arq-op` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-arq-extra` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-arq-enviar` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-dep-sug` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-dep-cadastrar` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-git-abrir` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-git-msg` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-git-ok` | estatica | src/ui_cockpit2.html | explica, estreito |
| `data-deploy-cod` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-deploy-ok` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-deploy-nao` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-deploy-pedir` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-msg` | estatica | src/ui_cockpit2.html | explica, estreito |
| `data-ouv` | estatica | src/ui_cockpit2.html | explica, estreito |
| `data-msg-conversa` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-msg-cwd` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-msg-sug-i` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-cam-lugar` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-cam-lugar-onde` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-cam-abrir` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-cam-na-lista` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-cam-x` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-cam-y` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-cam-trecho` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-cam-w` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-cam-h` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-cam-alvo` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-cam-modo` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-cam-por` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-cam-proj-ir` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-nome` | estatica | src/ui_cockpit2.html | explica, estreito |
| `data-cam-lugar-id` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-cam-lugar-ir` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-pedido-grupo` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-tarefa-desfazer` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-tarefa-abrir` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-tarefa-feita` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-tdr-orig` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-tdr-proj` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-tdr-carta` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-tdr-op` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-carta-explicar` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-colap` | estatica | src/ui_cockpit2.html | explica, estreito |
| `data-fala-abrir` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-ses-fixar` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-ses-painel-por` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-ses-painel-tirar` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-ses-sel` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-conv-abrir` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-cfg-conversa` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-cfg` | estatica | src/ui_cockpit2.html | explica, estreito |
| `data-ses-conversa` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-ses-nome` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-gate-quem` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-atual` | estatica | src/ui_cockpit2.html | explica, estreito |
| `data-sessao-parar` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-sessao-nome` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-voo-criar` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-dev-subir` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-gav-acao` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-gav-grupo` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-gav-item` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-bloco-expandir` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-bloco-recolher` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-ideia-acao` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-ideia-id` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-ideia-raiz` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-proj-inativo` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-ini-aba` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-busca-i` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-proj-criar-aqui` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-pj-etq-tirar` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-pj-aba` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-prod-parte` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-prod-seg` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-pj-detalhe` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-pj-filtro` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-pj-modo` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-pj-ordem` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-dsg-votar` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-dsg-escolha` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-dsg-nota` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-dsg-mural-sim` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-dsg-mural-apagar` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-dsg-tam` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-dsg-proj` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-dsg-cor` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-dsg-de` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-dsg-fonte-salvar` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-dsg-fonte` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-dsg-aba` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-arm-proj` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-arm-k` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-arm-nota` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-arm-arq` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-arm-aba` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-arm-gaveta` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-arm-mover` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-arm-projeto` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-arm-vista` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-arm-apagar-sim` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-arm-apagar` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-arm-pasta` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-arm-doc` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-arm-secao` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-arm-no-proj` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-ide-estado` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-ide-acao` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-ide-i` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-ide-abrir` | estatica | src/ui_cockpit2.html | funciona, explica, estreito |

## dado-de-tela (7)

| item | camada | onde | o que falta |
|---|---|---|---|
| `data-explica` | estatica | src/ui_cockpit2.html | explica, estreito |
| `data-ajuda` | viva | src/ui_cockpit2.html | explica, estreito |
| `data-meu-texto` | viva | src/ui_cockpit2.html | funciona, explica, estreito |
| `data-i` | viva | src/ui_cockpit2.html | explica, estreito |
| `data-note` | viva | src/ui_cockpit2.html | explica, estreito |
| `data-como` | estatica | src/ui_cockpit2.html | explica, estreito |
| `data-n` | viva | src/ui_cockpit2.html | explica, estreito |

## endereco (159)

| item | camada | onde | o que falta |
|---|---|---|---|
| `/api/jobs` | estatica | src/web.mjs | explica |
| `/api/meta` | estatica | src/web.mjs | funciona, explica |
| `/api/notes` | estatica | src/web.mjs | funciona, explica |
| `/api/docs` | estatica | src/web.mjs | funciona, explica |
| `/api/servers` | estatica | src/web.mjs | funciona, explica |
| `/api/servidor` | estatica | src/web.mjs | funciona, explica |
| `/api/projetos` | estatica | src/web.mjs | funciona, explica |
| `/api/dev-teste` | estatica | src/web.mjs | funciona, explica |
| `/api/subir` | estatica | src/web.mjs | funciona, explica |
| `/api/abrir` | estatica | src/web.mjs | funciona, explica |
| `/api/remote-control` | estatica | src/web.mjs | funciona, explica |
| `/api/agy-remote-control` | estatica | src/web.mjs | funciona, explica |
| `/api/docker` | estatica | src/web.mjs | funciona, explica |
| `/api/processos` | estatica | src/web.mjs | funciona, explica |
| `/api/cockpit` | estatica | src/web.mjs | funciona, explica |
| `/api/federacao` | estatica | src/web.mjs | funciona, explica |
| `/api/federacao/pedir` | estatica | src/web.mjs | funciona, explica |
| `/api/conexao` | estatica | src/web.mjs | funciona, explica |
| `/api/federacao/config` | estatica | src/web.mjs | funciona, explica |
| `/api/federacao/enviar` | estatica | src/web.mjs | funciona, explica |
| `/api/federacao/pausar` | estatica | src/web.mjs | funciona, explica |
| `/api/federacao/retomar` | estatica | src/web.mjs | funciona, explica |
| `/api/glossario` | estatica | src/web.mjs | funciona, explica |
| `/api/pedidos` | estatica | src/web.mjs | funciona, explica |
| `/api/meu` | estatica | src/web.mjs | funciona, explica |
| `/api/fila-perdida` | estatica | src/web.mjs | funciona, explica |
| `/api/rotas` | estatica | src/web.mjs | funciona, explica |
| `/api/projetos/resumo` | estatica | src/web.mjs | funciona, explica |
| `/api/etiquetas` | estatica | src/web.mjs | funciona, explica |
| `/api/framework/projetos` | estatica | src/web.mjs | funciona, explica |
| `/api/roadmap/estado` | estatica | src/web.mjs | funciona, explica |
| `/api/modulos` | estatica | src/web.mjs | funciona, explica |
| `/api/bancada` | estatica | src/web.mjs | funciona, explica |
| `/api/framework` | estatica | src/web.mjs | explica |
| `/api/projeto/novo` | estatica | src/web.mjs | funciona, explica |
| `/api/registro/projetos` | estatica | src/web.mjs | funciona, explica |
| `/api/entrevista` | estatica | src/web.mjs | funciona, explica |
| `/api/marcos` | estatica | src/web.mjs | funciona, explica |
| `/api/hooks` | estatica | src/web.mjs | funciona, explica |
| `/api/hooks/provar` | estatica | src/web.mjs | funciona, explica |
| `/api/rotinas` | estatica | src/web.mjs | funciona, explica |
| `/api/foco` | estatica | src/web.mjs | funciona, explica |
| `/api/paineis-meus` | estatica | src/web.mjs | funciona, explica |
| `/api/quadro-projetos` | estatica | src/web.mjs | funciona, explica |
| `/api/sincronia` | estatica | src/web.mjs | funciona, explica |
| `/api/sincronia/acao` | estatica | src/web.mjs | funciona, explica |
| `/api/tela` | estatica | src/web.mjs | explica |
| `/api/gate/conversas` | estatica | src/web.mjs | funciona, explica |
| `/api/gate/modo` | estatica | src/web.mjs | funciona, explica |
| `/api/ia/provedores` | estatica | src/web.mjs | funciona, explica |
| `/api/gate/modelos` | estatica | src/web.mjs | funciona, explica |
| `/api/gate/conversa` | estatica | src/web.mjs | funciona, explica |
| `/api/gate/nova` | estatica | src/web.mjs | funciona, explica |
| `/api/gate/mensagem` | estatica | src/web.mjs | funciona, explica |
| `/api/decisao/responder` | estatica | src/web.mjs | funciona, explica |
| `/api/decisao/permitir` | estatica | src/web.mjs | funciona, explica |
| `/api/deploy/estado` | estatica | src/web.mjs | funciona, explica |
| `/api/deploy/confirmar` | estatica | src/web.mjs | funciona, explica |
| `/api/deploy/recusar` | estatica | src/web.mjs | funciona, explica |
| `/api/deploy/sugestoes` | estatica | src/web.mjs | funciona, explica |
| `/api/deploy/cadastrar` | estatica | src/web.mjs | funciona, explica |
| `/api/deploy/pedir` | estatica | src/web.mjs | funciona, explica |
| `/api/decisao/config` | estatica | src/web.mjs | funciona, explica |
| `/api/cartas/explicar` | estatica | src/web.mjs | funciona, explica |
| `/api/explicacoes` | estatica | src/web.mjs | funciona, explica |
| `/api/cartas` | estatica | src/web.mjs | funciona, explica |
| `/api/cartas/votar` | estatica | src/web.mjs | funciona, explica |
| `/api/cartas/img` | estatica | src/web.mjs | funciona, explica |
| `/api/sessao/etiqueta` | estatica | src/web.mjs | funciona, explica |
| `/api/sessao/fala` | estatica | src/web.mjs | funciona, explica |
| `/api/sessao/conversa` | estatica | src/web.mjs | funciona, explica |
| `/api/decisao/historico` | estatica | src/web.mjs | funciona, explica |
| `/api/decisao/fechar` | estatica | src/web.mjs | funciona, explica |
| `/api/decisao/reabrir` | estatica | src/web.mjs | funciona, explica |
| `/api/decisao/depois` | estatica | src/web.mjs | funciona, explica |
| `/api/decisao/trazer` | estatica | src/web.mjs | funciona, explica |
| `/api/ideias` | estatica | src/web.mjs | funciona, explica |
| `/api/ideias/todas` | estatica | src/web.mjs | funciona, explica |
| `/api/carga` | estatica | src/web.mjs | funciona, explica |
| `/api/leitor` | estatica | src/web.mjs | funciona, explica |
| `/api/projeto/ativo` | estatica | src/web.mjs | funciona, explica |
| `/api/backlog/provas` | estatica | src/web.mjs | funciona, explica |
| `/api/backlog/lugar` | estatica | src/web.mjs | funciona, explica |
| `/api/backlog/aprovar` | estatica | src/web.mjs | funciona, explica |
| `/api/backlog/fila` | estatica | src/web.mjs | funciona, explica |
| `/api/armario` | estatica | src/web.mjs | funciona, explica |
| `/api/armario/arquivo` | estatica | src/web.mjs | funciona, explica |
| `/api/coderoom/arquivos` | estatica | src/web.mjs | funciona, explica |
| `/api/coderoom/comandos` | estatica | src/web.mjs | funciona, explica |
| `/api/armario/docs` | estatica | src/web.mjs | funciona, explica |
| `/api/design/editar` | estatica | src/web.mjs | funciona, explica |
| `/api/design/telas` | estatica | src/web.mjs | funciona, explica |
| `/api/design/fotografar` | estatica | src/web.mjs | funciona, explica |
| `/api/design/mural` | estatica | src/web.mjs | funciona, explica |
| `/api/design/comparar` | estatica | src/web.mjs | funciona, explica |
| `/api/design` | estatica | src/web.mjs | funciona, explica |
| `/api/design/arquivo` | estatica | src/web.mjs | funciona, explica |
| `/api/decisao/parar` | estatica | src/web.mjs | funciona, explica |
| `/api/decisao/mensagem` | estatica | src/web.mjs | funciona, explica |
| `/api/gate/parar` | estatica | src/web.mjs | funciona, explica |
| `/api/gate/permissao` | estatica | src/web.mjs | funciona, explica |
| `/api/gate/agente` | estatica | src/web.mjs | funciona, explica |
| `/api/gate/revisor` | estatica | src/web.mjs | funciona, explica |
| `/api/gate/acesso` | estatica | src/web.mjs | funciona, explica |
| `/api/gate/renomear` | estatica | src/web.mjs | funciona, explica |
| `/api/gate/opencode-modo` | estatica | src/web.mjs | funciona, explica |
| `/api/gate/apagar` | estatica | src/web.mjs | funciona, explica |
| `/api/gate/arquivar` | estatica | src/web.mjs | funciona, explica |
| `/api/gate/maestro` | estatica | src/web.mjs | funciona, explica |
| `/api/gate/nota` | estatica | src/web.mjs | funciona, explica |
| `/api/arquiteto/responder` | estatica | src/web.mjs | funciona, explica |
| `/api/arquiteto/comecar` | estatica | src/web.mjs | funciona, explica |
| `/api/produto` | estatica | src/web.mjs | funciona, explica |
| `/api/produto/seguranca` | estatica | src/web.mjs | funciona, explica |
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
| `/api/custo` | estatica | src/web.mjs | funciona, explica |
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
| `/api/pastas` | estatica | src/web.mjs | funciona, explica |
| `/api/sintese` | estatica | src/web.mjs | funciona, explica |
| `/api/digest` | estatica | src/web.mjs | funciona, explica |
| `/api/caminho` | estatica | src/web.mjs | funciona, explica |
| `/api/sprints/conta` | estatica | src/web.mjs | funciona, explica |
| `/api/git/mudancas` | estatica | src/web.mjs | funciona, explica |
| `/api/git/salvar` | estatica | src/web.mjs | funciona, explica |
| `/api/git` | estatica | src/web.mjs | funciona, explica |
| `/api/maquina` | estatica | src/web.mjs | funciona, explica |
| `/api/instalacao` | estatica | src/web.mjs | funciona, explica |
| `/api/kill` | estatica | src/web.mjs | funciona, explica |
| `/api/paineis` | estatica | src/web.mjs | funciona, explica |
| `/api/paineis/ligar` | estatica | src/web.mjs | funciona, explica |
| `/api/paineis/desligar` | estatica | src/web.mjs | funciona, explica |
| `/api/escritorio` | estatica | src/web.mjs | funciona, explica |
| `/api/rotas/pedido` | estatica | src/web.mjs | funciona, explica |
| `/api/rotas/alternar` | estatica | src/web.mjs | funciona, explica |
| `/api/shutdown` | estatica | src/web.mjs | funciona, explica |

## palavra (85)

| item | camada | onde | o que falta |
|---|---|---|---|
| `tela: inicio` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: caminho` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: tarefas` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: decisoes` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: armario` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: design` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: ideias` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
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
| `rotas do projeto` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `o que mudou` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `importância` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `o que fazer agora` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `o que está encalhado` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `agora` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `na fila` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `abertas` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `prontas` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: analise` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: infra` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: servidores` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: docker` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: vps` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: maquina` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: tempo` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `janela: pastas` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: rotas` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tela: ligados` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
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
| `tela: conhecimento` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `agente` | estatica | docs/produto/PALAVRAS-DA-TELA.md | nada |
| `sem contato` | estatica | docs/produto/PALAVRAS-DA-TELA.md | nada |
| `esperando você` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `trabalhando` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `parado` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `quebrou` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `máquina` | estatica | docs/produto/PALAVRAS-DA-TELA.md | nada |
| `federação` | estatica | docs/produto/PALAVRAS-DA-TELA.md | nada |
| `frente` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `to-do` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `sprint` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `product backlog` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `token` | estatica | docs/produto/PALAVRAS-DA-TELA.md | nada |
| `cache lido` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `janela de 5h` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `janela semanal` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `custo de API` | estatica | docs/produto/PALAVRAS-DA-TELA.md | nada |
| `sobra` | estatica | docs/produto/PALAVRAS-DA-TELA.md | nada |
| `corte` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tempo ativo` | estatica | docs/produto/PALAVRAS-DA-TELA.md | nada |
| `framework` | estatica | docs/produto/PALAVRAS-DA-TELA.md | nada |
| `modo do framework` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `papel` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `entrevista` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `módulos do framework` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `comunicação` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `entrega` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `código` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `tarefas dele` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `rota` | estatica | docs/produto/PALAVRAS-DA-TELA.md | nada |
| `hook` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `gate` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `servidor de desenvolvimento` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `container` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |
| `painel embutido` | estatica | docs/produto/PALAVRAS-DA-TELA.md | funciona |

