# Users — AGENTS.md

Complementa o `/AGENTS.md` para gestão de usuários.

## Referência canônica

A implementação de Usuários do `daviopen/louvor-ide` é o ponto de partida obrigatório para este módulo.

Ao evoluir esta feature:
- preservar o mesmo modelo de cadastro, edição, ativação/inativação, redefinição de senha, último acesso e integração de permissões;
- adaptar somente elementos que sejam específicos do domínio da Baroli Imóveis;
- não criar fluxo alternativo quando o Louvor IDE já possuir solução equivalente;
- comparar a implementação atual do Louvor IDE antes de mudanças estruturais neste módulo.

## Objetivo
Gerenciar perfis da aplicação, status ativo/inativo e metadados operacionais sem armazenar credenciais.

## Entidades e DTOs
- `User`: `id/uid`, `name`, `email`, `active`, `role`, `createdAt`, `updatedAt`, `lastAccessAt?`.
- `CreateUserDTO` e `UpdateUserDTO` devem aceitar somente campos editáveis explicitamente.

## Regras e validações
- E-mail deve ser válido e normalizado.
- E-mail de login não é alterado pela edição comum do usuário.
- Usuário com histórico deve ser inativado, não excluído fisicamente.
- Nunca armazenar ou exibir senha.
- Cadastro administrativo cria a identidade no Firebase Authentication e solicita redefinição/definição de senha pelo Firebase.
- Alterações administrativas relevantes geram Audit Log.
- Perfil administrativo não é gerenciado no formulário comum de Usuários; segue o fluxo de Permissões, como no Louvor IDE.

## Permissões e rotas
- Leitura: `READ` no módulo Usuários.
- Criação/edição/inativação exigem nível efetivo `EDIT` no módulo Usuários.
- `SUPER_ADMIN` pode definir permissões por módulo no formulário de usuário.
- Níveis de acesso: `NONE`, `READ`, `EDIT`.

## Services / Repositories / Components
- UI: lista, filtros, último acesso, status e ações.
- Formulário: nome, e-mail, status quando aplicável e permissões por funcionalidade para `SUPER_ADMIN`.
- Ações: editar, redefinir senha, inativar/reativar.
- Regra de negócio fica em Service; acesso a dados fica em Repository; Auth Admin fica em Cloud Function.

## Collections
- `users`
- `permissions`
- `auditLogs`

## Segurança e LGPD
- Minimizar campos pessoais.
- Impedir alteração de campos de autorização por payload arbitrário.
- Não permitir que edição comum de perfil eleve privilégios.
- Firestore Rules e Cloud Functions devem proteger operações administrativas.

## Testes
- criação/edição validam campos permitidos;
- inativação preserva registro;
- filtros são previsíveis;
- `READ` não altera terceiros;
- `EDIT` permite operações de gestão previstas;
- payload comum de usuário não promove perfil administrativo;
- permissões usam diretamente `NONE`/`READ`/`EDIT`.
