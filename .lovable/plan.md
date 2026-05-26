
# Entrevista Guiada por IA — Campanhas Psicossociais

## Objetivo
Resolver o gap de empresas com poucos colaboradores (onde questionário quantitativo perde validade pelo `MINIMO_ANONIMATO = 5`), criando um segundo instrumento qualitativo: **entrevista 1:1 conduzida por IA especialista em ergonomia/SST**, ancorada nos 13 riscos psicossociais e na tarefa real.

## Regra de habilitação (por nº de colaboradores ativos da empresa)

| Faixa | Questionário | Entrevista Guiada |
|---|---|---|
| `< 5` | ❌ desabilitado (sem anonimato) | ✅ habilitado (único caminho) |
| `5 – 10` | ✅ habilitado | ✅ habilitado (escolha **exclusiva** por campanha) |
| `> 10` | ✅ habilitado | ❌ desabilitado (inviável operacionalmente) |

Cada card desabilitado mostra tooltip + texto explicativo do motivo.

## Fluxo da entrevista
1. Gestor cria campanha → escolhe "Entrevista Guiada" → seleciona colaboradores (ou todos) → sistema gera **link público com token** por entrevistado (mesmo padrão do questionário, via `supabasePublic` e `SECURITY DEFINER`).
2. Entrevistado abre o link → tela de consentimento LGPD → escolhe modalidade (**texto** ou **voz**).
3. Chat com IA roda em 3 fases:
   - **Fase 1 — Tarefa real:** "Me conta como foi seu último turno, do início ao fim." (foco em comportamento real, não prescrito)
   - **Fase 2 — Sondagem dos 13 riscos:** IA puxa gatilhos derivados de cada risco (assédio, sobrecarga, baixa autonomia, etc.) baseados nas falas reais.
   - **Fase 3 — Validação:** IA resume o que entendeu, entrevistado confirma/corrige.
4. Ao fechar, IA executa **tool calling estruturado**:
   - Para cada um dos 13 riscos: `{ presente: bool, probabilidade: 1-5, severidade: 1-5, justificativa, trechos_evidencia[] }`
   - Anonimiza trechos automaticamente (remove nomes próprios, cargos únicos, datas identificáveis).

## Saída e integração
- **Inventário PGR** recebe os scores P×S por risco direto (sem revisão manual obrigatória — IA define, gestor pode editar depois).
- **Relatório qualitativo** lista, por risco identificado, os **trechos anonimizados** como evidência citável (diferencial jurídico).
- Continua alimentando `gro_riscos` + `CriarAcaoAlertaModal` → Plano de Ação Global 5W2H (igual ao questionário).

## Modalidades de resposta
- **Texto:** chat escrito padrão (SSE streaming via Lovable AI Gateway).
- **Voz:** grava trechos com `useAudioRecorder` → transcreve via Whisper (`ai-transcribe-audio` já existente) → injeta no chat.
- Entrevistado escolhe no início; pode alternar durante.

## Privacidade
- Trechos **sempre anonimizados** antes de persistir (pipeline na própria edge function).
- Bucket privado ou só texto em DB (sem áudio bruto após transcrição).

---

## Arquitetura técnica

### 1. Migration (DB)

```sql
-- Campo na campanha indica o instrumento
ALTER TABLE psicossocial_campanhas
  ADD COLUMN tipo_instrumento text DEFAULT 'questionario'
  CHECK (tipo_instrumento IN ('questionario','entrevista_guiada'));

-- Sessão de entrevista (uma por entrevistado/token)
CREATE TABLE public.psicossocial_entrevistas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  empresa_id uuid,
  campanha_id uuid NOT NULL,
  colaborador_id uuid,
  ghe_id_snapshot uuid,
  token text UNIQUE NOT NULL,
  modalidade text DEFAULT 'texto', -- 'texto' | 'voz'
  status text DEFAULT 'pendente',  -- pendente | em_andamento | concluida | abandonada
  consentimento_lgpd_em timestamptz,
  iniciada_em timestamptz,
  concluida_em timestamptz,
  resumo_ia jsonb,        -- { riscos: [{risco_id, P, S, justificativa, trechos[]}] }
  fase_atual int DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- Turnos do chat
CREATE TABLE public.psicossocial_entrevistas_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entrevista_id uuid NOT NULL REFERENCES psicossocial_entrevistas(id) ON DELETE CASCADE,
  role text NOT NULL,    -- 'user' | 'assistant' | 'system'
  content text NOT NULL,
  origem text DEFAULT 'texto', -- 'texto' | 'voz_transcrita'
  created_at timestamptz DEFAULT now()
);

-- Evidências extraídas (alimenta Inventário PGR + relatório)
CREATE TABLE public.psicossocial_entrevistas_evidencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entrevista_id uuid NOT NULL REFERENCES psicossocial_entrevistas(id) ON DELETE CASCADE,
  risco_catalogo_id uuid,    -- ref ao catálogo de 13 riscos
  risco_nome text,
  probabilidade int CHECK (probabilidade BETWEEN 1 AND 5),
  severidade int CHECK (severidade BETWEEN 1 AND 5),
  justificativa text,
  trechos_anonimizados text[],
  created_at timestamptz DEFAULT now()
);

-- GRANTs + RLS + RPC SECURITY DEFINER para acesso público via token
-- (padrão já consolidado no projeto)
```

### 2. Edge function `ai-psicossocial-entrevista`
- Endpoints: `start` (cria sessão), `chat` (streaming SSE com Lovable AI Gateway), `voice` (recebe base64 → transcreve via Whisper → encaminha ao chat), `finalize` (executa tool calling estruturado, anonimiza, persiste evidências, marca campanha).
- Modelo: `google/gemini-3-flash-preview` para chat (rápido), `openai/gpt-5` para o `finalize` (precisa de reasoning + tool calling estruturado).
- System prompt fixo no servidor com: persona de ergonomista, lista dos 13 riscos com âncoras, regra de tarefa real, regra de anonimização.

### 3. Edge function `psicossocial-anonimizar` (helper interno)
- Recebe trecho, devolve trecho sem nomes próprios, cargos únicos da empresa, datas absolutas → mantém só conteúdo descritivo do risco.

### 4. Frontend — UI

| Arquivo | Mudança |
|---|---|
| `NovaCampanhaModal` (ou equivalente onde abre a tela da imagem) | Buscar `qtd_colaboradores_ativos` da empresa. Renderizar 2 cards (Entrevista Guiada à esquerda, Questionário à direita) com `disabled` + tooltip por faixa. Texto explicativo dinâmico no card desabilitado. |
| `src/pages/EntrevistaGuiada.tsx` (novo, público) | Página pública via token: consentimento → escolha modalidade → chat com IA. Streaming token-a-token. Botão de microfone se modalidade=voz. |
| `src/components/avaliacoes/psicossocial/EntrevistaChat.tsx` (novo) | Componente de chat com `ReactMarkdown`, indicador de progresso por fase, badge "Cobrimos 7 de 13 temas". |
| `InventarioPGR.tsx` | Quando a campanha for `entrevista_guiada`, ler de `psicossocial_entrevistas_evidencias` em vez de `psicossocial_respostas` para montar a tabela (mesma estrutura P/S/N). |
| Relatório psicossocial | Nova seção "Evidências qualitativas" listando trechos anonimizados agrupados por risco. |
| `App.tsx` | Nova rota pública `/entrevista-guiada/:token` (lazy load, sem AuthContext). |

### 5. Hook novo
- `useEntrevistaIA(token)` — gerencia conexão SSE, histórico de mensagens, envio de áudio, finalização.

### 6. Pontos de integração já existentes (reuso)
- `psicossocial-whatsapp-otp` para envio do link.
- `CriarAcaoAlertaModal` para 5W2H sobre riscos identificados.
- `useEmpresaLogo` no relatório.
- `psicossocial-severidade.ts` para âncoras 1–5 no prompt da IA.

---

## Entregas por fase

**Fase A — Backend foundation (1 migration + 1 edge function)**
- Migration completa com tabelas, GRANTs, RLS, RPC pública por token.
- Edge function `ai-psicossocial-entrevista` com start/chat/finalize.

**Fase B — UI gestor**
- Cards com habilitação dinâmica por nº de colaboradores na tela "Nova Campanha Psicossocial".
- Fluxo de criação de campanha tipo `entrevista_guiada` (gera tokens e links).

**Fase C — UI entrevistado**
- Rota pública `/entrevista-guiada/:token` com consentimento + chat texto.
- Adicionar modalidade voz (botão mic + Whisper).

**Fase D — Integração resultados**
- `InventarioPGR` lê evidências quando campanha é entrevista.
- Seção "Evidências qualitativas" no relatório com trechos anonimizados.
- Botão "Criar Ação 5W2H" em cada evidência.

---

## Riscos e mitigações
- **Custo de IA por entrevista:** limitar a ~30 turnos + 20min de sessão; usar `flash` no chat e só `gpt-5` no `finalize`.
- **Abandono:** salvar estado a cada mensagem para retomar; mostrar progresso por fase.
- **IA "inventando" trechos:** Fase 3 obriga validação; só vão pro relatório trechos que o entrevistado confirmou na fase de validação.
- **N=1 identificável:** anonimização forte + relatório nunca mostra nome do entrevistado, só "Entrevistado A/B/C".
