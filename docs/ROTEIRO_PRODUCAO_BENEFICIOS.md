# Roteiro de produção — módulo Benefícios

Lista mestra dos pacotes SQL do módulo **Benefícios** a serem colados, **em
ordem**, no SQL Editor do banco de **produção** (projeto `diayjpsrcerycycyaxst`)
quando cada onda for validada no ambiente de teste e aprovada.

Nasceu do relatório de testes que apontou 14 achados (rotinas `BEN-*`).
Organização das ondas: ver o artefato **"Benefícios em Ondas"**.

---

## O princípio (o mesmo do Ponto)

1. **Nada vai para produção antes de ser validado no ambiente de teste.**
2. **A produção só muda por gesto manual seu** — colar o script no SQL Editor de
   produção. A automação nunca toca o banco real.
3. **Ordem importa.** Rode na numeração abaixo; a coluna "Depende de" avisa.
4. **Confira o projeto no topo da tela do Supabase** — tem que estar o de
   **produção**.
5. Todos os pacotes são **idempotentes**: rodar duas vezes não quebra nem duplica.

---

## Estado atual

**Nenhum pacote de Benefícios foi aplicado em produção ainda.** A onda B0 está
validada no ambiente de teste (aguardando sua conferência); as demais ainda serão
construídas, onda a onda.

Legenda: ⬜ a fazer/a construir · ✅ feito · ⏳ aguardando validação no teste

| # | Onda · Pacote | Arquivo | Depende de | Teste | Produção |
|---|---------------|---------|-----------|:-----:|:--------:|
| 1 | B0 — proteção LGPD da adesão (BEN-080) | `docs/script_beneficios_onda0_lgpd_rls.sql` | — | ⏳ | ⬜ |
| 2 | B1 — termo de adesão/recusa no Documentos (BEN-060) | *a construir* | — | ⬜ | ⬜ |
| 3 | B1 — elegibilidade aplicada na adesão (BEN-001) | *a construir* | — | ⬜ | ⬜ |
| 4 | B1 — benefício × CCT × vigência (BEN-051) | *a construir* | — | ⬜ | ⬜ |
| 5 | B1 — tabela de dependentes (BEN-030) | *a construir* | — | ⬜ | ⬜ |
| 6 | B2 — proporcional aos dias efetivos (BEN-050) | *a construir* | — | ⬜ | ⬜ |
| 7 | B2 — VT: teto de 6% + cálculo (BEN-011) | *a construir* | **#6** | ⬜ | ⬜ |
| 8 | B2 — VR: teto do PAT (BEN-012) | *a construir* | **#4 #6** | ⬜ | ⬜ |
| 9 | B2 — VT é opção: sem termo, sem desconto (BEN-010) | *a construir* | **#2** | ⬜ | ⬜ |
| 10 | B3 — ponte com a Folha (BEN-020) | *a construir* | **#3 #6** | ⬜ | ⬜ |
| 11 | B3 — operadoras/faturas + conciliação (BEN-042) | *a construir* | **#5** | ⬜ | ⬜ |
| 12 | B3 — manutenção do plano na rescisão, arts. 30/31 (BEN-040) | *a construir* | **#2 #5 #11** | ⬜ | ⬜ |

**Parados por decisão (como o rural do Ponto):** BEN-070 (PLR) e BEN-071
(consignado) — só quando houver programa/convênio real.
**Fora da fila de banco:** BEN-090 (caso de tela, Cypress).

---

## Detalhe de cada pacote

### 1 · B0 — proteção LGPD da adesão (BEN-080)
- **Arquivo:** `docs/script_beneficios_onda0_lgpd_rls.sql`
- **Abre o módulo Benefícios** pela blindagem — o achado de maior risco imediato.
- **O que faz:** `beneficios_colaboradores` tinha leitura **aberta ao tenant**
  (qualquer usuário listava quem tem plano de saúde e os valores/descontos dos
  colegas). Adesão a plano é **dado de saúde por inferência (LGPD art. 11)**.
  Acrescenta a política **RESTRICTIVE** `perfil_restringe_leitura_beneficios_colaboradores`,
  no mesmo padrão das ~20 tabelas sensíveis: a leitura passa a exigir **perfil**
  com acesso ao módulo (benefícios/colaboradores) **ou** ser o **próprio
  colaborador** (vê só as próprias adesões).
- **Baixo risco:** é RESTRICTIVE e só para **SELECT** — apenas **estreita** a
  leitura; não afeta inclusão/edição, e quem já administra (gestor/RH/admin)
  continua enxergando tudo (via `perfil_permite_modulo`). **Aditivo e idempotente.**
- **Conferência esperada:** `t | t | OK` — a política existe e é RESTRICTIVE
  para SELECT.
- **Provado no teste (dados fictícios, RLS avaliada como `authenticated`):**
  colaborador comum vê **só a própria** adesão (1 de 2); gestor vê **todas** (2).
  `PERFIL-003` (guarda de tabelas sensíveis) segue verde; regressão zero na
  bateria do Ponto (120/1).
- **Tela (Publicar no Lovable):** nada obrigatório — a proteção é de banco. A tela
  já não vaza porque a leitura passa pelo banco protegido.
