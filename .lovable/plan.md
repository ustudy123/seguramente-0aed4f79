# Ordem de Serviço (OS) — NR-1, item 1.4.1 alínea "b"

## O que é

A NR-1 obriga o empregador a **dar Ordem de Serviço (OS) por escrito a cada empregado**, com:
1. Riscos ocupacionais existentes nas atividades dele
2. Medidas de prevenção (EPC/EPI) e como usá-las
3. Procedimentos seguros
4. Penalidades por descumprimento
5. Recibo / assinatura do empregado

Hoje o sistema já possui PGR (com `inventario_riscos`, `funcoes_atividades`, `plano_acao` extraídos por IA), Cargos/Funções, Matriz de EPI por Função, Treinamentos por Função e Colaboradores (`admissoes`). A OS é o **documento que amarra tudo isso por colaborador** e fecha o ciclo NR-1.

## Como vai funcionar (visão do usuário)

1. Em **Compliance SST → Ordem de Serviço**, o gestor vê uma lista de colaboradores ativos da empresa.
2. Para cada colaborador, o sistema calcula o **status da OS**: pendente, vigente, vencida, desatualizada (quando o PGR foi revisado depois da assinatura).
3. Botão **"Gerar OS"** (individual) ou **"Gerar OS em lote"** (por setor/cargo/empresa toda):
   - Sistema lê o PGR vigente da empresa (`sst_documentos` tipo PGR mais recente)
   - Filtra `inventario_riscos` por cargo/setor do colaborador
   - Cruza com `funcao_epis`, `funcao_treinamentos`, `funcao_atividades` da função dele
   - Monta a OS em HTML padronizado com IA preenchendo as lacunas (procedimento seguro, penalidades padrão CLT art. 158)
4. **Pré-visualização** com edição manual antes de finalizar (nossa diretriz: IA orienta, humano valida).
5. Colaborador recebe **link de assinatura por WhatsApp/e-mail** (mesmo padrão de `experiencia_assinatura_links` / `ferias_assinatura_links`) — assina com selfie + geolocalização.
6. PDF final é arquivado automaticamente em **Documentos → SST → Ordens de Serviço → {nome do colaborador}** e fica vinculado ao prontuário do colaborador.
7. Quando um novo PGR é importado, todas as OS daquela empresa entram em **status "desatualizada"** e o sistema gera alertas automáticos com `CriarAcaoAlertaModal` (ação 5W2H de re-emissão).

## Estrutura do documento (conforme NR-1)

```text
ORDEM DE SERVIÇO Nº {seq}/{ano}
Empresa: {razão social} — CNPJ: {cnpj}
Colaborador: {nome} — CPF: {cpf} — Matrícula: {esocial}
Função: {cargo} — Setor: {departamento}
Data de emissão: {data} | Vigência: {validade do PGR}

1. BASE LEGAL — NR-1 item 1.4.1 "b" e art. 157 da CLT
2. RISCOS OCUPACIONAIS DA FUNÇÃO     ← do PGR (gro_riscos / inventario_riscos)
   Físicos | Químicos | Biológicos | Ergonômicos | Acidente | Psicossociais
3. MEDIDAS DE PREVENÇÃO (EPC)        ← medidas_existentes + medidas_recomendadas
4. EPI OBRIGATÓRIO                    ← funcao_epis (com CA, periodicidade)
5. PROCEDIMENTOS SEGUROS DE TRABALHO  ← funcao_atividades + funcao_pops
6. TREINAMENTOS NORMATIVOS            ← funcao_treinamentos (NR-06, NR-35, etc.)
7. CONDUTAS PROIBIDAS
8. PENALIDADES (CLT art. 158, parágrafo único — ato faltoso → advertência/suspensão/justa causa)
9. DECLARAÇÃO DE CIÊNCIA E RECEBIMENTO
   Assinatura do colaborador + selfie + geolocalização + carimbo digital
   Assinatura do responsável (SESMT / RH)
```

## Plano de implementação

### 1. Banco de dados (migration)
- Tabela `ordens_servico`: `id, tenant_id, empresa_id, colaborador_id (admissao_id), cargo_id, numero_sequencial, ano, pgr_id (FK sst_documentos), conteudo_html, conteudo_json (riscos+epis+treinamentos snapshot), data_emissao, data_vigencia, status (rascunho/aguardando_assinatura/assinada/vencida/desatualizada), assinada_em, assinatura_selfie_url, assinatura_geo, assinatura_ip, responsavel_emissao_id, motivo_reemissao`.
- Tabela `ordem_servico_links` (token público para assinatura, padrão `experiencia_assinatura_links`).
- Sequência `ordens_servico_seq` por tenant+ano (trigger BEFORE INSERT).
- Trigger `marcar_os_desatualizadas`: quando novo PGR é inserido em `sst_documentos`, marca todas OS da empresa como `desatualizada` e cria registro em `eventos_sst` com ação 5W2H sugerida.
- RLS: tenant isolation + `empresa_id` ativa; RPC `assinar_ordem_servico_publica(token, selfie, geo)` `SECURITY DEFINER` para a página pública (padrão do nosso public-token-access-pattern).

### 2. Edge function `gerar-ordem-servico`
- Input: `colaborador_id` (ou lista) + `pgr_id` (opcional, default = mais recente vigente).
- Lê PGR (`sst_documentos.analise_ia`), filtra `inventario_riscos` por cargo/setor do colaborador, junta `funcao_epis`, `funcao_treinamentos`, `funcao_atividades`, `funcao_pops`.
- Chama Lovable AI Gateway (gpt-4o, prompt ≤ 3000 chars conforme nossa estratégia) para **redigir os campos textuais** (procedimentos, condutas proibidas) com base nos riscos cruzados — **não para inventar riscos**.
- Devolve `conteudo_html` + `conteudo_json` (snapshot imutável).
- Suporta modo lote (até 50 colaboradores por chamada).

### 3. Frontend
- Rota `/sst/ordens-servico` (eager-loaded, dentro de Compliance SST).
- `OrdemServicoList.tsx`: tabela de colaboradores × status OS, filtros por setor/cargo, ações "Gerar", "Reemitir", "Enviar para assinatura", "Baixar PDF".
- `OrdemServicoEditor.tsx`: editor rich-text com seções pré-preenchidas, validação dos 9 campos NR-1, botão "Finalizar e enviar para assinatura".
- `OrdemServicoPreview.tsx`: hidden div para html2canvas (padrão `document-generation-standards`) + logo da empresa via `useEmpresaLogo`.
- Página pública `/os/:token` (sem AuthContext, usa `supabasePublic` + Prod URL) — colaborador vê a OS, captura selfie + geo, assina.
- Integração com `CriarAcaoAlertaModal` para alertas de OS pendente/desatualizada.
- Arquivamento automático no módulo Documentos (reusa `findOrCreateSSTFolder`, novo mapeamento `OS → "Ordens de Serviço"`).

### 4. Trigger de criação automática
- Quando `admissoes` recebe novo registro com `status='ativo'` E existe PGR vigente → trigger cria OS em status `rascunho` automaticamente, gerando alerta para o RH revisar e enviar.

## Limitações e dependências

1. **Qualidade da OS depende da qualidade do PGR.** Se o PGR não tem riscos mapeados por setor/cargo (campos `setor`/`cargo` em `inventario_riscos`), a OS sai genérica. Mitigação: bloquear geração e exibir "PGR sem inventário detalhado — revise antes" (lock conforme `gro/compliance-locks`).
2. **Função × Cargo:** as tabelas `funcao_*` usam `cargo_id`. Colaboradores em `admissoes` guardam cargo como **texto** (`cargo`), não FK. Precisa de matching por nome ou de FK `cargo_id` na admissão. Vou adicionar coluna opcional `cargo_id` em `admissoes` e fallback por nome (case-insensitive) quando ausente.
3. **PGR sem extração de IA concluída** (`analise_ia_status != 'concluida'`) não pode gerar OS — exibir bloqueio.
4. **Assinatura digital com validade jurídica plena** exige ICP-Brasil; nosso modelo entrega assinatura eletrônica avançada (selfie + geo + IP + hash + carimbo de tempo) — suficiente para NR-1/CLT segundo MP 2.200-2/2001 e prática trabalhista, mas **não é ICP-Brasil**.
5. **Colaboradores sem e-mail nem celular** ficam em "assinatura presencial" (gera QR Code para tablet/quiosque).
6. Limite atual de 50MB por documento (respeitado, OS gira em ~200KB).

## O que preciso de você

Para refinar antes de começar, me confirme:

1. **Numeração:** sequencial por empresa (`OS 001/2026`) ou por tenant (grupo todo)?
2. **Validade da OS:** atrelar à validade do PGR (default), ou prazo fixo (ex.: 12 meses)?
3. **Reemissão automática** quando colaborador muda de função/setor: gerar nova OS automaticamente em rascunho, ou só alertar?
4. **Assinatura do responsável SESMT:** assinatura única do responsável técnico (engenheiro/técnico SST cadastrado) injetada automaticamente, ou cada OS exige assinatura manual dele também?

Pode responder só os números — qualquer omissão eu sigo com o default sugerido (validade = PGR, sequencial por empresa, reemissão automática em rascunho, assinatura SESMT injetada do responsável técnico cadastrado).
