

# Plano: Gerar Video Institucional Seguramente (Motion Graphics)

## Objetivo
Criar um video MP4 de ~25-30 segundos com motion graphics usando Remotion, baseado no roteiro aprovado. O video cobre o gancho NR-01, os 3 pilares (Organização, Segurança Jurídica, Inteligência de Dados) e o fechamento com CTA.

## Direção Criativa
- **Paleta:** Lilás `#6B3FA0`, Laranja `#F07B2C`, Escuro `#2A2040`, Claro `#F5F3FA`
- **Fontes:** Inter (já usada no projeto) + Poppins (display/títulos)
- **Estilo:** Tech Product — clean, profissional, transições suaves, dark background com acentos de cor
- **Motifs:** Formas geométricas flutuantes, linhas de conexão, ícones de escudo/proteção

## Estrutura do Video (30fps, ~25s = 750 frames)

| Cena | Duração | Conteúdo |
|------|---------|----------|
| 1 - Hook | ~4s | "NR-01 exige gestão de riscos psicossociais. Sua empresa está preparada?" |
| 2 - Pilar 1 | ~5s | Organização & Eficiência (campanhas, questionários, dashboards) |
| 3 - Pilar 2 | ~5s | Segurança Jurídica (ponto, EPI, onboarding como evidência) |
| 4 - Pilar 3 | ~5s | Inteligência de Dados (cruzamento percepção x dados reais) |
| 5 - CTA | ~4s | Logo Seguramente + "Conheça o sistema" |

## Etapas Técnicas

1. **Setup Remotion** — Criar diretório `remotion/`, instalar dependências, configurar compositor musl, symlink ffmpeg
2. **Criar componentes** — Background persistente, 5 cenas individuais, componentes reutilizáveis (TextReveal, IconBadge)
3. **Montar composição** — TransitionSeries com wipe/fade entre cenas
4. **Copiar logo** — Usar `logo-seguramente.png` do projeto como asset
5. **Renderizar** — Script programático para gerar MP4 em `/mnt/documents/`
6. **QA** — Spot-check frames chave antes de entregar

## Limitações
- Video mudo (sandbox não suporta encoding de áudio) — narração deve ser adicionada separadamente
- Máximo ~30 segundos pelo timeout de renderização

