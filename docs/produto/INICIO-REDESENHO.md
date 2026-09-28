# Início redesenhada, a partir da imagem do ChatGPT

Pedido dele em 26/09, com a imagem (`assets/feedback/260926/chatgpt-inicio.webp`):

> *"olha as melhorias que a IA do chat gpt fez. Precisamos pegar isso,
> transformar tudo em svg, identificar as melhorias por cada quadradinho e
> abstrair disso, criar um backlog e implementar, a organização, o design, o ux
> e ui, os botões no topo, as abas, TUDO tá muito melhor, tudo tudo tudo, os
> mínimos detalhes como os ícones, as cores"*

**Leitura de "transformar tudo em svg":** todo ícone da imagem vira desenho
vetorial no código (SVG em linha), nada de imagem colada nem emoji. A mãozinha
do título inclusive.

**Regra que vale para a imagem inteira:** o DESENHO vem dela, o DADO não. A
imagem inventa conteúdo ("Refatorar API", "Integração n8n", o texto
"Será implementado um job…", o contador de comentários). Na tela vai o dado de
verdade do painel no mesmo lugar, e onde não existe dado real, a peça espera
decisão dele em vez de mostrar coisa inventada.

## O que é melhor, quadro por quadro

Cada item vira uma linha do backlog (CC-569 a CC-580).

1. **Paleta e profundidade (CC-569).** Fundo azul-marinho quase preto, cartões
   um tom acima com borda fina azulada, cantos de 14px, sombra suave. Cor por
   assunto: azul (tarefas e projetos), verde (sessões), âmbar (decisões), roxo
   (desenvolvimento). Números grandes e brancos, texto de apoio cinza-azulado.
2. **Ícones (CC-570).** Traço fino e uniforme (1,75px), cantos arredondados,
   sempre do mesmo conjunto. Ícone de assunto dentro de um quadrado colorido
   de cantos arredondados (tarefa: check; sessão: raio; projeto: pasta;
   decisão: relógio).
3. **Barra de cima (CC-571).** Busca larga "Buscar no cockpit… (ex: projeto,
   tarefa, decisão, arquivo)" com atalho ⌘K; à direita sino, tema claro/escuro,
   dois atalhos e o avatar com menu.
4. **Boas-vindas (CC-572).** "BEM-VINDO DE VOLTA," pequeno, "Seu cockpit,
   Lipe" grande com a mão, frase de apoio, e à direita a pastilha de saúde:
   bolinha verde, "61 serviços ativos", "21 projetos · 39ms máx" e um traço de
   pulso. Substitui a faixa das máquinas.
5. **Quatro números (CC-573).** Tarefas, Sessões ativas, Projetos, Decisões
   pendentes: ícone colorido, número grande, "de N" e barra de progresso da
   mesma cor.
6. **Abas (CC-574).** Decisões, Sessões, Tarefas, Mensagens, Atividade, com a
   ativa em destaque. Ver a pergunta 2 abaixo.
7. **Cartão de decisão (CC-575).** Ícone colorido à esquerda, título em uma
   linha, etiqueta de categoria colorida + "há 48 min", descrição em duas
   linhas, seta à direita. Título do bloco com contador em pastilha e "Ver
   todas →".
8. **Cartão de sessão (CC-576).** Bolinha de estado, nome, "há 12 min",
   descrição curta, pastilha de estado à direita ("agente ativo",
   "em progresso").
9. **Notas rápidas (CC-577).** Linhas com ícone por tipo e "há 12 min" à
   direita; o campo "Nova nota…" com o "+" azul no pé do bloco.
10. **Coluna da direita (CC-578).** Foco do dia no topo (ver pergunta 1),
    Tarefas com círculo de marcar, Kanban em duas colunas pequenas
    ("A fazer" e "Em andamento") com cartõezinhos etiquetados, Ideias com
    ícone de lâmpada em quadrado âmbar.
11. **Menu lateral (CC-579).** Logotipo com marca própria, item ativo em
    pílula azul cheia, ícones do mesmo conjunto, grupos com seta, bolinha
    verde de "tem novidade" em Análise, e o cartão "Sistema online · 61
    serviços | 21 projetos" no pé.
12. **Itens novos no menu (CC-580).** Sessões, Tarefas, Notas e Kanban como
    entradas próprias. Ver a pergunta 3.

## As três decisões dele (26/09)

- **Foco do dia:** *"eu escrevo"*. Lápis no cartão, Enter guarda, vale no
  telefone e no computador. A segunda metade da resposta é visão e ficou
  registrada sem construir (CC-581): *"podemos criar uma área onde a IA usa
  inteligência pra me pedir prazo pros projetos, alinhar com as minhas
  expectativas, debater prazos etc, e isso pode gerar também"*.
- **Abas:** trocam a coluna do meio. Mensagens é o que cada agente disse por
  último; Atividade são os commits de hoje de todos os projetos.
- **Sessões, Tarefas, Notas e Kanban no menu:** atalhos para onde já moram.

## Correção dele, no mesmo dia: era só o design

O primeiro passe (descrito abaixo) trocou a ESTRUTURA da Início pela da
imagem, e com isso sumiu o que tinha sido decidido bloco a bloco: o mosaico que
se encaixa, o expandir, as perguntas inteiras com opções e botão de responder,
as notas completas, o kanban por projeto. Palavras dele: *"você tirou muitas
coisas do antigo (…) mudou tudo camarada, era só o design"*.

O que ficou depois da correção:
- a estrutura e o conteúdo são os de antes, bloco por bloco, com o expandir;
- entrou só visual: paleta, sombras, ícone e nome em letra de título em cada
  bloco, cartão de decisão com quadrado colorido e etiqueta do projeto (a
  pergunta inteira, as opções e o responder continuam), o × preso no canto;
- continuam, por serem acréscimos: a busca do topo, os atalhos do menu, o
  logotipo, o cartão "Sistema online" e o Foco do dia como mais um bloco;
- saíram só as colunas fixas.

Logo depois, com print do topo: *"camarada eu gostava dessa parte"*. Voltaram
como acréscimo em cima do mosaico: a faixa de boas-vindas (o cartão de saúde
ficou no lugar da faixa das máquinas, com a mesma informação e a bolinha por
máquina do item 2), os quatro números e as abas. As abas, decisão dele:
**filtram o mosaico**. "Tudo" mostra todos os blocos como sempre; cada aba
mostra só o bloco dela, na largura inteira e em duas colunas. Mensagens (a
última fala de cada agente) e Atividade (os commits de hoje) viraram blocos
novos, que também aparecem em "Tudo".

## O primeiro passe, que foi corrigido (26/09)

Os 12 itens, provados em 1536px (a largura da imagem) e em 390px, sem
rolagem lateral. A imagem não mostra gaveta, semana, limites, agenda,
máquinas e serviços: eles ficaram embaixo, no mosaico com o expandir.

Diferenças deliberadas, porque o dado não existe:
- os números dizem "Tarefas abertas", não "Tarefas hoje" (o painel não sabe o
  que é de hoje), e o "de N" é sempre uma conta real;
- o Kanban pequeno tem "Você decide" e "Em andamento" em vez de "A fazer":
  "a fazer" no quadro são 348 cartões;
- o cartão de decisão não tem contador de comentários, que não existe;
- sem o botão de tema claro: esta página não tem tema claro, e botão que não
  faz nada é pior que botão nenhum. Fica para quando o tema existir;
- a barra do foco do dia não tem o "2/3": nenhuma tarefa está ligada ao foco.
