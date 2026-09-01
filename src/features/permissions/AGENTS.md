# Permissions — AGENTS.md

Complementa o `/AGENTS.md` para autorização do sistema.

## Referência canônica

A implementação de Permissões do `daviopen/louvor-ide` é o ponto de partida obrigatório para este módulo.

Ao evoluir esta feature:
- usar o mesmo modelo `NONE` / `READ` / `EDIT`;
- persistir o nível diretamente no documento de permissão (`level`), sem criar uma matriz paralela de ações por usuário;
- manter seleção de usuário, perfil administrativo, permissões por módulo, revisão/diff e confirmação antes de salvar;
- adaptar somente o catálogo de módulos e nomenclaturas específicas da Baroli Imóveis;
- não criar solução alternativa quando o Louvor IDE já possuir comportamento equivalente.

## Objetivo
Controlar acesso por módulo e nível, separado do perfil administrativo, com menor privilégio e proteção também fora do frontend.

## Entidades e DTOs
- Níveis: `NONE`, `READ`, `EDIT`.
- `PermissionDTO`: `userId`, `module`, `level`, `updatedAt`, `updatedBy`.
- Perfis: `USER`, `ADMIN`, `SUPER_ADMIN`.
- Alterações administrativas devem possuir preview/diff antes da persistência.

## Regras e validações
- `EDIT` implica leitura e autoriza as operações de escrita previstas no módulo.
- `READ` permite consulta e bloqueia escrita.
- `NONE` bloqueia menu, rota e dados protegidos.
- Perfil administrativo e permissão por módulo são responsabilidades diferentes.
- `SUPER_ADMIN` é autorização sistêmica e não depende de e-mail hardcoded no frontend.
- Mudanças de perfil administrativo ocorrem neste fluxo e exigem `SUPER_ADMIN`.
- Proteger o último `SUPER_ADMIN` ativo.

## Permissões e rotas
- A tela de Permissões pode ser lida por quem possui acesso administrativo previsto.
- Somente `SUPER_ADMIN` altera perfil e matriz de permissões.
- Guard de rota é UX/defesa adicional e não substitui Rules/backend.

## Services / Repositories / Components
- Service resolve níveis efetivos e valida mudanças.
- Repository encapsula `permissions`.
- UI segue o Louvor IDE: seletor de usuário, cartão da pessoa, perfil administrativo, grade de módulos, botão `Revisar alterações`, dialog com diff e confirmação.

## Collections
- `permissions`
- `users`
- `auditLogs`

## Segurança e LGPD
- Firestore Rules devem bloquear leitura/escrita independentemente da UI.
- Operações de elevação de privilégio passam por backend confiável.
- Não confiar em valores de permissão fornecidos pelo cliente sem validação.

## Testes
- resolução de `NONE`/`READ`/`EDIT`;
- `EDIT` implica leitura e escrita;
- menu e rota respeitam nível;
- `READ` não escreve;
- payload não promove usuário indevidamente;
- mudanças administrativas geram auditoria;
- perfil e permissões são revisados antes do salvamento na UI.
