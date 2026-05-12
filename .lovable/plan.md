## Termo de Ciência + Assinatura Digital — Manual de Função

### Objetivo
Após gerar o manual da função, permitir envio para o colaborador, com **Termo de Ciência, Acordo e Comprometimento** ao final, assinatura digital do **colaborador** e do **gestor imediato**, e arquivamento automático do PDF assinado na pasta do colaborador no módulo Documentos.

### Decisões de design
- O manual é **por cargo** (1 documento). A assinatura é **por colaborador** — gera um *Termo de Ciência* individual que referencia o manual.
- Reaproveita o padrão `OrdemServicoAssinatura`: token público, RPC `SECURITY DEFINER`, selfie + geolocalização opcionais, dois assinantes (colaborador → gestor).
- Arquivamento usa `arquivarDocumento({ pastaCategoria: "Aprendizado" })` na pasta do colaborador (já existe `criarPastaColaborador`).

### Mudanças no banco

```sql
CREATE TABLE manual_funcao_assinaturas (
  id, tenant_id, empresa_id,
  cargo_id, cargo_nome,
  colaborador_id, colaborador_nome, colaborador_cpf,
  gestor_id, gestor_nome,
  manual_html_snapshot text,        -- snapshot do manual no momento do envio
  termo_html text,                  -- termo gerado
  pdf_storage_path text,            -- PDF final assinado
  status text,                      -- aguardando_colaborador | aguardando_gestor | concluido | cancelado
  token_colaborador uuid,
  token_gestor uuid,
  assinatura_colaborador jsonb,     -- {nome, cpf, data, ip, geo, selfie_url, hash}
  assinatura_gestor jsonb,
  data_envio, data_assinatura_colaborador, data_assinatura_gestor,
  documento_arquivado_id uuid       -- FK para documentos
);
```

RLS: tenant + role (`has_minimum_role`); leitura pública via RPC só com token.

RPCs `SECURITY DEFINER`:
- `manual_assinatura_get_by_token(token, tipo)` — retorna dados + html para a página pública.
- `manual_assinatura_registrar(token, tipo, payload)` — grava assinatura, e quando ambas concluídas dispara arquivamento via edge function.

### Edge Functions
- `manual-funcao-assinatura-finalizar`: monta HTML final (manual + termo + dois blocos de assinatura com data, IP, geo, selfie), gera PDF (html2pdf no client OU puppeteer/pdf na função), faz upload para `documentos` bucket privado, cria registro em `documentos` na pasta do colaborador (subpasta "Aprendizado / Manual de Função"), preenche `documento_arquivado_id`.

### Frontend
- **`ManualFuncaoModal`**: novo botão "Enviar para Assinatura" que abre `EnviarManualAssinaturaDialog`.
- **`EnviarManualAssinaturaDialog`**: seleciona colaboradores do cargo + define gestor (auto-preenchido do `cargo.responsavel_id` ou seletor), gera links e copia.
- **Nova página pública `/manual-funcao/assinatura/:token`** (`ManualFuncaoAssinatura.tsx`): exibe manual + termo, captura nome/CPF (validação), data automática, geo, selfie opcional, checkbox "Li e estou ciente"; após enviar, mostra status (aguardando gestor ou concluído).
- **Aba "Assinaturas"** no módulo Aprendizado para acompanhar status (pendentes, assinadas, links).

### Termo padrão (final do manual)
> Declaro que recebi, li e compreendi integralmente o presente Manual da Função de **{cargo}**, ciente de minhas responsabilidades, atribuições, normas internas e procedimentos operacionais (POPs) aplicáveis. Comprometo-me a cumpri-los, zelando pela segurança, qualidade e conformidade com as normas regulamentadoras aplicáveis (NR-1, CLT art. 157).
>
> Local: ___________ Data: __/__/____
>
> [Assinatura digital — Colaborador]
> [Assinatura digital — Gestor Imediato]

### Arquivos a criar/editar
1. Migration SQL (tabela + RLS + RPCs).
2. `supabase/functions/manual-funcao-assinatura-finalizar/index.ts`.
3. `src/hooks/useManualAssinaturas.ts`.
4. `src/components/aprendizado/EnviarManualAssinaturaDialog.tsx`.
5. `src/components/aprendizado/AssinaturasManualTab.tsx`.
6. `src/pages/ManualFuncaoAssinatura.tsx` (público) + rota lazy em `App.tsx`.
7. Editar `ManualFuncaoModal.tsx` (botão), `FuncaoList.tsx` (passar cargo_id + colaboradores), `AprendizadoPapeis.tsx` (nova aba).
8. `src/lib/manualFuncaoTermo.ts` (template HTML do termo).

### Escopo desta entrega
Implementar tudo acima em sequência. Validações: CPF do assinante deve bater com cadastro; token de uso único por assinante; expiração 30 dias.