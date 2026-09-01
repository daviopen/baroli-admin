# Identidade visual — Baroli Admin

Referência oficial: https://baroliimoveis.com.br

Logo oficial adotado no produto:

`https://widesysw2689.s3.amazonaws.com/images/logo-1x1.jpg`

## Princípios da marca

O sistema administrativo deve refletir os atributos comunicados institucionalmente pela Baroli:

- confiança;
- segurança;
- resultado;
- relacionamento humano;
- inovação;
- tecnologia;
- transparência e profissionalismo.

O símbolo institucional é descrito pela própria empresa como dois pilares que formam uma seta apontando na mesma direção. Esse conceito deve orientar ícones, estados de progresso e elementos de navegação sem recriar ou distorcer a marca.

## Direção para o produto interno

O `baroli-admin` não deve copiar literalmente o site público de imóveis. O site é referência de identidade; o painel administrativo deve priorizar densidade de informação, legibilidade, velocidade e acessibilidade.

A identidade do painel parte da combinação visual da marca — vermelho como cor de assinatura e ação, grafite como base institucional e neutros claros para superfícies — sem transformar todas as áreas do sistema em blocos da cor principal.

## Paleta do Design System

### Marca e ações

| Token | Light | Dark | Uso |
| --- | --- | --- | --- |
| `--brand` | `#B01F2E` | `#F06B74` | links, destaque editorial, item selecionado |
| `--brand-strong` | `#861824` | `#FF8B92` | ênfase e texto de marca |
| `--brand-soft` | `#FCEBED` | `#3B1C20` | seleção, fundos sutis e realces |
| `--brand-action` | `#B01F2E` | `#B01F2E` | botão primário |
| `--brand-action-hover` | `#861824` | `#C93443` | hover/pressed de ação primária |
| `--on-brand` | `#FFFFFF` | `#FFFFFF` | conteúdo sobre ação primária |

### Neutros

| Token | Light | Dark | Uso |
| --- | --- | --- | --- |
| `--bg` | `#F7F7F5` | `#111312` | fundo global |
| `--surface` | `#FFFFFF` | `#181B19` | cards, formulários, sidebar |
| `--surface-2` | `#F0F1EF` | `#222623` | controles secundários |
| `--surface-3` | `#E8EAE7` | `#2B302D` | hover e níveis adicionais |
| `--text` | `#1B1D1C` | `#F4F5F4` | texto principal |
| `--muted` | `#626764` | `#B2B8B4` | texto secundário |
| `--border` | `#D9DDDA` | `#343A36` | divisores e contornos |

### Estados semânticos

Verde fica reservado para **sucesso**, âmbar para **alerta** e vermelho semântico para **erro/perigo**. A cor da marca não deve ser usada para comunicar sucesso.

- `--success` / `--success-soft`
- `--warning` / `--warning-soft`
- `--danger` / `--danger-soft`
- `--focus`

## Contraste e acessibilidade

A paleta foi ajustada para preservar WCAG AA nos principais pares de uso:

- texto principal `#1B1D1C` sobre branco: aproximadamente `16.9:1`;
- texto secundário `#626764` sobre branco: aproximadamente `5.8:1`;
- branco sobre ação primária `#B01F2E`: aproximadamente `6.8:1`;
- marca `#F06B74` sobre superfície escura `#181B19`: aproximadamente `5.8:1`.

Estados interativos também devem usar forma, borda, peso ou ícone além da cor.

## Logo

1. Usar somente o logo oficial, sem redesenhar o símbolo.
2. Preservar proporção `1:1` do asset fornecido.
3. Não aplicar filtros, recoloração ou distorções.
4. O logo deve aparecer no login e na identificação principal do menu lateral.
5. O asset oficial atual é consumido pela URL canônica acima; quando houver uma cópia institucional versionada, ela deve ser incorporada em `src/assets/` para eliminar dependência externa sem alterar a apresentação.

## Regras do Design System

1. Componentes consomem tokens semânticos de `src/styles/tokens.css`; não criar paletas paralelas por feature.
2. Não espalhar HEXs de interface nos componentes.
3. Manter contraste WCAG AA em textos e controles.
4. Estados de sucesso, alerta e erro devem ser distinguíveis sem depender apenas de cor.
5. Desktop e mobile compartilham a mesma hierarquia de informação.
6. Formulários administrativos devem ser objetivos, com confirmação para operações sensíveis.
7. Hover, focus, active e disabled devem ser tratados como estados do componente, não como exceções locais.
8. Vermelho de marca deve ser usado com parcimônia: ação principal, seleção e destaque, não como fundo dominante de páginas.
