# O escritório e o cockpit: quem faz o quê

Decisão do Felipe em 16/08, que encerrou o CC-60:

> "eu só quero ficar com o plugin que é um fork meu no projeto app_escritorio, e
> eu tô fazendo ele pra mesclar todos os meus agentes, da vps ou locais, pra
> funcionar no cockpit"

## A divisão, em uma linha

**O cockpit sabe QUEM está trabalhando. O escritório sabe DESENHAR.**

Mesclar agentes de várias máquinas já está resolvido neste repositório: é a
federação do CC-47. Cada máquina empurra um pacote, o painel une as listas e
carimba a origem em cada agente. Se o fork implementasse isso de novo, seriam
duas verdades para a mesma pergunta — e a segunda envelheceria calada, que é o
erro que este projeto evita em todo lugar.

## O contrato: `GET /api/escritorio`

Uma chamada, sem parâmetro, devolve os agentes de **todas** as máquinas
conhecidas já unidos.

```json
{
  "agentes": [
    {
      "id": 1986782448,
      "chave": "f02a8cda:ff0d68b2",
      "folderName": "proj_controlcenter",
      "isExternal": false,
      "status": "active",
      "awaitingInput": false,
      "toolName": "Bash",

      "ccOrigem": "VPS",
      "ccOrigemLocal": true,
      "ccSemContato": false,
      "ccRotas": ["cockpit"],
      "ccArquivos": ["src/ui.html"],
      "ccFrente": "Bancada",
      "ccAssunto": "níveis de verificação",
      "ccModelo": "opus"
    }
  ],
  "salas": [{ "nome": "VPS", "agentes": [1986782448], "local": true, "semContato": false }],
  "maquinas": [{ "id": "pc1", "nome": "ALIENWARE-LIPE", "local": false, "semContato": true }],
  "at": 1786853000000
}
```

### Os campos, e por que cada um é assim

**`id` é número, e é derivado.** O protocolo do Pixel Agents usa `id: number`
(`core/src/messages.ts`). Um contador incremental seria o óbvio e o errado: o
número mudaria a cada reinício do painel, e cada boneco trocaria de lugar e de
cor sem ninguém ter mexido em nada. Aqui ele é um hash FNV-1a de
`origem + id de sessão` — estável entre reinícios, estável entre máquinas, e sem
registro paralelo para envelhecer.

**`status` só tem dois valores**, `active` e `waiting`, que são os do protocolo
deles. Os cinco estados do cockpit colapsam nesses dois, e a perda é intencional:
o boneco só sabe trabalhar ou esperar. O estado rico continua no cartão do
cockpit, que é onde ele serve para decidir.

**`toolName` some quando o agente não está trabalhando.** `fan[]` guarda resíduo
da última ferramenta mesmo depois do job terminar — armadilha registrada no
`CLAUDE.md`. Sem essa guarda o boneco ficaria para sempre "usando o Bash".

**Tudo que começa com `cc` é extra nosso**, fora do protocolo e nomeado para
nunca colidir com um campo futuro deles. O fork consome o que entende hoje e
ganha o resto quando quiser, sem quebrar em nenhum momento.

**`maquinas` traz máquina sem agente também.** Sala vazia é informação — "o PC
está ligado e ninguém trabalhando" —, e sumir com ela apagaria isso.

## O que saiu, e por quê

Existiam três Pixel Agents nesta VPS. Ficou um.

| saiu | motivo |
|---|---|
| o oficial do npm, porta 3101 | mesmo programa, sem as sete melhorias do fork. Duas telas que discordam |
| a instância do usuário `agente`, porta 3100 | nunca foi possível inspecionar: `/home/agente/` recusa leitura |
| o túnel SSH do PC para a 3100 | **a federação substituiu.** Ver os agentes do PC não exige mais rede |

O túnel merece a nota: ele só fazia sentido rodando **fora** da VPS. Dentro dela
era a máquina se conectando a si mesma com a chave do Felipe.

## Como o painel sobe o fork

`resolverBinario()` procura o `dist/cli.js` do fork **antes** do pacote global.
A ordem é a decisão: os dois se chamam `pixel-agents` e servem a mesma porta, e
se o global viesse primeiro o Felipe subiria a versão errada pelo botão sem ter
como notar — as duas desenham a mesma sala.

## O que falta, do lado do fork

Um provider que leia `GET /api/escritorio` em vez de varrer `~/.claude` sozinho.
O registro está em `app/server/src/providers/index.ts`, e o contrato de um
provider está documentado ali mesmo.

Enquanto isso não existe, o fork continua enxergando só os agentes da máquina
onde ele roda — que é o comportamento de hoje, não uma regressão.
