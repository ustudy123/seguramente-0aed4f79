
## Seletor Global de Empresa Ativa

### Problema
Hoje o sistema mostra apenas o nome do tenant no header ("Empresa SudomedS"), mas quando o usuario trabalha com varias empresas do mesmo grupo, precisa de uma forma rapida de trocar a empresa ativa para filtrar dados em todos os modulos.

### Solucao Proposta
Criar um **seletor de empresa** no header que substitui o indicador estático do tenant. O seletor tera:
- Dropdown clicavel mostrando a empresa ativa atual
- Campo de busca para filtrar empresas por razao social, nome fantasia ou CNPJ
- Lista das empresas ativas do tenant
- Opcao "Todas as empresas" para visao consolidada
- Persistencia da selecao no localStorage

### Componentes

1. **Context Global (`EmpresaAtivaContext`)** - Novo contexto React que armazena a empresa selecionada e disponibiliza para toda a aplicacao
   - Estado: `empresaAtiva` (empresa selecionada ou null para "todas")
   - Lista de empresas do tenant via `useEmpresaCadastro`
   - Persistencia no `localStorage` por usuario

2. **Componente Seletor (`EmpresaSelector`)** - Dropdown no header com:
   - Icone de empresa + nome da empresa ativa (ou "Todas as empresas")
   - Popover com campo de busca e lista scrollavel
   - Busca por razao social, nome fantasia e CNPJ
   - Indicador visual da empresa selecionada

3. **Integracao no Header** - Substituir o bloco estatico "Empresa / SudomedS" pelo novo componente `EmpresaSelector`

4. **Hook `useEmpresaAtiva`** - Hook para consumir o contexto em qualquer modulo que precise filtrar por empresa

### Detalhes Tecnicos

**Arquivos a criar:**
- `src/contexts/EmpresaAtivaContext.tsx` - Context + Provider + hook
- `src/components/layout/EmpresaSelector.tsx` - Componente UI do seletor

**Arquivos a editar:**
- `src/components/layout/Header.tsx` - Trocar indicador estatico pelo seletor
- `src/components/layout/MainLayout.tsx` ou `src/App.tsx` - Envolver com `EmpresaAtivaProvider`

**Estrutura do Context:**
```typescript
interface EmpresaAtivaContextType {
  empresaAtiva: EmpresaCadastro | null; // null = todas
  empresaAtivaId: string | null;
  setEmpresaAtiva: (empresa: EmpresaCadastro | null) => void;
  empresas: EmpresaCadastro[];
  isLoading: boolean;
}
```

**UI do Seletor:**
- Usa Popover do Radix com Command (cmdk) para busca
- Mostra razao social + CNPJ formatado
- Badge "Matriz"/"Filial" em cada item
- Largura fixa de ~300px no dropdown

**Persistencia:**
- Salva `empresaAtivaId` no `localStorage` com chave por tenant (`empresa_ativa_{tenantId}`)
- Ao carregar, busca o ID salvo e seleciona automaticamente
- Se a empresa salva nao existir mais, volta para "Todas"

### Beneficio Futuro
Com o contexto global de empresa ativa, qualquer modulo podera usar `useEmpresaAtiva()` para filtrar dados automaticamente pela empresa selecionada (colaboradores, documentos, acoes, etc.).
