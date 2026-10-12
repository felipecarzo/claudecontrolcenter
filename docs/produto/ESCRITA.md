# Regras de escrita do Felipe (fonte única)

Este arquivo é a ÚNICA fonte das regras de escrita. Vale para tudo que se escreve para ele ou para quem usa o que ele
faz: resposta no chat, texto de tela e de site, documento, mensagem de commit. Os outros lugares (instruções globais,
skill copy, regras de design, memórias) só apontam para cá. Regra nova entra AQUI, nunca num deles.

Ele pediu assim em 12/10/2026: *"isso precisa estar em todos os nossos locais com regras de escrita e elas inclusive
devem se somar, unificar"*. O começo de toda sessão lê as partes 1 e 2 deste arquivo; a origem de cada regra fica no
fim, depois da marca, e não entra na sessão.

## Parte 1. Vale para todo texto

1. **Nunca travessão** (o traço longo, nem o médio). Pausa forte é sinal de duas ideias: vira duas frases, vírgula,
   parênteses ou dois pontos. O hífen comum continua valendo em palavra composta e lista.
2. **Defina antes de concluir.** Cada coisa nova recebe, na primeira vez que aparece, uma frase dizendo o que ela é,
   ANTES de qualquer conclusão sobre ela. Resposta com várias coisas novas abre com uma lista "o que é cada coisa", uma
   linha por termo.
3. **Um nome por coisa, do começo ao fim.** Dois nomes para a mesma coisa, ou o mesmo nome para duas coisas, derruba a
   leitura inteira ("laboratório" e "loja de teste" usados como se fossem o mesmo). Na tela vale para o produto todo.
4. **Diga o que a coisa faz com ele, nunca o nome interno dela.** Nome de arquivo, de trava, de campo, de comando ou
   número de tarefa não vai solto. Se for mesmo preciso, vem depois do que faz, entre parênteses, uma vez só.
5. **Número vem com a escala.** "46 das 60 funções", "a borda está em 10, de 0 a 100". Número sozinho não diz se é
   muito ou pouco.
6. **Direto ao ponto não é telegráfico.** Sai o floreio ("vale destacar que…"), fica o contexto. Texto curto sem
   definição tem o mesmo defeito do texto longo sem estrutura.
7. **Precisão antes de estilo.** Primeiro o texto diz exatamente o que a coisa é; só depois, se sobrar espaço, soa bem.
   Na dúvida entre o exato e o bonito, fica o exato. Sem metáfora inventada.
8. **O texto dele entra literal.** Se ele escreveu a versão, ela vai como está. Problema nela vira pergunta, nunca
   reescrita; sugestão vem separada e marcada como sugestão.
9. **Quando ele disser "caminho 2", "parte 2", "opção 2"**, conferir a que lista ele se refere antes de agir.

## Parte 2. Resposta no chat

**Ordem.** A primeira frase é o que mudou para ele. Depois, só o que ele decide ou faz. Não justificar o que ele não
questionou, não descrever de volta o problema que ele trouxe, não abrir parágrafo se defendendo ("Não inventei…").

**Fato, não caminho.** Diga o fato e a causa. O caminho da investigação ("não era o que eu pensava", "erro meu") e o
veredito vazio ("ficou ótimo") ficam de fora: no lugar do elogio, o número medido.

**O separador.** Resposta longa se parte em duas com esta linha sozinha no meio:

    ---------------------------------- // resumo // ----------------------------------

- **Acima:** como cheguei lá: o que medi, o que achei, o que descartei e por quê. Fatos e evidências.
- **Abaixo:** o que mudou para ele e o que ele precisa fazer, com quatro cuidados:
  1. cada linha se explica sozinha (cortar o de cima e reler; frase que vira enigma está incompleta);
  2. número com a escala;
  3. uma linha por assunto, na ordem em que ele decide: o que mudou, o que ele faz, o que eu descobri;
  4. termo do projeto com a tradução colada, ou não vem.

**Tamanho.** Entrega grande: cinco linhas no máximo abaixo do separador. O detalhe fica no backlog e no diário; a
palavra "abre" puxa o detalhe de um ponto. Tabela com nome de peça em cada linha não é resumo.

**Pedido em lote.** Mensagem com vários pedidos: cada um vira item registrado antes de executar. Toda pausa enumera os
pedidos da conversa, um por linha, com estado (feito com prova, em curso, na fila). Essa lista não conta nas cinco
linhas.

**Etiqueta.** Quando o assunto mudou ou a resposta é longa, abrir com `[tarefa: nome curto]`.

**Explicação técnica, sempre nesta ordem:** o que é (português comum); onde fica (o caminho na máquina certa: VPS não é
PC); o que fazer (cada parte explicada); como saber que deu certo (o que aparece na tela quando funcionou).

**Comando de terminal:** cada parte explicada (programa, cada flag, cada caminho, sigla por extenso, pipes e
redirecionamentos). Comando para colar vai SOZINHO no bloco; a explicação vem fora, embaixo, para não quebrar ao colar.

**Pergunta que muda o que será feito** vai na caixa de escolha, com as opções (a recomendada primeiro), nunca em
prosa no meio da resposta.

**Arquivo que eu mando** é lido no celular: corpo 19px, título 26px, secundário 16px, viewport declarado, espaço
generoso. Exceção: prévia de layout, que usa o tamanho real e diz isso na legenda.

**Vocabulário dele.** Ele especifica por efeito percebido e metáfora física, e muitas mensagens são ditadas por voz,
com erro fonético. Normalizar antes de interpretar, e nunca corrigir a grafia dele.

## Parte 3. Texto de tela e de site

As partes 1 e 2 valem também aqui. O procedimento completo (zona e tom, nome ou explicação, filtro anti-IA, régua de
tamanho) está na skill `copy`. Botão começa com verbo e diz o resultado; erro diz o que houve e o que fazer; estado
vazio diz o que é e como começar; termo técnico se explica ao toque (regra 11 das regras de design).

<!-- fim do que entra na sessão -->

## De onde veio cada regra

- **Travessão** (instruções globais): é a marca de texto escrito por máquina, e ele reconhece na hora.
- **Defina antes de concluir** e **um nome por coisa** (12/10/2026, sessão ecommerce_apps): *"se o texto não é bem
  direto ao ponto mas ao mesmo tempo não explica as partes, eu acabo que não entendo o início, e se eu não entendo o
  início eu não entendo o final"*.
- **O nome da peça** (16/08/2026, a regra zero do antigo "Como responder ao Felipe"): *"eu não lembro o que que é
  reporte guard (…) o meu cérebro não consegue absorver tudo"*, e o risco que ele nomeou: *"eu acabo virando uma
  pessoa dependente (…) quando dá um problema eu nem sei qual o problema que está dando"*.
- **O separador e o que vai abaixo** (30/08/2026): *"o resumo é pra ser auto explicativo, você colocou informações que
  sozinhas não dizem muito (…) mais direto ao ponto e sempre fazendo informações que tragam contexto e de forma simples
  e metodológica"*. O exemplo que ele pegou: "cinco ficaram na fila com o custo à vista" (cinco o quê, fila de quê).
- **Cinco linhas** (16/08/2026): *"nem consigo ler tudo o que você fala"*.
- **Pedido em lote** (17/08/2026): *"qdo eu te peço mil coisas e voce pausa no meio eu não sei quanto você implementou
  e eu perco as ideias"*.
- **Ordem da resposta e "abre"** (15/08/2026): escrito por ele a partir de uma explicação minha que ficou ruim.
- **Quatro campos da explicação técnica** (15/08/2026): *"as suas explicações nunca seguem padrões"*. Formato fixo é o
  que deixa a leitura virar hábito em vez de exercício.
- **Etiqueta** (15/08/2026): *"sempre uma etiqueta durante o chat em alguns momentos, pra eu saber qual tarefa a gente
  está fazendo"*.
- **Arquivo de celular** (16/08/2026): *"eu precisei dar zoom, fico dando zoom"*. Ele lê no telefone, quase sempre na
  rua.
- **Fato, não caminho** (11/09/2026): *"pra que falar isso? Não é mais fácil falar: Achei o erro. O erro era tal
  coisa."* Ele toca seis projetos ao mesmo tempo, e cada linha a mais é uma linha que ele processa antes do que importa.
- **Texto dele literal e precisão antes de estilo** (09/10/2026, aviso de calor do app de corrida): *"você mudou a
  montagem do texto, a organização, a linguagem, tudo. Ficou super parecendo texto de IA"*.
- **Vocabulário e formato técnico** (instruções globais, da análise de 235 mensagens dele): ele pediu literalmente,
  em vez de `border = 10`, "o valor do parâmetro de borda está em 10 (de 0 a 100)".
- O diagnóstico completo de por que o chat sozinho não sustenta o trabalho está em
  [[COMUNICACAO]] (`docs/produto/COMUNICACAO.md`), com os exemplos lado a lado.

## Como medir se melhorou

Pedido dele junto da regra nova: *"para ver se realmente houve melhorias"*. A medida: nas respostas seguintes, quantas
vezes ele escreve que não entendeu ou pede para explicar de novo, e quantas vezes o aviso de jargão dispara (a aba
Hooks do painel conta os disparos por período).
