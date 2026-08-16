# Estudo: a visão estrutural do projeto (CC-80)

**Ele pediu para ESTUDAR, não para fazer.** Este documento é a entrega do
método `estudo` do framework: a pergunta, as opções com medida, e uma
recomendação. **A decisão é dele** — enquanto ela não vier, nada disto vira
código.

## A pergunta

> Como mostrar a estrutura de um projeto de um jeito que caiba no raciocínio
> visual do Felipe, e que use o vocabulário DELE?

O critério não é meu: está no CC-80, e vem de um achado que já custou caro. O
campo `frente` nasceu porque *"Pierre: travessia gamificada"* não dizia nada a
ele, embora "Pierre" fosse uma seção do ROADMAP do inovallbond. Uma tela de
estrutura que fale em `src/**` em vez de "Bancada" repete o mesmo erro.

## O que já existe, medido hoje neste projeto

Nada aqui precisa ser construído. Já está no repositório e já responde:

| fonte | o que sabe | medido agora |
|---|---|---|
| `dependencias.mjs` | quem quebra se eu mexer aqui | 85 arquivos, 121 ligações, 22ms |
| `roadmap.mjs` | as frentes, na língua dele | 7 frentes, 37 itens |
| `presenca.mjs` + quadro | quem está em qual rota, e com quais arquivos | 2 rotas ocupadas |
| `oficinas.mjs` | quantas pastas de trabalho, em que branch | 2 oficinas |
| `tempo.mjs` | horas por projeto e por frente | histórico completo |
| `escritorio.mjs` | os agentes de todas as máquinas | 6 agentes |

**A informação está toda pronta e espalhada por seis abas.** O problema do CC-80
não é falta de dado: é que nenhuma tela responde "como este projeto é feito por
dentro" numa olhada.

## As três opções, com o que cada uma custa

### A. Mapa de arquivos (grafo de dependência desenhado)

Os 85 arquivos como pontos, as 121 ligações como linhas, tamanho pelo número de
dependentes.

- **Mede:** acoplamento real. `platform.mjs` com 18 dependentes salta à vista.
- **Custo:** um SVG de força dirigida, sem biblioteca (o `graficos.js` já
  desenha SVG à mão). Estimo 300 a 400 linhas.
- **Contra, e é sério:** o vocabulário é `src/platform.mjs`, não "Bancada".
  **É exatamente o erro que o campo `frente` corrigiu.** Ele lê mal texto
  longo e decide bem com mapa — mas com mapa das coisas dele, não das minhas.
- **Quem usa:** eu, muito mais que ele.

### B. Mapa de frentes (o ROADMAP virando território)

As 7 frentes como territórios, cada uma com: quantos itens abertos, quantas
horas já gastas, quem está trabalhando nela agora, e quais arquivos aquela
frente costuma tocar.

- **Mede:** onde o trabalho está indo, na língua dele.
- **Custo:** o cruzamento frente → arquivo não existe hoje. Dá para derivar do
  git: quais arquivos os commits daquela frente tocaram. Estimo 150 linhas mais
  o desenho.
- **Contra:** frente sem commit recente aparece vazia, o que subestima trabalho
  de pesquisa e conversa — e boa parte destes dois dias foi isso.
- **Quem usa:** ele, para decidir prioridade entre frentes.

### C. Mapa de agora (uma tela, o estado do trabalho vivo)

Não é estrutura do código: é estrutura do **trabalho**. Oficinas, agentes,
rotas, arquivos reivindicados e colisões — tudo que já existe, junto.

- **Mede:** quem está onde, e onde dois vão se esbarrar.
- **Custo:** o menor dos três. Os dados já estão prontos (`cc oficina list` já
  imprime quase tudo); falta o desenho. Estimo 150 linhas.
- **Contra:** não responde "como o projeto é feito", que é a pergunta do CC-80.
  Responde "o que está acontecendo".
- **Quem usa:** ele, todo dia, e eu no começo de cada sessão.

## Recomendação: C agora, B depois, A provavelmente nunca

**C** é o que ele usa todo dia e custa menos. Com dois agentes trabalhando em
paralelo a partir de hoje, "quem está onde" deixou de ser curiosidade e virou
operação.

**B** é a resposta de verdade ao CC-80, e depende de uma medição que ainda não
existe (frente → arquivo). Vale fazer depois de C, com o cruzamento derivado do
git em vez de escrito à mão.

**A** eu não recomendo, e é a que eu teria feito por instinto. O mapa de
dependência já existe e já serve **como comando** (`cc deps`), que é o formato
certo para quem o usa — eu. Virar tela bonita gastaria o dobro para servir a
mesma pessoa.

## O que decide

Uma pergunta só, e é dele:

> A tela de estrutura é para você olhar e decidir prioridade, ou para eu olhar e
> não quebrar nada?

Se for a primeira, é B. Se for a segunda, o `cc deps` já basta e o CC-80 fecha
sem código novo.
