# Identidade visual — Baroli Admin

Referência oficial: https://baroliimoveis.com.br

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

### Regras

1. Usar logo oficial quando o arquivo institucional estiver disponível no repositório.
2. Não redesenhar o logo manualmente.
3. Manter contraste WCAG AA em textos e controles.
4. Usar tokens semânticos para cores; nunca espalhar HEXs pelos componentes.
5. Estados de sucesso, alerta e erro devem ser distinguíveis sem depender apenas de cor.
6. Desktop e mobile devem compartilhar a mesma hierarquia de informação.
7. Formulários administrativos devem ser objetivos, com confirmação para operações sensíveis.

## Tokens

A paleta final deve ser extraída dos arquivos oficiais da marca. Até o asset oficial ser incorporado, todos os componentes devem consumir apenas os tokens de `src/styles/tokens.css`, permitindo troca global sem retrabalho.
