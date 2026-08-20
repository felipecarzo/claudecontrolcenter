---
description: "Obrigatório para qualquer interface visual, componente ou painel criado para o Felipe. Define a barra de qualidade UX/UI e o uso funcional de elementos visuais."
---

# Manifesto de Design do Felipe

O Felipe não é apenas um arquiteto de sistemas; ele possui hiperfoco em UX/UI, e **a estética é o diferencial competitivo dele**. Quando você for solicitado a criar, revisar ou modificar qualquer interface gráfica (HTML, CSS, painéis, dashboards), **você está proibido de entregar MVPs feios, "SaaS genéricos" ou layouts puramente pragmáticos sem polimento visual.**

Siga rigorosamente estas diretrizes de design, baseadas em suas preferências documentadas:

### 1. Interface não é log, é "Central de Comando"
- O Felipe odeia interfaces com excesso de texto amontoado e desorganizado. 
- Ele pensa de forma espacial. Use **cores, áreas demarcadas e transparências (Glassmorphism)** para setorizar o trabalho. (Exemplo catalogado: *"uma cor por cima estilo transparente para demarcação de zona"*).
- Não jogue dados brutos na tela. Estruture grids, colunas e cards de forma limpa. Deve ter "cara de aplicativo premium", e não de um terminal web mal feito.

### 2. Estética "Dark Technical" e Glassmorphism
- **Fundo / Backgrounds:** Prefira paletas muito escuras e profundas (ex: `#030712`, `#0B0D0F`).
- **Glassmorphism:** Use `backdrop-filter: blur(...)`, bordas translúcidas sutis (`rgba(255,255,255,0.1)`) e sombras (`box-shadow`) para criar hierarquia de profundidade. 
- **Sem Cores de Bootstrap:** Não use o "azul do navegador" ou cores primárias cruas. Use paletas intencionais (ex: Tailwind colors como *Slate, Zinc, Sky, Violet, Amber, Emerald*).

### 3. Cores com Significado Funcional
- O Felipe usa cores para saber instantaneamente o que está acontecendo sem precisar ler. 
- Mantenha um padrão:
  - **Roxo/Violeta:** Trabalho em andamento, agente operando, sistema rodando.
  - **Âmbar/Laranja:** Esperando input do humano (Felipe precisa agir).
  - **Verde/Emerald:** Sucesso, pronto, ligado.
  - **Projeto/Zona:** Use cores temáticas para separar projetos visualmente.

### 4. Personalidade e Personificação
- Quando aplicável, trate agentes e sistemas como entidades com "identidade" visual. (Exemplo catalogado: *"usá-los como personagens porque isso de forma visual vai me ajudar"*).

### 5. Tipografia
- Separe a tipografia de UI da tipografia de dados.
- **UI/Texto:** Fontes modernas e limpas (Outfit, Inter, Roboto).
- **Números/Logs/Dados:** Fontes Monospace (JetBrains Mono, Fira Code).

### Penalidade Oculta
Se você entregar um design "preguiçoso" ou poluído, ele vai notar na hora, e a sessão inteira vai desviar para consertar o design em vez de avançar na lógica. Poupe o tempo dele: **Pense como um Diretor de Arte Sênior antes de escrever a primeira linha de CSS.**
