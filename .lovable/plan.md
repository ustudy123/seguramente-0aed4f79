## Situação atual

- `ponto_marcacoes` já grava `latitude`, `longitude` e `endereco_geolocalizacao` (endereço reverso do OpenStreetMap).
- **Não existe cerca (geofence):** nenhum raio configurado, nenhum ponto-referência (lat/lon) da empresa/filial, nenhum flag de "fora da cerca".
- O endereço da batida já aparece no `MarcacaoBadge`, mas hoje é exibido tanto para o colaborador quanto para o gestor.

## O que vou implementar

### 1. Banco (migration)

**`empresa_cadastro`** — adicionar coordenadas do local de trabalho:
- `latitude numeric`, `longitude numeric`
- `raio_geofence_metros integer DEFAULT 150`
- `geofence_ativo boolean DEFAULT false`

**`filiais`** — mesmos 4 campos (opcional; se preenchido, tem precedência sobre a matriz).

**`ponto_marcacoes`** — adicionar campos calculados no INSERT:
- `distancia_metros numeric` — distância entre a batida e o ponto de referência
- `dentro_cerca boolean` — `true` / `false` / `null` (se geofence desativado)
- `geofence_ref text` — de onde veio o centro (`filial:<id>` ou `empresa:<id>`)

**Trigger `BEFORE INSERT`** em `ponto_marcacoes`:
1. Busca a filial do colaborador (`admissoes.filial` → `filiais.nome` no mesmo `empresa_id`), pega lat/lon/raio se `geofence_ativo=true`.
2. Fallback: `empresa_cadastro` do `empresa_id` da marcação.
3. Calcula distância via `haversine_distance` (já existe) × 1000.
4. Marca `dentro_cerca = distancia <= raio`.
5. Se não houver referência ou geofence desativado → deixa `null` (não bloqueia batida).

Backfill: preenche `dentro_cerca=null, distancia_metros=null` para registros antigos (nada a corrigir retroativamente).

### 2. Configuração (UI — gestor)

**Nova seção na aba "Configuração" do Ponto (`PontoConfigTab.tsx`)** — card "Cerca de Geolocalização":
- Switch "Ativar cerca de geolocalização"
- Input `latitude` / `longitude` do local principal (com botão "Usar minha localização atual" via `useGeolocation`)
- Input `raio_geofence_metros` (padrão 150m, min 30, max 5000)
- Texto explicativo: "As batidas fora do raio serão marcadas como 'Fora da cerca' apenas para gestores. A batida não é bloqueada — serve como evidência para auditoria."

Grava em `empresa_cadastro` do `empresa_id` ativo.

*(Configuração por filial fica para uma iteração seguinte se pedirem — o modelo já suporta.)*

### 3. Exibição (UI — só gestor)

**`MarcacaoBadge.tsx`** — adiciona badge visual quando `podeEditar === true` (que já é gestor/admin):
- `dentro_cerca === true` → badge verde `Dentro da cerca (Xm)`
- `dentro_cerca === false` → badge âmbar `Fora da cerca (Xm)`
- `null` → nada
- Endereço continua visível para todos (já era).
- Nova prop `distanciaMetros`, `dentroCerca` no hook `usePonto` (extrair no `select`).

**Nada muda na tela do colaborador** — ele continua vendo hora, endereço e selfie, mas não vê a métrica de cerca.

### 4. Alerta opcional (fora de escopo agora)

Poderia gerar `ponto_alertas` do tipo `batida_fora_cerca` — deixo comentado no trigger como TODO para não expandir muito. Confirma se quer que eu já ative esse alerta agora.

## Arquivos afetados

- `supabase/migrations/<novo>.sql` (schema + trigger + grants)
- `src/components/ponto/PontoConfigTab.tsx` (nova seção)
- `src/components/ponto/MarcacaoBadge.tsx` (badge de cerca)
- `src/hooks/usePonto.ts` (select dos novos campos + tipos)

## Fora de escopo (avise se quiser incluir)

- Bloquear batida fora da cerca (hoje só sinaliza).
- Múltiplos pontos de referência por filial (obras, canteiros).
- Alerta automático 5W2H para "fora da cerca".
