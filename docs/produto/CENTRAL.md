# A central de controle das sessões

Visão dele em 27/09, registrada antes de construir (CC-588 a CC-593):

> *"decisões, talvez não seja nem o nome perfeito. Talvez é mais uma janela,
> que onde mostra a última mensagem, um resumo do que aconteceu, e pra eu
> responder a sessão (…) nem sempre é só sobre o que o chat me pede pra fazer.
> Às vezes é pra eu falar o próximo passo (…) passa a ser uma central onde eu
> faço meio que um controle de todos os meus agentes ao mesmo tempo"*

## O que ele pediu, peça por peça

1. **Toda sessão aberta tem cartão**, não só a que perguntou algo (CC-588).
2. **Resumo curto, e a resposta completa ao abrir** (CC-589).
3. **Opções uma embaixo da outra, estilo quiz**, e sempre dá para escrever
   outra resposta (CC-590).
4. **Ações rápidas:** "continuar" e "encerrar" (o `/exit` depois do commit)
   (CC-591).
5. **O mosaico se reorganiza** quando um cartão abre (CC-592).
6. **O nome da tela** (CC-593), decisão dele.

7. **Uma tela só, com filtros** (CC-594). Logo depois, ainda em 27/09:
   *"gostei de juntar decisões, sessões e agentes numa tela só, e isso passa a
   funcionar como filtros, eu posso filtrar as sessões por decisões, agentes e
   até outras coisas"*. As três telas de hoje (Decisões, o atalho Sessões e a
   tela Agentes) viram recortes da mesma lista: esperando você, trabalhando,
   paradas, por projeto, por máquina.

## O que já existe e o que falta

| Peça | Hoje | Falta |
|---|---|---|
| cartão por sessão | só a parada, com pergunta ou sem | a que trabalha e a ociosa sem fala |
| responder | opções (lado a lado) e campo livre, só VPS | empilhar; campo em toda sessão |
| resumo | a primeira frase da última fala | resumo + resposta inteira ao abrir |
| ações | "parar" (Esc), só em quem trabalha | "continuar" e "encerrar" |
| mosaico | já encaixa | reencaixar ao abrir (já acontece: o encaixe observa a altura) |

## Como o resumo sai, sem gastar modelo

As respostas dos agentes dele já trazem a linha `// resumo //`, separando o
raciocínio do que mudou para ele. O resumo do cartão é o que vem **abaixo** dela;
sem a linha, as três primeiras frases. A resposta inteira vem do arquivo da
conversa, que o painel já lê. Nenhuma chamada nova a modelo.

## Limites conhecidos

- Responder, continuar e encerrar só funcionam em sessão **desta** máquina: o
  painel não alcança o terminal do PC (CC-564, na fila).
- "Encerrar" manda `/exit` no terminal da sessão; pede confirmação, porque a
  conversa acaba ali.

## Feito em 27/09

Nome escolhido por ele: **Sessões** (a tela Decisões virou a central; Decisões
e Agentes saíram do menu, e a tela Agentes segue para o detalhe de uma sessão).
- Todas as sessões abertas numa lista só, com filtros de estado, máquina e
  projeto (CC-588, CC-594).
- Resumo (o trecho abaixo de "// resumo //") e "ver resposta completa"
  (CC-589), pela rota `/api/sessao/fala`.
- Opções uma embaixo da outra, com bolinha de marcar (CC-590).
- "Continuar" e "encerrar" (`/exit`, com confirmação) nas sessões paradas desta
  máquina (CC-591). Provado na tela com o envio interceptado; o `/exit` de
  verdade ainda não foi mandado a nenhuma sessão.
- O mosaico reencaixa quando a resposta abre (CC-592).

Ficou para depois: responder escrevendo sem a janelinha do navegador (hoje
"outra resposta…" abre a caixa de texto do próprio navegador), e as sessões do
PC, que o painel só lê (CC-564).
