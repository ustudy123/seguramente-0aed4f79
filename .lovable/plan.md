## Diagnóstico

O usuário `tecnico.capanema@sudomed.com.br` (Cassiano Henrique) está cadastrado como `tipo_usuario = 'gestor'` no `usuarios_base`. Verifiquei no banco:

- **22 empresas ativas** existem no tenant `299779a8-1cd2-4ffe-9462-78181426cd1a` (todas aparecem em Estrutura Organizacional → Empresa).
- **Apenas 5 vínculos** existem na tabela `usuario_vinculos` para esse usuário (BARROS & NUERNBERG, NUERNBERG & BARROS, SUDOCLIN, 2x Rline Telecom).

A lógica de `src/hooks/useUsuarioVinculos.ts` define como "acesso global" (sem filtro por vínculo) apenas: `proprietario`, `owner`, `admin`, `administrador`. Como `gestor` **não** está nessa lista, o seletor do topo trata o usuário como "restrito" e mostra somente as 5 empresas vinculadas.

**Os dados estão íntegros** — nenhuma empresa foi perdida. O problema é apenas de visibilidade no seletor superior.

## Correção (1 linha)

Adicionar `"gestor"` à constante `TIPOS_ACESSO_GLOBAL` em `src/hooks/useUsuarioVinculos.ts`. Gestores são perfis administrativos do tenant e devem enxergar todas as empresas do tenant no seletor (mesmo comportamento de Owner/Admin).

```ts
const TIPOS_ACESSO_GLOBAL = [
  "proprietario",
  "owner",
  "admin",
  "administrador",
  "gestor",   // <-- adicionar
] as const;
```

## Impacto

- Cassiano e qualquer outro `gestor` do tenant passará a ver as 22 empresas no seletor do topo.
- Tipos restritivos (`clinica_parceira`, `consultor_externo`, `prestador_terceiro`, `auditor`, `suporte_autorizado`) continuam filtrados por vínculo — sem alteração de segurança para perfis externos.
- Nenhuma migration de banco necessária. Nenhum dado é alterado.

## Validação após implementar

Pedir ao usuário recarregar a página e abrir o seletor de empresas no topo — deve listar todas as 22 empresas ativas do tenant SudoMed.