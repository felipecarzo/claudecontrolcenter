<!-- GERADO por src/backlog.mjs a partir de docs/backlog.jsonl.
     NÃO EDITE ESTE ARQUIVO: a fonte é o .jsonl, e o que você escrever aqui
     some na próxima geração. Para mexer: `cc backlog`. -->

# ROADMAP — o que está aberto neste projeto

94 abertos, 882 fechados, 976 no total. Gerado em 2026-10-07.

## ⚠️ Travados, com a causa medida

- **CC-564** responder pelo painel as perguntas das sessoes do PC: medir se um gancho na pergunta entrega a resposta, sem depender de tela — teste interativo recusado pelo classificador de permissao; precisa ele autorizar a sessao de teste no tmux

## travas

| id | estado | peso | o que é |
|---|---|---|---|
| CC-294 | definida | 3 | a amostra julgada: 30 devoluções lidas lado a lado |
| CC-917 | prova | - | trava: resposta que deixa ideia longa dele só no texto, sem item no backlog, é barrada uma vez |
| CC-960 | andando · 3 de 5 | - | trocar modelo e esforco sozinho pela complexidade da tarefa, com regras reais em todos os projetos |
| CC-967 | prova | - | trava: o robo nunca constroi sozinho um item que ja teve obra aprovada (reconstruiu o MVP e o backup em 07/10) |

## projetos

| id | estado | peso | o que é |
|---|---|---|---|
| CC-317 | definida | 3 | criar projeto no PC e na VPS pelo mesmo caminho |
| CC-832 | definida | - | Padrão de projeto: micro tarefa como filha do item no backlog, projeto novo nasce no padrão, migrar todos os projetos |
| CC-874 | prova | - | instalar dependencias em ibrics, inovallbond, overwatch e frontend do profinance para a conferencia rodar |
| CC-896 | prova · 0 de 1 | - | zona de caminho do projeto: backlog como trilha animada com o feito, onde estamos e os marcos |
| CC-923 | prova | - | varredura de segurança em todos os projetos da VPS com o catálogo ASVS nível 1, começando pelos que têm login e dados de pessoas |
| CC-966 | prova | - | celular sem barra inferior: menu hamburguer no topo com barra lateral (ajustes de letra e tema dentro), topo enxuto como o Coderoom |
| CC-969 | ideia | - | aplicativo de Android do painel: so quando houver algo que o app instalado pelo Chrome nao faca (widget, atalho de voz) |
| CC-984 | definida | - | Medir no Conta de Casa quanto o opencode economizou contra o limite semanal e mensal do Claude, e provar que o app funciona |
| CC-985 | definida | - | Guia de cada projeto: diz se é teste ou não e, nos de teste, o que comparar no fim (tokens gastos, economia contra o Claude) |

## cockpit

| id | estado | peso | o que é |
|---|---|---|---|
| CC-496 | definida | - | so quero que as informacoes redundantes sumam e as importantes sejam organizadas de forma correta; coisa que eu veja pouco mas bem organizada pode ser util; o problema e coisa pouco util no dia a dia virar ruido no meio do importante cockpit 2 |
| CC-539 | prova | - | framework so reconhece projeto com pasta ja marcada; ideia dele: projeto nasce no framework, pastas no PC/VPS vem depois, sincronizadas |
| CC-557 | prova | - | cockpit novo: uma engenharia tipo SDD que deixa o agente decidir e fazer sozinho o que nao depende de mim |
| CC-558 | andando | - | cockpit novo: uma area de construcao de design para os projetos |
| CC-559 | prova | - | cockpit novo: notas continua importante, mas o app de notas precisa melhorar |
| CC-562 | prova | - | estudar o JEV (modelo barato de decisao sim/nao e nota) para rodar num modelo barato ou no Gemini pelo agy, nao aqui |
| CC-564 | travado | - | responder pelo painel as perguntas das sessoes do PC: medir se um gancho na pergunta entrega a resposta, sem depender de tela |
| CC-581 | definida | - | visao: area onde a IA pede prazo dos projetos, alinha expectativas, debate prazos e gera o foco do dia |
| CC-655 | prova · 1 de 1 | - | design 2/4: telas e prototipos por projeto, com versoes, e ele aprova qual vira codigo |
| CC-656 | prova | - | design 3/4: mural de referencias por projeto (prints, sites de inspiracao, feedback) para mostrar ao agente quero assim |
| CC-657 | prova | - | design 4/4: comparar versoes de uma tela lado a lado (antes e depois, 390 e 1536) e aprovar ou pedir ajuste dali |
| CC-658 | prova · 1 de 1 | - | design 1b: ajustar a identidade pelo painel (cores, fontes, regras), gravando no arquivo de design do projeto |
| CC-659 | andando | - | passada no painel inteiro: extrair os padroes das telas ja refeitas e aplicar ao resto, juntando e apagando telas |
| CC-732 | definida | - | Sessoes do PC ficam presas e nao atualizam no Cockpit da VPS |
| CC-734 | definida | - | Sessoes do PC que nem aparecem no Cockpit da VPS |
| CC-753 | definida | - | Instalavel unico do Cockpit para Windows: executa, vira servico automatico e pega os projetos da maquina, sem repositorio nem programar nela |
| CC-765 | prova | - | Widescreen de Sessoes: paineis como os do Coderoom, reordenaveis, com adicionar e recolocar; talvez duas sessoes lado a lado |
| CC-769 | definida | - | Botao no cartao leva ao desktop do projeto no PC via a controladora; popup em cada desktop volta ao Cockpit, que vira a central |
| CC-795 | prova | - | Coderoom: com o menu de tres pontos aberto, os controles vao para o meio do cabecalho e as fichas (estado, maquina, agentes) somem |
| CC-856 | prova | - | Dez rotas só do painel antigo sem tela no cockpit novo: ligar cada uma ou tirar do servidor |
| CC-865 | prova | - | o painel passa a se chamar Ogumia na tela e no guia, mantendo os nomes internos |
| CC-879 | prova | - | Sessoes: cada conversa do Coderoom vira UM card responsivo com suas tarefas e o resumo do agy, sem agrupar 21 sessoes paradas num card so |
| CC-883 | prova | - | tela própria Tarefas no menu, com pedido, pedidos, tarefas por projeto e gaveta; a aba da Início continua |
| CC-893 | prova | - | card de conversa do Coderoom na tela Sessoes ganha botao arquivar (com desfazer): hoje so tem renomear e abrir sessao |
| CC-895 | definida | - | endereco no testedevoo para app simples de Node (como o Conta de Casa): o dev.sh nao tem esse tipo e o roteador exige o prefixo |
| CC-906 | prova · 0 de 6 | - | Tinder like fixo no cockpit: decidir tudo por cartões, uma mão, sem digitar, em Sessões inteira ou num projeto só |
| CC-933 | prova | - | segurança: registro de auditoria central de login, aprovação, deploy e religar, com quem, quando e de onde |
| CC-936 | andando | - | aba Tarefas mostra o que foi feito, o que está em prova e o que vem, cada item com a explicação na língua dele |
| CC-957 | prova | - | sessao parada ha dias aparece como parou ou espera voce: separar como esquecida (3+ dias) e alertar no sino as que ocupam memoria |
| CC-972 | definida | - | dado principal do painel leva de 2 a 8 s para sair do servidor; medir o que pesa e cortar |
| CC-982 | prova | - | sessao recem aberta tem campo de escrever obrigatorio, com audio e chamar skill; campo com skill e audio vira padrao em todo chat do cockpit |
| CC-983 | prova | - | resumo do agy por nivel: ate a minha ultima pergunta, cada nivel sobe mais uma mensagem minha; mensagens seguidas contam como uma |
| CC-986 | prova | - | area de ideias no Caminho: ditar ou escrever a ideia, a IA quebra em tarefas, pergunta o lugar na fila e grava no backlog |
| CC-987 | prova | - | cada aba do painel (Caminho, Sessoes e as outras) instalavel como app separado no celular |
| CC-988 | prova | - | barra lateral direita (responder sessoes) com largura ajustavel arrastando a borda, igual a esquerda |

## framework

| id | estado | peso | o que é |
|---|---|---|---|
| CC-500 | prova | - | URGENTE: transformar o projeto num FRAMEWORK. voltar pra raiz: como funciona a criacao de um projeto, como o framework age no projeto, como o projeto se auto-registra, como o framework identifica esses registros framework |
| CC-501 | definida | - | tarefa nao e linguagem natural: a IA limita a sintese dos raciocinios a termos pre-definidos, mesmo que a lista seja gigante. ex: 'pedido: construcao de sistema - intencao: ~ criar framework pra gerenciar agentes - definicao de pronto: ...'. o ~ marca o que a IA interpreta framework |
| CC-503 | definida | - | projetos ativos e inativos definidos pela intencao do cliente; robos pra vasculhar os sites dos clientes procurando problemas eventuais framework |
| CC-532 | prova | - | regra global: toda mudanca diz onde ficou e para quem vale (CLAUDE.md global, 11/09) |
| CC-533 | definida | - | regra global: trava que me barra nao vira conversa (CLAUDE.md global, 11/09) |
| CC-897 | prova · 3 de 5 | - | sprints no Nisaba: marcos do Caminho viram sprints definidos por código com os critérios do ágil |
| CC-913 | prova | - | o arquiteto traça a rota inteira a partir da definição de produto, não só o próximo passo |
| CC-922 | prova | - | requisitos de segurança no mapa do produto: cada parte herda do catálogo o que precisa ser verdade, e a Bancada vira o portão de pronto |
| CC-925 | definida | - | protocolo das perguntas para ele: so pergunta de produto (MVP, PO, backlog); guarda que barra pergunta com foto errada ou repetida |
| CC-926 | prova | - | tudo que esta planejado na sprint (skill de projeto) ja esta aprovado: o agente executa sem perguntar |
| CC-927 | prova | - | sprint deixa explicito os artefatos de engenharia a criar (MER e afins) e isso chega ao agente |
| CC-940 | prova | - | regra geral: projeto inicial nao precisa de login e senha; login so entra quando o projeto ja guarda informacao |
| CC-943 | prova | - | item do backlog dele continua aberto depois de construido e aprovado (Conta de Casa: CN-15 e CN-16 abertos com o MVP pronto) |
| CC-958 | prova · 5 de 5 | - | fila mista: Caminho como prioridade, e ideia nova entra no lugar escolhido (agora, fim do dia, sprint, backlog, fora do MVP) |
| CC-959 | definida | - | retrospectiva do sprint: tokens gastos contra complexidade resolvida, por frente, para achar desperdicio, desfoco ou demora de revisao |

## sincronia

| id | estado | peso | o que é |
|---|---|---|---|
| CC-548 | definida | - | o Chrome da VPS nao alcanca porta local: a rota do container ate o host esta fechada e abrir exige regra de firewall com root |

## coderoom

| id | estado | peso | o que é |
|---|---|---|---|
| CC-741 | definida | - | harness de design no Coderoom: regras de design no contexto do agente e conferencia do resultado apos cada resposta |
| CC-761 | definida | - | segunda simulacao no Coderoom: um sistema inspirado no Pierre, seguindo as regras de design, simulando o Felipe construir |
| CC-802 | definida | - | Simulação 3: o Coderoom cria um jogo ponta a ponta e roda no testedevoo; cada demora ou silêncio do modelo vira trava |
| CC-809 | definida | - | Coderoom: pedido de pasta que é a casa inteira (/home/x/*) mostra aviso de risco no cartão e sugere só o ~/dev.sh |
| CC-814 | definida | - | Coderoom: opencode como servidor vivo pela API (sessão também no terminal), permissão e pergunta ao vivo, compactação nativa |
| CC-820 | definida | - | Simulação 5: o Coderoom cria um jogo 3D de aventura do zero, em projeto novo, no testedevoo |
| CC-828 | definida | - | Coderoom: maestro que divide o pedido em micro tarefas, roda uma a uma no opencode e confere com robô, minimizando IA |
| CC-830 | definida | - | Coderoom: continuar no Coderoom uma tarefa que começou no Claude Code (mesma sessão, outro agente) |
| CC-866 | andando · 1 de 5 | - | agente arquiteto com Haiku: cria projetos pelo Coderoom e pelo framework, tem ideias, revisa e melhora o próprio processo em ciclos |
| CC-871 | definida | - | botao de resposta do arquiteto falhou com nao foi na pergunta CN-2 em 02/10 e nao reproduziu; o botao agora mostra o motivo |
| CC-892 | definida | - | ver os agentes do robo sem eles virarem conversas na lista do Coderoom: outro lugar para acompanhar cada agente |
| CC-921 | prova | - | apagar conversa do Coderoom logo depois do turno derrubava o painel inteiro: relogio escrevia em conversa que nao existia |
| CC-928 | prova | - | opencode e agy pelo painel falham onde o CLI e o Antigravity nao falham: achar a causa (inclusive trava via SSH) |
| CC-930 | prova | - | guarda no Coderoom vigiando os agentes de segundo em segundo (pode usar Haiku) |
| CC-938 | prova | - | Conta de Casa construido pelo Agy no lugar do opencode, com a sessao fazendo o papel dele e auditando cada pergunta |
| CC-939 | prova | - | print da revisao tem que passar pelo login: hoje sai sempre a tela de entrada porque o robo so abre o endereco |
| CC-978 | definida | - | Cartão da conversa do Coderoom mostra o checklist do próprio agente (o agy hoje não grava o texto das tarefas) |
| CC-979 | definida | - | Robô dá o pedido por falho quando o projeto não tem etapa de build nem página pronta para foto, com o trabalho feito |
| CC-980 | prova | - | Conversa de micro tarefa reprovada ou cancelada também vai para os arquivados: o projeto fica com uma conversa só, a do robô |

## padrao

| id | estado | peso | o que é |
|---|---|---|---|
| CC-834 | andando · 10 de 11 | - | o fluxo de projeto vira código: cada tarefa é um objeto que guarda o debate dele e anda sozinho, sem IA onde dá |
| CC-848 | andando · 1 de 6 | - | Nisaba no cockpit inteiro: botão no Coderoom, tela do pedido, regras em toda sessão, conferência por projeto |
| CC-853 | prova | - | visualizações do backlog em dado: kanban melhor e roteiro animado com marcos, meio soft-gamified |
| CC-860 | prova | - | skill do Nisaba: a sessão do próprio projeto avalia e instala o sistema nele, aos poucos |
| CC-864 | prova | - | guia completo do Nisaba com analogias, do nascimento de um projeto ao pedido fechado, com um app de finanças pessoais como exemplo |

## maquinas

| id | estado | peso | o que é |
|---|---|---|---|
| CC-859 | prova | - | Instalar como app no celular a página do Deploy seguro e a do reinício emergencial da VPS, como apps de segurança dele |
| CC-931 | ideia | - | segurança: cabeçalhos no nginx do cockpit e dos sites (HSTS, nosniff, frame-ancestors), que hoje não são enviados |
| CC-932 | prova | - | segurança: alerta ativo quando o painel, a porta de entrada ou um site cair, sem depender de ele perceber |
| CC-934 | ideia | - | segurança: backup da VPS inteira fora dela e um roteiro de restauração testado de verdade |
| CC-935 | prova | - | segurança: confirmar e provar o rollback do deploy seguro (voltar a versão anterior de um site) |
| CC-944 | definida | - | leitura segura: Claude consulta o banco do Ahtleta no ar, so leitura e sem dado pessoal, liberado por 24h com o autenticador |
