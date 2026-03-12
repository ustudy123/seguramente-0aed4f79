

## Link Individual de Ponto via WhatsApp

### Recomendacao

A melhor abordagem e criar um **token unico por colaborador** vinculado ao tenant, gerando uma pagina publica (`/ponto-externo/:token`) onde o colaborador se identifica apenas confirmando seus dados (nome + CPF parcial), e registra o ponto com selfie + geolocalizacao — sem precisar de conta no sistema.

Isso segue o mesmo padrao ja usado no projeto para trilhas de terceiros e questionario psicossocial (RPCs SECURITY DEFINER + pagina publica).

### Arquitetura

```text
┌─────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ RH gera     │────>│ ponto_links      │────>│ /ponto-externo/  │
│ link por    │     │ (token + colab)  │     │ :token           │
│ colaborador │     └──────────────────┘     │ (pagina publica) │
└─────────────┘                              │ selfie + geo +   │
                                             │ registro via RPC │
                                             └──────────────────┘
```

### Mudancas

**1. Migration SQL**
- Tabela `ponto_links`: `id`, `tenant_id`, `colaborador_id`, `colaborador_nome`, `colaborador_cpf`, `token` (unique), `ativo`, `data_expiracao` (opcional), `created_at`
- RPC `buscar_ponto_link_por_token(p_token)`: retorna dados do colaborador se token valido e ativo (SECURITY DEFINER, grant anon)
- RPC `registrar_ponto_externo(p_token, p_tipo_marcacao, p_latitude, p_longitude, p_endereco, p_selfie_base64)`: valida token, insere em `ponto_marcacoes`, retorna confirmacao (SECURITY DEFINER, grant anon)
- RLS: tabela `ponto_links` com select/insert/update para authenticated onde `tenant_id = get_user_tenant_id()`

**2. Pagina Publica — `src/pages/PontoExterno.tsx`**
- Rota: `/ponto-externo/:token`
- Fluxo: carrega dados via RPC → exibe nome do colaborador → captura selfie + geolocalizacao → botoes de marcacao (entrada/saida almoco/retorno/saida) → registra via RPC → exibe comprovante
- Usa `supabasePublic` (sem sessao)
- Design mobile-first (sera acessado pelo WhatsApp)

**3. Componente de Gestao — `src/components/ponto/PontoLinksTab.tsx`**
- Nova aba "Links" no modulo de Ponto
- Lista colaboradores com status do link (ativo/inativo/sem link)
- Botao "Gerar Link" por colaborador
- Botao "Copiar" e "Enviar via WhatsApp" (abre `https://wa.me/{telefone}?text=...`)
- Botao para gerar links em lote
- Opcao de desativar/reativar links

**4. Seguranca**
- Token de 16 caracteres aleatorios (uuid sem hifens truncado)
- Selfie obrigatoria na pagina publica
- Geolocalizacao capturada automaticamente
- RPC valida token ativo + insere com todas as camadas de rastreabilidade (IP, user_agent, dispositivo)
- Possibilidade de expirar links por data
- Audit trail: cada registro via link externo fica marcado com `origem = 'link_externo'`

**5. Integracao WhatsApp**
- Nao requer API do WhatsApp — usa o deep link `https://wa.me/{telefone}?text={mensagem_encodada}`
- Mensagem padrao: "Ola {nome}! Acesse seu link de registro de ponto: {url}"
- Botao individual e botao em lote

**6. Arquivos afetados**
- Nova migration SQL
- `src/pages/PontoExterno.tsx` (novo)
- `src/components/ponto/PontoLinksTab.tsx` (novo)
- `src/pages/Ponto.tsx` (adicionar aba Links)
- `src/App.tsx` (adicionar rota publica)

