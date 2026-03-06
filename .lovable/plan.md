

# Varredura de Qualidade do Seguramente

## Diagnóstico Atual

Fiz uma varredura completa no sistema. Aqui esta o resultado organizado por prioridade:

---

## 1. Seguranca (12 findings - 4 criticos, 8 warnings)

### Criticos (precisam correcao imediata)
- **Dados pessoais de clientes expostos**: tabela `programa_validador_clientes` permite leitura publica de nomes, emails, telefones, CPF/CNPJ
- **Contratos com assinaturas expostos**: tabela `programa_validador_contratos` sem restricao de token
- **Links de documentos expostos**: tabela `programa_validador_documento_links` sem validacao de token  
- **Campanhas psicossociais expostas**: tabela `questionario_psicossocial_campanhas` legivel publicamente

### Warnings
- 5 policies RLS com `USING (true)` ou `WITH CHECK (true)` em operacoes INSERT/UPDATE/DELETE
- Protecao contra senhas vazadas desabilitada no Supabase Auth
- `landing_vagas` e `marketplace_categorias` sem protecao contra escrita

---

## 2. Testes Automatizados (praticamente inexistentes)

Existe apenas 1 teste placeholder (`example.test.ts` com `expect(true).toBe(true)`). Zero cobertura real.

### Testes prioritarios a criar:
- **`useAuth`**: login, logout, roles, superadmin
- **`usePsicossocial`**: calcularIndicadores (COPSOQ/HSE), regra de anonimato (5 respostas)
- **`usePlanoAcao`**: CRUD de acoes 5W2H
- **Componentes criticos**: CampanhaForm, QuestionarioResponder, ResultadosModal
- **Edge Functions**: ai-psicossocial-analise, onboarding-signup

---

## 3. Qualidade de Codigo

- **982 console.log/error/warn** em 91 arquivos (excesso de logs em producao)
- **2847 usos de `any`** em 166 arquivos (tipagem fraca)
- **737 blocos catch** em 85 arquivos -- muitos com tratamento generico (`catch (e: any)`)
- Sem error boundaries globais para capturar crashes de UI

---

## 4. Usabilidade e Boas Praticas

- Sem loading skeletons consistentes (alguns modulos tem, outros nao)
- Sem feedback visual padronizado para estados vazios
- Sem validacao de formularios consistente (alguns usam zod, outros nao)

---

## Plano de Execucao Recomendado

### Fase 1 -- Seguranca (urgente)
1. Corrigir as 4 policies RLS criticas (restringir por token real)
2. Remover as 5 policies `USING (true)` em operacoes de escrita
3. Habilitar leaked password protection no Supabase

### Fase 2 -- Testes Automatizados
4. Criar testes unitarios para `calcularIndicadores` (COPSOQ + HSE)
5. Criar testes para `useAuth` (mock do Supabase)
6. Criar testes para componentes criticos (CampanhaForm, QuestionarioResponder)

### Fase 3 -- Qualidade de Codigo
7. Adicionar Error Boundary global
8. Limpeza de console.logs desnecessarios
9. Substituir `as any` criticos por tipos corretos

### Fase 4 -- Usabilidade
10. Padronizar estados vazios e loading states
11. Padronizar validacao de formularios com zod

---

## Recomendacao

Sugiro comecar pela **Fase 1 (Seguranca)** -- os 4 findings criticos expõem dados pessoais publicamente e precisam de correcao imediata. Em seguida, **Fase 2 (Testes)** para garantir que as correcoes e funcionalidades existentes funcionam corretamente.

