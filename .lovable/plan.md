

# Plano: Tornar Layout Responsivo para Mobile

## Problema
No mobile (390px), a sidebar fixa ocupa espaço permanente e o conteudo principal fica cortado. O `MainLayout` aplica `marginLeft` fixo via framer-motion sem considerar breakpoint mobile.

## Solucao

### 1. MainLayout.tsx — Detectar mobile e ocultar sidebar
- Usar o hook `useIsMobile()` existente
- No mobile: sidebar começa oculta, `marginLeft: 0`, padding reduzido (`p-3`)
- Adicionar overlay escuro quando sidebar aberta no mobile
- Sidebar no mobile: abre como drawer (position fixed, full height, overlay por tras)
- Botao hamburger no Header para abrir/fechar sidebar no mobile

### 2. Header.tsx — Adicionar botao hamburger no mobile
- Receber prop `onMenuToggle` e `isMobile`
- Renderizar icone `Menu` (lucide) apenas em mobile, no lado esquerdo
- Ajustar padding para mobile

### 3. AppSidebar.tsx — Comportamento mobile
- Receber prop `isMobile` e `onClose`
- No mobile: renderizar sempre expandida (nao collapsed), com overlay
- Ao clicar em link: fechar sidebar automaticamente (chamar `onClose`)
- Ao clicar no overlay: fechar sidebar

### 4. Ajuste de padding no main content
- `p-6` no desktop, `p-3` no mobile

## Arquivos modificados
- `src/components/layout/MainLayout.tsx`
- `src/components/layout/Header.tsx`
- `src/components/layout/AppSidebar.tsx`

