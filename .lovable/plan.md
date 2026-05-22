## Módulo de Contratos & Termos de Aceite (Super Admin)

Criar um sistema flexível para o Super Admin cadastrar contratos/termos (LIVEs, aulas, uso do sistema, parcerias, NDAs, etc.), gerar link público de assinatura e gerenciar todos os aceites com validade jurídica conforme **Lei 14.063/2020** e **MP 2.200-2/2001**.

---

### 1. Estrutura de dados (Supabase)

**`contratos_aceite`** (modelos de contrato criados pelo admin)
- `titulo`, `categoria` (live | aula | uso_sistema | parceria | nda | outro)
- `descricao_publica` (o que o signatário vê antes de assinar)
- `corpo_html` (texto completo do contrato, editor rich text)
- `requer_cpf`, `requer_rg`, `requer_endereco`, `requer_selfie` (flags configuráveis)
- `validade_dias` (link expira em N dias; null = sem expiração)
- `limite_assinaturas` (null = ilimitado; ex: 50 para uma live)
- `ativo`, `versao` (versionamento — contratos já assinados ficam imutáveis)
- `created_by` (super admin)

**`contratos_assinaturas`** (cada aceite registrado)
- `contrato_id`, `token` (UUID público único por signatário OU compartilhado)
- `signatario_nome`, `signatario_cpf`, `signatario_email`, `signatario_telefone`
- `signatario_rg`, `signatario_endereco` (opcionais conforme contrato)
- `assinatura_imagem_base64` (canvas), `selfie_base64` (opcional)
- `ip_address`, `user_agent`, `geolocalizacao` (lat/lng)
- `hash_documento` (SHA-256 do `corpo_html` + dados do signatário no momento)
- `assinado_em`, `link_enviado_em`
- `status` (pendente | assinado | expirado | revogado)

**RLS:**
- `contratos_aceite`: apenas super admin (CRUD completo)
- `contratos_assinaturas`: super admin lê tudo; inserção via RPC `SECURITY DEFINER` a partir do token público (sem login)

---

### 2. Fluxo do Super Admin

**Nova aba no `/admin` chamada "Contratos"** com:

1. **Lista de contratos** (card grid): título, categoria, total de assinaturas, status, ações (editar, duplicar, desativar, ver assinaturas).
2. **Editor de contrato** (modal/drawer):
   - Campos básicos (título, categoria, descrição)
   - Editor rich text para corpo do contrato (já temos pattern em outros módulos)
   - Configurações (validade, limite, dados exigidos do signatário)
3. **Geração de link de assinatura:**
   - Botão "Gerar link" → cria token, copia URL `https://www.youreyes.com.br/assinar-contrato/{token}` para clipboard
   - Botão "Enviar por e-mail" → captura e-mail e dispara via `send-email-resend` com template novo
   - Botão "Enviar por WhatsApp" → reusa `superadmin-whatsapp-send` com link
4. **Painel de assinaturas do contrato:** tabela com signatário, data, IP, status, ação de baixar PDF com carimbo.

---

### 3. Página pública de assinatura

**Rota `/assinar-contrato/:token`** (sem login, padrão `supabasePublic` já existente):

1. Valida token via RPC `obter_contrato_publico(token)` (`SECURITY DEFINER`).
2. Mostra:
   - Cabeçalho com logo Você Olhos
   - Título e descrição pública do contrato
   - Corpo completo do contrato (HTML renderizado, scrollável)
   - Formulário: nome, CPF, e-mail, telefone (+ campos opcionais)
   - Checkbox: "Li e concordo com os termos acima"
   - `SignatureCapture` (canvas — reusa componente existente)
   - Captura automática de **selfie + geolocalização** se exigido (já temos pattern em OS NR-1)
3. Submissão chama edge function `contrato-assinar` que:
   - Valida token, limite, expiração
   - Calcula SHA-256 do documento + dados
   - Captura IP do header
   - Salva em `contratos_assinaturas`
   - Gera PDF com carimbo de auditoria e envia por e-mail ao signatário (cópia ao admin)
4. Tela de sucesso com download do PDF assinado.

---

### 4. Validade jurídica (carimbo de auditoria)

Cada PDF gerado inclui ao final um **carimbo de auditoria** (mesmo padrão usado em OS NR-1, PDI, Férias) com:
- Nome completo + CPF do signatário
- Data/hora UTC + horário de Brasília
- IP de origem e User-Agent
- Geolocalização (se capturada)
- Selfie (se capturada)
- Hash SHA-256 do documento
- Token de assinatura
- Citação legal: "Lei 14.063/2020 e MP 2.200-2/2001 — Assinatura eletrônica avançada"

Isso garante validade jurídica equivalente às assinaturas já existentes no sistema (EPI, OS, PDI, Férias, Contrato Programa Validador).

---

### 5. Detalhes técnicos

- **Tabelas novas:** `contratos_aceite`, `contratos_assinaturas` com RLS
- **RPCs `SECURITY DEFINER`:** `obter_contrato_publico(_token)`, `registrar_assinatura_contrato(...)`
- **Edge function nova:** `contrato-assinar` (gera hash, captura IP, envia e-mail com PDF)
- **Template de e-mail novo:** `contrato-assinatura-enviado` (Resend, padrão já existente)
- **Componentes novos:**
  - `src/pages/admin/contratos/ContratosAdmin.tsx` (lista + CRUD)
  - `src/pages/admin/contratos/ContratoEditor.tsx` (editor)
  - `src/pages/admin/contratos/ContratoAssinaturas.tsx` (painel de assinaturas)
  - `src/pages/AssinarContrato.tsx` (página pública)
  - `src/hooks/useContratosAceite.ts`
- **Aba nova** no `SuperAdminDashboard.tsx`: "Contratos" (ícone `FileSignature`)
- **Reuso:** `SignatureCapture`, `supabasePublic`, `useEmpresaLogo`, `pdfExport`, `sendEmail`

---

### 6. Evoluções futuras (não incluídas agora)

- Integração Gov.br (assinatura governamental gratuita)
- Múltiplos signatários no mesmo documento
- Workflow de aprovação interna antes do envio
- Integração ICP-Brasil (e-CPF/e-CNPJ via PAdES)

Posso começar pela criação das tabelas e a estrutura básica do módulo. Confirma?