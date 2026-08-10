# Ambiente de testes (staging) — situação atual e o que falta

## Diagnóstico do que já existe (verificado no repositório)

| Item | Estado |
|---|---|
| `.env.production` com dados reais | Pronto |
| `.env.staging` | Existe, mas **ainda com placeholders** (`<staging-project-id>`, `<staging-anon-key>`) |
| Scripts `build:staging` / `build:production` no `package.json` | Prontos (copiam o `.env` correto antes do build) |
| Cliente Supabase lê só de env vars (`src/integrations/supabase/client.ts`) | Pronto — nenhuma URL fixa em `src/` |
| Seed de dados fictícios (`supabase/seeds/staging.sql`) | Pronto (tenant, empresa, 4 setores, 4 cargos, 20 colaboradores, contexto de IA) |
| Seed de buckets (`supabase/seeds/staging_buckets.sql`) | Pronto (22 buckets) |
| Documentação (`docs/AMBIENTES.md`) | Pronta, porém desatualizada em 2 pontos |
| Segundo projeto Supabase | **Não criado** — é o bloqueio real |

## Duas inconsistências encontradas

1. **`.gitignore` não protege nenhum arquivo `.env`.** A documentação afirma que `.env`, `.env.production` e `.env.staging` estão protegidos, mas não há nenhuma regra `.env` no `.gitignore`. Hoje as chaves de produção estão versionadas.
2. **Contagem de migrations desatualizada.** A documentação fala em 706 migrations; hoje são **739**. As Edge Functions continuam 71.

## Resposta objetiva

- Sim, é preciso um **segundo projeto Supabase** (cada projeto é um banco isolado). **Não** precisa de outra conta Supabase nem de outro projeto Lovable.
- Todo o trabalho de código já foi feito. O que resta é **infraestrutura** no Supabase, feita via CLI fora do editor Lovable.

## Escopo proposto (o que eu faço no repositório)

1. Adicionar ao `.gitignore` as regras `.env`, `.env.local`, `.env.production`, `.env.staging`, mantendo `.env.example` versionado.
2. Atualizar `docs/AMBIENTES.md`: contagem correta (739 migrations / 71 functions), correção da afirmação sobre o `.gitignore`, e um checklist final revisado.
3. Adicionar ao `docs/AMBIENTES.md` um passo explícito de rotação de chaves caso opte por remover o `.env` do histórico do Git.

Observação: não posso criar o projeto Supabase de staging nem rodar `supabase link` / `db push` daqui — esses passos são executados por você, com a CLI, na sua máquina.

## Passos que ficam do seu lado (CLI)

```bash
# 1. Criar o projeto no dashboard (ex.: youreyes-staging) e anotar URL, anon key e ref
# 2. Preencher .env.staging com esses valores
# 3. Schema
supabase link --project-ref <staging-ref>
supabase db push            # aplica as 739 migrations
# 4. Edge Functions
supabase functions deploy --project-ref <staging-ref>   # 71 funções
# 5. Secrets: recadastrar no dashboard (LOVABLE_API_KEY, OPENAI_API_KEY, RESEND_API_KEY,
#    EMAIL_FROM, APP_URL/SITE_URL, WHATSAPI_*, MERCADOPAGO_ACCESS_TOKEN, CONSULTACRM_KEY)
#    — use chaves sandbox onde houver
# 6. Buckets: rodar supabase/seeds/staging_buckets.sql no SQL Editor do staging
# 7. Criar usuário admin em Authentication > Users e rodar supabase/seeds/staging.sql
# 8. Validar: npm run build:staging && npm run preview
```

## Decisão que preciso de você

O staging será usado apenas em build local, ou também publicado em um domínio de teste (ex.: `teste.youreyes.com.br`)? A Lovable publica um único build por projeto, então o segundo caso exige um host estático adicional (Vercel/Netlify/Cloudflare Pages).
