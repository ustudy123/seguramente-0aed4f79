# Ambiente de testes (staging) — o que falta

O código já está preparado: existe `.env.staging`, os scripts `build:staging` / `build:production`, o cliente Supabase lê tudo de variáveis de ambiente (nenhuma URL fixa no `src/`) e há um seed em `supabase/seeds/staging.sql` com empresa, setores, cargos e 20 colaboradores fictícios.

O que falta é apenas o **segundo banco**: um projeto Supabase separado, com a mesma estrutura, apontado pelo `.env.staging`.

## Resposta curta

- Sim, precisa de outro banco de dados (outro projeto Supabase). Não precisa de outra conta — vários projetos convivem na mesma conta.
- Não precisa de outro projeto Lovable. A Lovable conecta um Supabase por vez; o editor continua em produção e o staging é usado via build local (`npm run build:staging`) ou alternando a conexão quando quiser editar contra ele.

## Passos que faltam

1. Criar o projeto Supabase de staging (ex.: `youreyes-staging`) e copiar Project URL, anon key e project ref.
2. Preencher `.env.staging` com esses três valores (hoje estão como `<staging-project-id>` / `<staging-anon-key>`).
3. Replicar o schema: são 706 migrations em `supabase/migrations/`. Via CLI: `supabase link --project-ref <staging-ref>` + `supabase db push`. Rodar no SQL Editor manualmente não é viável nesse volume.
4. Publicar as 71 Edge Functions no staging (`supabase functions deploy --project-ref <staging-ref>`) e recadastrar os secrets (OpenAI/Lovable AI, Resend, WhatsApp, certificados eSocial etc.) — secrets não são copiados junto.
5. Criar os buckets de Storage usados hoje (atestados, documentos, certificados, EPI) com as mesmas políticas.
6. Criar um usuário admin no staging e rodar `supabase/seeds/staging.sql` informando o `user_id` dele.
7. Validar: login, empresa ativa, ponto, geração de PDF e uma chamada de IA.

## Decisões que preciso da sua parte

- Como o staging será acessado: só build local, ou também publicado em um domínio próprio (ex.: `teste.youreyes.com.br`)?
- Se sim, é preciso definir a estratégia de publicação, já que a Lovable publica um único build por projeto.

## Detalhes técnicos

- `src/integrations/supabase/client.ts` já falha de forma explícita se as variáveis faltarem — nenhuma alteração de código é necessária.
- `supabase/config.toml` continua apontando para produção; o `link` da CLI sobrescreve isso temporariamente.
- `docs/AMBIENTES.md` já documenta o procedimento; será atualizado com os itens de Storage e secrets, que hoje não estão listados.
- Nenhum arquivo de aplicação precisa ser alterado nesta etapa; o trabalho é de infraestrutura no Supabase.
