
## Tornar o botão "Gerar Manual" mais visível por função

Alterar o botão de ícone pequeno (ghost, icon-only) em cada card de função para um botão com texto visível "Gerar Manual".

### Mudança

No arquivo `src/components/aprendizado/FuncaoList.tsx`, substituir o `Button` com `variant="ghost" size="icon"` (linhas ~173-184) por um botão com texto:

```
De:  Botão ghost apenas com ícone 📄 (8x8px)
Para: Botão outline com ícone + texto "Gerar Manual"
```

### Detalhes técnicos

- Trocar `variant="ghost"` para `variant="outline"`
- Trocar `size="icon"` para `size="sm"`
- Adicionar texto "Gerar Manual" ao lado do ícone
- Manter o estado de loading com spinner quando estiver gerando
