/**
 * O trabalhador de fundo do app instalado.
 *
 * ## Por que ele existe
 *
 * Sem um destes registrado, o Chrome no Android **não oferece instalar** o
 * painel como aplicativo: ele salva um atalho que abre no navegador, com barra
 * de endereço e tudo. Foi o que ele descreveu: *"quando eu salvo ele abre como
 * um site só, nao como app"*.
 *
 * ## Por que ele NÃO guarda o painel
 *
 * A tentação é cachear a página para abrir offline. Aqui isso seria um
 * desastre: o painel muda várias vezes por dia, e o deploy é reiniciar o
 * processo. Uma cópia guardada no telefone dele significaria abrir a versão de
 * ontem sem nenhum sinal na tela, e é exatamente a família de defeito que este
 * projeto mais paga: a tela afirmando o passado no presente.
 *
 * Some-se a isso que o painel **só existe com o servidor de pé**: todo dado vem
 * de rota. Guardar a casca sem o conteúdo daria uma tela vazia convincente, que
 * é pior que a mensagem honesta de que não há conexão.
 *
 * Então este arquivo é deliberadamente quase vazio. Ele existe para o navegador
 * saber que isto é um aplicativo, e sai da frente do resto.
 */

/* Assume o controle assim que instala, sem esperar a aba antiga fechar. Sem
   isto, a primeira abertura depois de instalar fica sem trabalhador e o Chrome
   às vezes não completa a instalação. */
self.addEventListener('install', (e) => { self.skipWaiting() })
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()) })

/* Repassa tudo para a rede, sem tocar. Um `fetch` que não intercepta ainda
   conta para o navegador considerar o site instalável, e mantém o painel sempre
   servindo a versão de agora. */
self.addEventListener('fetch', () => {})
