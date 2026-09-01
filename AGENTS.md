# AGENTS.md — Baroli Admin

## Objetivo

Este repositório é a base administrativa compartilhada dos sistemas da Baroli Imóveis. Alterações devem preservar segurança, auditabilidade, performance e reutilização.

## Regras obrigatórias

1. Nenhuma permissão pode existir somente no frontend.
2. Toda coleção nova deve declarar regras explícitas no Firestore; o fallback permanece `deny all`.
3. Toda mutação relevante deve produzir evento de auditoria.
4. Auditoria nunca pode ser editada ou excluída pelo cliente.
5. Usuário desativado não pode acessar dados protegidos.
6. Evitar hardcode de módulos e permissões em múltiplos lugares; usar catálogo central.
7. Dados de autenticação e autorização devem ser carregados uma vez por sessão e invalidados quando alterados.
8. Não expor service accounts, Admin SDK credentials ou segredos em código cliente.
9. Operações que criam/removem contas Firebase Auth devem ocorrer em backend confiável.
10. Antes de concluir uma feature: lint, testes, regras e E2E relevantes devem passar.

## Estrutura de feature

Cada feature deve concentrar UI/controller específicos e depender de interfaces compartilhadas:

```text
features/<feature>/
  index.js
  controller.js
  view.js
  validators.js
```

Persistência fica em `repositories/`; regras de negócio reutilizáveis em `services/`; contratos de dados em `dtos/`.

## Permissionamento

Padrão: `<module>` + conjunto de ações:

- READ
- CREATE
- UPDATE
- DELETE

`SUPER_ADMIN` ignora a matriz; demais perfis dependem de permissões explícitas.

## Auditoria

Formato mínimo:

- actorUserId
- actorUserName/email quando disponível
- action em UPPER_SNAKE_CASE
- entityType
- entityId
- createdAt com server timestamp
- before/after quando houver alteração
- reason quando a operação exigir justificativa

## Definição de pronto

- [ ] Implementação modular
- [ ] Segurança no Firestore/backend
- [ ] Auditoria
- [ ] Tratamento de loading/error/empty
- [ ] Responsivo desktop/mobile
- [ ] Testes
- [ ] Documentação/ROADMAP atualizado
