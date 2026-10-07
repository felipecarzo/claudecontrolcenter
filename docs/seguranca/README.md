# Segurança dos projetos: o que a varredura ASVS achou

Varredura de 2026-10-07, 28 projeto(s), só leitura. Um relatório por projeto nesta pasta. Gerada por `node cc.mjs seguranca varrer`.

Total: 46 não cumprem, 20 suspeitos, 60 não medidos.

| Projeto | Não cumprem | Suspeitos | Pior achado |
| --- | ---: | ---: | --- |
| [VPS_ahtleta-corrida](VPS_ahtleta-corrida.md) | 4 | 0 | V2.1.1 senha exige no mínimo 12 caracteres: src/app/trocar-senha.tsx:18 aceita senha de 6 caracteres (o mínimo do ASVS é 12) (não cumpre) |
| [VPS_ahtleta-escalada](VPS_ahtleta-escalada.md) | 4 | 0 | V2.1.1 senha exige no mínimo 12 caracteres: src/app/trocar-senha.tsx:18 aceita senha de 6 caracteres (o mínimo do ASVS é 12) (não cumpre) |
| [VPS_ahtleta](VPS_ahtleta.md) | 2 | 1 | V2.10.4 nenhum segredo (chave, token, chave privada) dentro do repositório: assets/docs/archive/SETUP_PENDENTE.md:16 (chave de API (sk-)) (não cumpre) |
| [VPS_inovallbond](VPS_inovallbond.md) | 7 | 3 | V3.4.1 cookie definido pelo código com o atributo Secure: apps/app_inovallbond/src/app/editar/route.ts:78 define cookie sem Secure (não cumpre) |
| [VPS_conta-de-casa](VPS_conta-de-casa.md) | 3 | 0 | V3.4.1 cookie definido pelo código com o atributo Secure: server.js:232 define cookie sem Secure (não cumpre) |
| [fibraessencia](fibraessencia.md) | 3 | 0 | V3.4.1 cookie definido pelo código com o atributo Secure: apps/fibraessencia-web/src/app/api/tour-editor-auth/route.ts:26 define cookie sem Secure (não cumpre) |
| [VPS_ibrics](VPS_ibrics.md) | 4 | 2 | V3.4.1 cookie definido pelo código com o atributo Secure: apps/web_ibrics/src/app/api/tour-editor-auth/route.ts:22 define cookie sem Secure (não cumpre) |
| [VPS_profinance](VPS_profinance.md) | 3 | 1 | V2.10.4 nenhum segredo (chave, token, chave privada) dentro do repositório: .gitleaks-baseline.json:8 (chave de API (sk-)) (não cumpre) |
| [VPS_mnzs](VPS_mnzs.md) | 0 | 0 | nenhum |
| [VPS_burocracIA](VPS_burocracIA.md) | 0 | 0 | nenhum |
| [VPS_carzo](VPS_carzo.md) | 0 | 0 | nenhum |
| [VPS_cockpit](VPS_cockpit.md) | 5 | 1 | V3.4.1 cookie definido pelo código com o atributo Secure: src/bancadaCatalogo.mjs:1003 define cookie sem Secure (não cumpre) |
| [VPS_coepiloto](VPS_coepiloto.md) | 0 | 2 | V5.3.4 consulta ao banco com parâmetros, nunca montada por concatenação de texto: src/coepiloto/dados.py:524 (consulta montada com texto variável, heurística: confira se o valor vem do usuário) (suspeito) |
| [VPS_dengonator2000](VPS_dengonator2000.md) | 1 | 1 | V2.1.1 senha exige no mínimo 12 caracteres: apps/web/scripts/conta.mjs:13 aceita senha de 6 caracteres (o mínimo do ASVS é 12) (não cumpre) |
| [VPS_entreg4](VPS_entreg4.md) | 0 | 0 | nenhum |
| [VPS_escritorio](VPS_escritorio.md) | 0 | 0 | nenhum |
| [VPS_geolev4](VPS_geolev4.md) | 0 | 1 | V5.3.4 consulta ao banco com parâmetros, nunca montada por concatenação de texto: src/geolev4/ibge.py:142 (consulta montada com texto variável, heurística: confira se o valor vem do usuário) (suspeito) |
| [VPS_ghoscode](VPS_ghoscode.md) | 3 | 4 | V2.10.4 nenhum segredo (chave, token, chave privada) dentro do repositório: n8n/qa-report-workflow.json:45 (chave service_role do Supabase) (não cumpre) |
| [VPS_maurice](VPS_maurice.md) | 0 | 0 | nenhum |
| [VPS_pierre](VPS_pierre.md) | 3 | 3 | V3.4.1 cookie definido pelo código com o atributo Secure: apps/app_pierre/src/app/api/tour-editor-auth/route.ts:22 define cookie sem Secure (não cumpre) |
| [VPS_productVideoMaker](VPS_productVideoMaker.md) | 0 | 0 | nenhum |
| [VPS_renanMarchon](VPS_renanMarchon.md) | 0 | 0 | nenhum |
| [VPS_reunion](VPS_reunion.md) | 0 | 0 | nenhum |
| [VPS_sim-aventura](VPS_sim-aventura.md) | 0 | 0 | nenhum |
| [VPS_socialmedia](VPS_socialmedia.md) | 4 | 1 | V2.10.4 nenhum segredo (chave, token, chave privada) dentro do repositório: docs/guias/meta-passo-a-passo.md:61 (atribuição literal a nome de segredo, suspeito) (não cumpre) |
| [VPS_sumauma](VPS_sumauma.md) | 0 | 0 | nenhum |
| [VPS_vps](VPS_vps.md) | 0 | 0 | nenhum |
| [VPS_webscrapper](VPS_webscrapper.md) | 0 | 0 | nenhum |

Os cabeçalhos HTTP que faltam no nginx têm o passo a passo em [nginx-cabecalhos.md](nginx-cabecalhos.md).
