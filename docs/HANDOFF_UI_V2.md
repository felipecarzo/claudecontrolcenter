# Handoff: Redesign do Agent Cockpit (Central de Comando V2)

## 1. Contexto e Objetivo
Este documento registra a prova de conceito (PoC) desenvolvida para transformar a interface do **Agent Cockpit**. O objetivo foi abandonar o aspecto visual de "Dashboard SaaS genérico" (com glassmorphism, sombras complexas e cores saturadas) em favor de uma **Central de Comando Técnica (Mission Control)**. 

O painel deve responder a uma única pergunta em 2 segundos: *"Quem está fazendo o quê, onde, e o que precisa de mim agora?"*

## 2. O Que Foi Feito

Foi criado um arquivo isolado chamado `ui_v2.html` para testar a nova interface sem quebrar o sistema original em produção. As principais mudanças foram:

### 2.1. Design System (Dark Technical)
- **Tema Base:** Fundos mergulhados no preto puro (`#0B0D0F`) com superfícies de alto contraste (`#111418`).
- **Tipografia:** `Outfit` para a interface geral (leitura suave) e `JetBrains Mono` para telemetria, logs e métricas (precisão técnica).
- **Glassmorphism removido:** Remoção total de `backdrop-filter`, focando em bordas sólidas (`#252A30`) e performance máxima.

### 2.2. Arquitetura da Informação
A navegação lateral foi completamente enxugada e agrupada por intenção do operador:
1. **COCKPIT:**
   - **Agora:** O coração do sistema. Agrupa o que precisa de atenção imediata e o grid de projetos que estão rodando sozinhos de forma saudável.
   - **Trabalho:** Backlog de sprint e pendências humanas isoladas.
   - **Estrutura:** Configurações de framework e log de mudanças recentes.
2. **ENGENHARIA:**
   - **Hooks & Servidores:** Conectores, containers Docker e webhooks do sistema.
   - **Federação:** Status da malha de computadores, sessões remotas VPS e nós rodando ativamente.
3. **RECURSOS:**
   - **Conhecimento:** Busca universal agregada (docs, glossário) e rascunhos rápidos.

### 2.3. Componentes Estratégicos Adicionados
- **Sessão "AGORA":** Uma grid reservada no topo exclusivo para tarefas em estado `waiting`. Destaca visualmente o tempo que o agente está esperando pelo humano.
- **Barra de Métricas Global:** O Header agora possui status cruzado de todo o sistema: `Projetos`, `Agentes`, `Precisam de Você` e `Nós Conectados` (indicando se há VPS conectada ou apenas o PC Local).
- **Indicadores de Máquina no Card:** Os cards de tarefas ativas não são genéricos. Eles informam fisicamente onde estão rodando (ex: `<i class="ph-bold ph-hard-drives"></i> Local` ou `VPS`).
- **Sistema de Ajuda Contextual (`?`):** Uma infraestrutura global de tooltips/popovers chamada `global-help-popover`. Todo widget importante tem um botão `?` que explica o que a funcionalidade faz, qual evento a acorda, e qual evento a finaliza.

## 3. Onde Está o Código
- **Arquivo PoC:** `D:\Documentos\Ti\projetos\PESSOAL\proj_controlcenter\src\ui_v2.html`
- O arquivo é 100% autossuficiente (HTML, CSS e JS contidos nas suas ~600 linhas). Ele já consome a API real e o fluxo SSE (Server-Sent Events) do `web.mjs`.

## 4. Guia para o Próximo Agente (Como Migrar para o Principal)

Caro Agente, sua missão será pegar os conceitos validados do `ui_v2.html` e transplantá-los para o `ui.html` principal do projeto (que possui mais de 10.000 linhas).

**Passos Recomendados para a Migração:**

1. **Compreensão:** Leia o `ui_v2.html` para absorver as novas variáveis CSS (`:root`) e a estrutura do DOM (`nav.sidebar`, `header`, `.main-content`).
2. **Merge de CSS:** O `ui.html` original possui muito CSS antigo. Você precisará limpar gradientes e estilos antigos, substituindo pelo bloco de `<style>` do `ui_v2.html`.
3. **Adoção da Sidebar e Header:** Transplante a estrutura de `<nav class="sidebar">` e o `<header>` global.
4. **Refatoração dos Renderizadores JS:** O `ui.html` original tem funções gigantes de renderização (ex: `viewEntrevista`, `viewTrabalho`). Elas terão que cuspir HTML que utilize as novas classes baseadas na Central de Comando (`.widget`, `.agent-row`, `.agent-status-dot`, etc.).
5. **Adoção do Sistema de Ajuda:** Integre o `global-help-popover` em todo o painel original. Felipe quer que **absolutamente tudo** no painel seja explicável com um ícone de `?`.

### 5. Resumo do Ponto de Situação
- O design foi validado por Felipe (o layout de duas colunas "AGORA" e "PROJETOS ATIVOS" funcionou perfeitamente).
- O backend de telemetria (`web.mjs`) NÃO precisou ser alterado.
- Os dados batem com a realidade local da máquina e VPS.
- **Próximo foco:** Atualizar o monólito `ui.html` para refletir esse novo visual, mantendo todo o poder granular que a V1 tinha sob o capô.
