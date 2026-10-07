# Inventário das telas pelas regras de design (celular, 390 px)

Medido em 02/10, com o navegador, tela por tela, no tamanho do seu celular. Isto é a parte
mecânica do item da passada nas telas: **o que está fora da régua**. A decisão do que
fazer em cada tela é sua (coluna "o que fazer" no fim).

## O que foi medido

- **Alvo de toque pequeno:** botão, aba, link ou campo com menos de 40 px de altura. A régua
  das suas regras pede 44 px no mínimo (48 de padrão), senão o dedo erra.
- **Letra abaixo de 12 px:** a régua pede 14 px no mínimo para legenda e 16 px no corpo.
- **De 12 a 14 px:** abaixo do mínimo de legenda, mas legível. Conta como aviso.
- **Rolagem para o lado:** a tela passa da largura e arrasta para o lado.

## O resultado

| Tela | Altura (px) | Rola de lado | Tocáveis | Pequenos (<40 px) | Letra <12 px | Letra 12 a 14 px |
|---|---|---|---|---|---|---|
| Início | 10183 | não | 131 | **120** | 131 | 215 |
| Projetos | 8664 | não | 73 | **55** | **319** | 100 |
| Sessões | 5062 | não | 131 | **121** | 37 | 146 |
| Armário | 2690 | não | 42 | 4 | 3 | 79 |
| Ideias | 6069 | não | 76 | **72** | 55 | 96 |
| Design | 775 | não | 42 | 2 | 4 | 289 |
| Máquinas (servidores) | 9498 | não | 49 | 32 | 155 | 134 |
| Coderoom | 544 | não | 172 | **168** | 78 | 172 |
| Kanban | 1060 | não | 21 | 16 | 128 | 59 |
| Análise | 7527 | não | 6 | 6 | **287** | 100 |
| Escritório | 1092 | não | 4 | 1 | 3 | 24 |
| Números | 4276 | não | 8 | 8 | 115 | 72 |
| Agenda | 247 | não | 3 | 3 | 3 | 1 |
| Conhecimento | 961 | não | 14 | 14 | 0 | 12 |
| Máquinas (a VPS por dentro) | 441 | não | 4 | 4 | 0 | 8 |
| Ajustes | 1150 | não | 18 | 12 | 14 | 36 |

Nenhuma tela rola para o lado: essa parte está limpa.

## Os três achados que mais pesam

1. **Alvo de toque pequeno é quase geral.** Em Início, Sessões, Ideias e Coderoom, mais de 90%
   dos botões e abas têm menos de 40 px de altura. É a régua 9 (qualquer pessoa alcança) e é
   o que faz o dedo errar na rua.
2. **Letra miúda se concentra em quatro telas:** Projetos (319 textos abaixo de 12 px),
   Análise (287), Máquinas (155) e Kanban (128). São telas de leitura densa.
3. **O padrão dos botões é o que decide:** as abas e os chips são feitos de poucas
   classes. Aumentar a altura mínima dessas classes no celular corrige a maioria de uma vez,
   sem refazer tela nenhuma.

## O que eu proponho (você decide)

- **A. Uma régua só para o celular:** altura mínima de 44 px para botões, abas e chips em
  toda tela (só no celular). Resolve a maior parte do achado 1 de uma vez. Custo: as faixas
  ficam um pouco mais altas, e a gente conta com as faixas recolhíveis que já entraram.
- **B. Letra mínima de 12 px:** subir o que está abaixo disso, começando por Projetos, Análise,
  Máquinas e Kanban. Custo: tabelas e cartões densos crescem.
- **C. Tela a tela:** você aponta o que é redundante ou ruído em cada uma e isso sai.

## O que fazer, por tela (para você preencher)

Marque cada tela com **manter**, **ajustar** (e o quê), **juntar com outra** ou **apagar**.

| Tela | Para que você usa | O que fazer |
|---|---|---|
| Início | | |
| Projetos | | |
| Sessões | | |
| Armário | | |
| Ideias | | |
| Design | | |
| Máquinas (servidores) | | |
| Coderoom | | |
| Kanban | | |
| Análise | | |
| Escritório | | |
| Números | | |
| Agenda | | |
| Conhecimento | | |
| Máquinas (a VPS por dentro) | | |
| Ajustes | | |

Observação: há **duas telas com o nome "Máquinas"** (servidores e a VPS por dentro). Pela
sua regra de um nome por coisa, uma delas precisa mudar de nome ou juntar com a outra.
