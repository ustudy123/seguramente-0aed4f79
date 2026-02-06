
# Plano: Questionário Psicossocial Seguramente

## Objetivo
Implementar um sistema completo de avaliação de riscos psicossociais, organização do trabalho e saúde mental, fundamentado em modelos internacionais (JD-R, COPSOQ, ISO 45003) e adaptado à legislação brasileira (NR-01 e NR-17), com multiplas opcoes de distribuicao para atender diferentes perfis de colaboradores.

---

## Canais de Distribuicao Recomendados

### 1. Link Publico com Token (Principal)
- Questionario via link unico por colaborador
- Interface estilo quiz, responsiva e mobile-friendly
- Nao requer login/senha - apenas CPF para validacao
- Funciona em qualquer dispositivo com navegador

### 2. QR Code
- Gerar QR Code por colaborador ou campanha
- Ideal para distribuicao impressa (mural, folheto, crachá)
- Colaborador escaneia e responde no celular

### 3. Integracao WhatsApp (Futuro)
- Envio de link via API do WhatsApp Business
- Notificacoes e lembretes automaticos
- Depende de configuracao externa (Twilio/Meta API)

### 4. Quiosque/Totem
- Modo especial para resposta em terminais compartilhados
- Ideal para colaboradores operacionais sem acesso a computador
- Interface simplificada com botoes grandes

---

## Estrutura do Banco de Dados

### Novas Tabelas

```text
questionario_psicossocial_campanhas
├── id (uuid)
├── tenant_id (uuid)
├── nome (text)
├── descricao (text)
├── status (rascunho | ativa | encerrada)
├── data_inicio (date)
├── data_fim (date)
├── anonimo (boolean) - respostas anonimas ou identificadas
├── departamentos_ids (uuid[])
├── cargos_ids (uuid[])
├── blocos_dinamicos (jsonb) - CET ativados
├── created_at, updated_at

questionario_psicossocial_convites
├── id (uuid)
├── tenant_id (uuid)
├── campanha_id (uuid)
├── colaborador_id (uuid)
├── colaborador_nome (text)
├── colaborador_cpf (text)
├── token (text) - token unico para acesso
├── status (pendente | iniciado | concluido | expirado)
├── enviado_via (link | qrcode | whatsapp | email)
├── enviado_em (timestamp)
├── iniciado_em (timestamp)
├── concluido_em (timestamp)
├── lembrete_enviado (boolean)

questionario_psicossocial_respostas
├── id (uuid)
├── tenant_id (uuid)
├── campanha_id (uuid)
├── convite_id (uuid)
├── colaborador_id (uuid) - null se anonimo
├── respostas (jsonb) - {pergunta_id: valor}
├── tempo_resposta_segundos (integer)
├── ip_address (text)
├── user_agent (text)
├── concluido_em (timestamp)
├── created_at
```

---

## Estrutura do Questionario

### Escala Padrao (1-5)
| Valor | Label |
|-------|-------|
| 1 | Nunca |
| 2 | Raramente |
| 3 | As vezes |
| 4 | Frequentemente |
| 5 | Sempre |

### Blocos de Perguntas

1. Demandas Quantitativas e Ritmo de Trabalho (4 perguntas)
2. Demandas Cognitivas (4 perguntas)
3. Demandas Emocionais (3 perguntas)
4. Autonomia, Controle e Influencia (4 perguntas)
5. Clareza de Papeis e Organizacao (4 perguntas)
6. Reconhecimento, Justica e Valorizacao (3 perguntas)
7. Relacionamentos, Clima e Suporte Social (3 perguntas)
8. Sentido do Trabalho e Engajamento (3 perguntas)
9. Recuperacao, Pausas e Equilibrio (3 perguntas)
10. Sinais Precoces de Sofrimento Psiquico (4 perguntas)

### Blocos Dinamicos (CET) - Conforme perfil
- Trabalho Noturno / 3o Turno
- Trabalho em Altura
- Espaco Confinado
- Trabalho Isolado
- Etc.

---

## Componentes a Criar

### Novos Arquivos

```text
src/types/
└── psicossocial.ts                    # Tipos do questionario

src/hooks/
└── usePsicossocial.ts                 # Hook principal

src/components/avaliacoes/psicossocial/
├── PsicossocialDashboard.tsx          # Dashboard principal
├── CampanhaList.tsx                   # Lista de campanhas
├── CampanhaForm.tsx                   # Criar/editar campanha
├── ConvitesList.tsx                   # Lista de convites enviados
├── DistribuicaoModal.tsx              # Modal para enviar convites
├── ResultadosOverview.tsx             # Visao geral resultados
├── ResultadosIndicadores.tsx          # IRP-S, IBO-S, etc.
├── QuestionarioPreview.tsx            # Visualizar questionario

src/pages/
└── QuestionarioPsicossocial.tsx       # Pagina publica do quiz
```

### Pagina Publica do Questionario

Rota: `/questionario/:token`

Interface estilo quiz com:
- Uma pergunta por tela (mobile-first)
- Barra de progresso visual
- Navegacao por swipe ou botoes
- Escala visual com emojis ou cores
- Auto-save a cada resposta
- Tempo estimado restante
- Confirmacao no final

---

## Interface do Usuario

### Aba "Psicossocial" no Modulo Avaliacoes

```text
┌──────────────────────────────────────────────────────────────────┐
│  Avaliacoes de Desempenho                                        │
│                                                                   │
│  [Minha Caixa] [Ciclos] [Metas] [Templates] [9-Box] [Psicossocial]│
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │ Campanhas   │ │ Respostas   │ │ Taxa        │ │ IRP-S       │ │
│  │ Ativas      │ │ Recebidas   │ │ Participacao│ │ Medio       │ │
│  │     2       │ │    156      │ │    78%      │ │    3.2      │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
│                                                                   │
│  [+ Nova Campanha]                                               │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Campanha: Avaliacao Psicossocial Q1 2026                   │  │
│  │ Status: Ativa  |  Periodo: 01/02 - 28/02                   │  │
│  │ Participacao: 156/200 (78%)                                │  │
│  │ [Ver Resultados] [Enviar Lembretes] [Gerar QR Codes]       │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### Questionario Publico (Mobile-First)

```text
┌─────────────────────────────────────────┐
│  Seguramente                            │
│  Questionario Psicossocial              │
│                                         │
│  ████████████░░░░░░░░  Pergunta 12/35   │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │                                   │  │
│  │  O volume de trabalho que recebo  │  │
│  │  e maior do que consigo realizar  │  │
│  │  no meu horario normal.           │  │
│  │                                   │  │
│  │  ┌─────┐ ┌─────┐ ┌─────┐          │  │
│  │  │ 😊  │ │ 🙂  │ │ 😐  │          │  │
│  │  │Nunca│ │Raram│ │As   │          │  │
│  │  │     │ │ente │ │vezes│          │  │
│  │  └─────┘ └─────┘ └─────┘          │  │
│  │                                   │  │
│  │  ┌─────┐ ┌─────┐                  │  │
│  │  │ 😟  │ │ 😰  │                  │  │
│  │  │Freq │ │Sempr│                  │  │
│  │  │uente│ │  e  │                  │  │
│  │  └─────┘ └─────┘                  │  │
│  └───────────────────────────────────┘  │
│                                         │
│     [← Anterior]  [Proximo →]           │
│                                         │
│  Tempo estimado: ~8 min restantes       │
└─────────────────────────────────────────┘
```

---

## Indicadores Gerados

| Indicador | Nome | Descricao |
|-----------|------|-----------|
| IRP-S | Indice Risco Psicossocial | Score geral de risco (blocos 1-6) |
| IBO-S | Indice Burnout Seguramente | Correlacao sobrecarga + exaustao |
| IBD-S | Indice Boreout Seguramente | Baixo desafio + repeticao + apatia |
| IREC-S | Indice Recuperacao | Equilibrio trabalho-vida |
| ICOP-S | Indice Clareza Organizacional | Papeis e responsabilidades |

### Calculo Automatico

Cada indicador e calculado com base nas respostas ponderadas:
- Perguntas invertidas sao recalculadas (5 - valor)
- Peso por bloco normativo (NR-01, NR-17, ISO 45003)
- Score final em escala 1-5

---

## Fluxo de Distribuicao

```text
┌─────────────────────────────────────────────────────────────────┐
│                    CRIAR CAMPANHA                               │
│                                                                 │
│  1. Definir nome, periodo, departamentos                        │
│  2. Escolher se anonimo ou identificado                         │
│  3. Selecionar blocos dinamicos (CET)                           │
│                         ↓                                       │
│                  GERAR CONVITES                                 │
│                                                                 │
│  Para cada colaborador selecionado:                             │
│  - Gerar token unico                                            │
│  - Criar link: /questionario/{token}                            │
│  - Gerar QR Code correspondente                                 │
│                         ↓                                       │
│               DISTRIBUIR CONVITES                               │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Copiar Links │  │ Baixar QRs  │  │ Enviar Email │          │
│  │ (Planilha)   │  │ (PDF/ZIP)   │  │ (Futuro)     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
│  WhatsApp: Colaborador clica no link e responde no celular     │
│  QR Code: Colaborador escaneia e responde                       │
│  Totem: Colaborador digita CPF e responde                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Acao |
|---------|------|
| `src/pages/Avaliacoes.tsx` | Adicionar aba "Psicossocial" |
| `src/types/psicossocial.ts` | Criar tipos do questionario |
| `src/hooks/usePsicossocial.ts` | Criar hook principal |
| `src/App.tsx` | Adicionar rota publica /questionario/:token |
| `src/components/avaliacoes/psicossocial/*` | Criar componentes |
| `src/pages/QuestionarioPsicossocial.tsx` | Pagina publica do quiz |

---

## Beneficios da Abordagem Link/QR Code

1. **Acessibilidade Universal**: Funciona em qualquer celular com navegador
2. **Sem Barreiras**: Nao precisa de app, login ou senha
3. **Familiar**: Interface similar a pesquisas que pessoas ja conhecem
4. **Rapido**: 5-10 minutos para responder
5. **Rastreavel**: Cada token e unico para acompanhamento
6. **Offline-Ready**: Pode funcionar offline com sync posterior
7. **WhatsApp-Friendly**: Link pode ser enviado por qualquer mensageiro

---

## Detalhes Tecnicos

### Geracao de Token
```typescript
const token = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
// Resultado: "a1b2c3d4e5f6"
```

### Geracao de QR Code
Usar biblioteca `qrcode` para gerar PNG/SVG client-side

### Pagina Publica
- Rota: `/questionario/:token`
- Nao requer autenticacao
- Valida token no backend
- Auto-save a cada resposta

### Integracao com Radares
Os indicadores gerados alimentam automaticamente:
- Radar Burnout (IBO-S)
- Radar Boreout (IBD-S)
- Radar Energia Organizacional

---

## Proximos Passos

1. Criar tabelas no banco de dados
2. Implementar tipos TypeScript
3. Criar hook usePsicossocial
4. Adicionar aba Psicossocial ao modulo Avaliacoes
5. Criar interface de gestao de campanhas
6. Desenvolver pagina publica do questionario (quiz)
7. Implementar geracao de QR Codes
8. Criar dashboard de resultados e indicadores
