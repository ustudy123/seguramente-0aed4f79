# PWA "Meu Ponto" abrindo na tela de login — correção

## Problema

Quando o usuário instala o PWA pelo link `/ponto-externo/:token` e depois abre o ícone "Meu Ponto" na tela inicial, o app abre na tela de Login (`seguramente.lovable.app`) em vez de já cair direto na tela de Registro de Ponto daquele colaborador.

## Causa

O `public/ponto-manifest.webmanifest` está com:

```
"scope":     "/ponto-externo/"
"start_url": "/ponto-externo/"
```

A rota real do app é `/ponto-externo/:token` — ou seja, `/ponto-externo/` (sem token) não corresponde a nenhuma rota válida e cai no fallback do SPA (NotFound / redirecionamento para a home, que exige login).

Como `start_url` e `scope` ficam **congelados no momento da instalação** (iOS e Android), não basta editar o manifest estático: cada usuário precisa instalar um PWA cujo `start_url` já contenha o **token dele**.

## Solução

Gerar o manifest **dinamicamente em runtime**, dentro do `PontoPWASetup`, com `start_url` e `scope` apontando para a URL completa do colaborador, ou seja:

```
scope:     /ponto-externo/<token>
start_url: /ponto-externo/<token>
```

O manifest é criado como um `Blob` em memória e injetado via `<link rel="manifest" href="blob:...">` apenas na página `/ponto-externo/:token`. Assim:

- Quem instala já fixa o token no atalho — abrir o ícone vai direto para a tela de ponto do colaborador (terceira screenshot enviada).
- Não há prompt de login, porque `/ponto-externo/:token` é rota pública e não passa pelo guard de autenticação.
- Continua sendo um PWA por colaborador (cada link gera seu próprio atalho), o que é o comportamento desejado.

Como reforço, o Service Worker (`public/ponto-sw.js`) precisa ter o `scope` ampliado para `/ponto-externo/` (mantém como está) — o `scope` do SW pode ser mais amplo que o `start_url` do manifest sem problema.

## Arquivos a alterar

- `src/components/ponto/PontoPWASetup.tsx`
  - Receber o `token` como prop (vindo de `PontoExterno.tsx`).
  - Construir o objeto manifest em JS com `start_url` e `scope` = `/ponto-externo/${token}`, `name` = "Meu Ponto", ícones e cores atuais.
  - `URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" }))` e injetar como `<link rel="manifest">`.
  - Limpar o blob no `cleanup`.
- `src/pages/PontoExterno.tsx`
  - Passar `token` para `<PontoPWASetup token={token} />` (somente quando o token estiver carregado e válido).

## Não alterar

- `public/ponto-manifest.webmanifest` deixa de ser usado pela página, mas pode permanecer no projeto (sem impacto).
- `public/ponto-sw.js` permanece como está (escopo `/ponto-externo/`).
- Usuários que já instalaram a versão antiga precisarão **remover o atalho atual e reinstalar** a partir do link com token — não há como atualizar `start_url` de um PWA já instalado (limitação do iOS/Android).

## Observações para o usuário

- Cada colaborador tem seu próprio atalho "Meu Ponto" baseado no token dele.
- Se trocarem o token (ex.: link regenerado), o atalho antigo continuará apontando para o token antigo até reinstalarem.
