---
tags: [produto, visao, outro-produto]
tipo: visao
atualizado: 2026-08-14
estado: ideia do Felipe, produto SEPARADO deste repositório
resumo: Produto próprio, escrito por ele, que conduz o dia de trabalho de qualquer profissional no computador, com um filtro que impede dado sigiloso de sair da máquina. Nasceu pensando na Carol, advogada, sócia dele.
termos:
  proxy de confidencialidade: troca dado sensível por token antes de sair da máquina, e remonta na volta
  arquitetura de hábitos: conduzir o dia por tarefas em vez de deixar a pessoa decidir do zero toda manhã
  overlay: a interface que assume a tela no modo trabalho, escondendo distração
  escape: o campo livre que existe em toda pergunta, para a pessoa não ficar refém das opções
---

# Arquitetura de Hábitos (produto separado)

Documento escrito pelo Felipe em 14/08, com IA, mas a ideia é dele. **Não é
este projeto.** É um produto próprio, construído por cima do que aprendemos
aqui, mirando qualquer área profissional.

> "é pra facilitar a vida de pessoas trabalhando no computador, em outras
> áreas, por exemplo, redigir documentos, advogados, médicos que vão redigir
> laudos. A confidencialidade pra mim é importante, mas pra esses profissionais
> é mais ainda."

O caso concreto que originou tudo: **a Carol, advogada, sócia dele.** Ela liga o
computador todo dia e começa do zero, decidindo na hora o que fazer. Não usa IA.

Registrado aqui porque três peças dele foram trazidas para o nosso framework
(F12, F13, F14 em [[../planos/FRAMEWORK-V1]]) e porque, se um dia virar produto,
começa deste repositório.

## O que o produto propõe

Assumir a tela no modo trabalho, conduzir a pessoa pelas tarefas do dia,
oferecer escolhas em vez de exigir decisão do zero, e adaptar o tom à carga
mental. Por baixo, um proxy local que troca dado sigiloso por token antes de
qualquer coisa sair para a nuvem.

## Minha avaliação, e onde eu errei primeiro

**Erro meu, registrado porque muda tudo:** avaliei o documento assumindo que era
para o Felipe, e critiquei "assumir a tela ao ligar o computador" como
inadequado, já que ele trabalha do celular, na rua, com o PC desligado. Estava
certo sobre ele e errado sobre o produto: para a Carol, que senta na frente do
computador toda manhã, assumir a tela **é o produto**.

### O que é forte

**A confidencialidade não é preferência, é impedimento legal.** Advogado tem
sigilo profissional; médico, sigilo médico; os dois têm LGPD. Hoje esses
profissionais não usam IA porque **não podem**, não porque não querem. Isso não é
um recurso a mais, é a porta de entrada de um mercado inteiro que está fechado.

**"Começar do zero todo dia" é dor real e universal**, e não depende de IA
nenhuma para ser resolvida. É a parte do produto que funciona mesmo se a IA
falhar.

**O escape em toda pergunta** é o mesmo princípio que o Felipe exigiu no nosso
framework: opção fechada não pode aprisionar. Duas cabeças chegaram nisso
separadamente, o que costuma indicar que a ideia é sólida.

### Os três riscos que eu apontaria antes de escrever código

**1. Tokenizar tem um teto, e o teto é o sentido.** Trocar nome por
`[CLIENTE_1]` funciona bem quando a IA só precisa formatar. Quando ela precisa
**raciocinar sobre o conteúdo** ("esse contrato é abusivo?", "esse laudo é
coerente?"), tokenizar demais destrói justamente o que ela deveria analisar.
Há um trade-off real entre proteger e ser útil, e ele não aparece na PoC
simples.

**Alternativa que eu acho mais forte:** o dado sigiloso **nunca sai** — quem o
processa é um modelo local (Ollama, Llama) rodando na máquina. Para a nuvem vai
só a estrutura da tarefa. É mais lento e exige máquina melhor, mas é a diferença
entre "mascaramos bem" e "não sai daqui", e para advogado essa diferença é a
única que importa numa auditoria.

**2. A falha não é técnica, é jurídica.** Se o filtro escapar um nome, o
resultado não é bug: é quebra de sigilo profissional, com consequência para o
cliente dele. Isso muda o padrão de qualidade exigido e pede resposta pronta
para "o que acontece quando falha", incluindo log local do que foi mascarado.

**3. O público que não usa IA é o mais difícil de conquistar, e o produto pede
muito no dia 1.** Assumir a tela é mudar o hábito inteiro de trabalho de uma vez.
Para quem já desconfia da tecnologia, é pedir demais logo de cara.

**Entrada mais suave que eu proporia:** o produto começa **sem assumir nada** —
uma janela lateral que só lembra o que fazer, respeitando o jeito que ela já
trabalha. Ganha a tela depois, quando ela confiar. O "modo trabalho" vira algo
que ela liga porque quer, não a primeira coisa que ele faz.

### O que eu observaria antes de decidir a stack

O documento sugere Python no núcleo mais Flutter ou Electron na interface. Para o
que ele descreve, isso é pesado. Vale conferir se o problema não é resolvido com
o mesmo padrão daqui — processo local leve servindo uma página, sem framework de
UI pesado. A escolha só se paga se a interface precisar mesmo cobrir a tela de
forma nativa, e isso é a parte que eu deixaria por último.

## O que já foi trazido para cá

- **F12**, o filtro de confidencialidade: a peça mais valiosa, resolve dor que
  este projeto tem hoje.
- **F13**, tom separado do modo: correção do nosso desenho, e melhor que ele.
- **F14**, ponte com outras ferramentas: registrado como direção.
