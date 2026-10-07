-- CC-944: o usuário do banco que a leitura segura usa. Roda pelo instalador, como
-- o dono do banco, e de novo depois de cada migração nova (tabela nova só fica
-- visível depois de rodar isto outra vez).
--
-- Variáveis do psql: papel (nome do usuário) e senha.
--
-- As três barreiras ficam no PRÓPRIO banco, não no serviço:
--  1. só leitura: toda transação dele nasce read only, e ele não tem permissão de escrita;
--  2. só a área "public": as contas do Supabase (área "auth") ficam fora de alcance;
--  3. coluna pessoal ou secreta não é concedida: SELECT nela dá "permission denied".

SELECT format('CREATE ROLE %I LOGIN', :'papel') WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'papel') \gexec
ALTER ROLE :"papel" WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 3 PASSWORD :'senha';
ALTER ROLE :"papel" SET default_transaction_read_only = on;
ALTER ROLE :"papel" SET statement_timeout = '15s';

-- começa do zero a cada instalação: tirar a permissão da tabela tira também a das colunas
SELECT format('REVOKE ALL ON %I.%I FROM %I', schemaname, tablename, :'papel') FROM pg_tables WHERE schemaname = 'public' \gexec
SELECT format('REVOKE ALL ON %I.%I FROM %I', schemaname, viewname, :'papel') FROM pg_views WHERE schemaname = 'public' \gexec
GRANT USAGE ON SCHEMA public TO :"papel";

-- O que fica escondido (decisão dele em 07/10: "tudo, sem dado pessoal"):
--  · tabelas inteiras: chaves do Strava e do Polar, fotos do corpo, localização ao vivo, equipe do painel;
--  · em qualquer tabela: e-mail, senha, chave, telefone, documento, nascimento, foto, e texto escrito
--    pela pessoa (mensagem, comentário, bio, denúncia);
--  · nome só nas tabelas de pessoa (nome de treino, de clube e de lugar continua visível).
-- ponytail: o filtro é pelo NOME da coluna; dado pessoal guardado dentro de um JSON (cópia do app,
-- eventos) passa, e o serviço só troca e-mail que aparecer ali. Se precisar mais, esconder a coluna aqui.
SELECT format('GRANT SELECT (%s) ON %I.%I TO %I', string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position), table_schema, table_name, :'papel')
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name NOT IN ('strava_tokens', 'polar_tokens', 'progress_photos', 'live_shares', 'painel_membros')
  AND column_name !~* '(email|password|senha|secret|token|hash|phone|telefone|celular|cpf|birth|nasc|avatar|foto|image|^print$|^texto$|bio$|^detalhe$|^observacao$|^nota$)'
  AND NOT (table_name IN ('profiles', 'users') AND column_name ~* '^(name|nome|full_name|display_name|username|first_name|last_name)$')
GROUP BY table_schema, table_name \gexec
