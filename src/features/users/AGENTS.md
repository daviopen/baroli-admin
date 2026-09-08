# Users — AGENTS.md

Complementa o `/AGENTS.md` para gestão de usuários.

## Referência canônica

A implementação de Usuários do `daviopen/louvor-ide` é a referência obrigatória para este módulo.

Ao evoluir esta feature:
- preservar o mesmo modelo de cadastro, edição, ativação/inativação, redefinição de senha, último acesso e integração de permissões;
- adaptar somente elementos específicos do domínio da Baroli Imóveis;
- não criar fluxo alternativo quando o Louvor IDE já possuir solução equivalente;
- comparar a implementação atual do Louvor IDE antes de mudanças estruturais neste módulo.

## Provisionamento sem Cloud Functions

Por decisão arquitetural deste projeto, o módulo de usuários **não usa Cloud Functions**.

O cadastro administrativo segue o mesmo mecanismo do Louvor IDE:
1. o administrador permanece autenticado no app principal;
2. uma instância secundária temporária do Firebase App/Auth é criada no navegador;
3. a nova identidade é provisionada com `createUserWithEmailAndPassword` nessa instância secundária;
4. o perfil, preset de acesso e auditoria são persistidos pelo app principal no Firestore, protegidos pelas Security Rules;
5. o Firebase envia o fluxo de definição/redefinição de senha;
6. a instância secundária é encerrada e removida.

Nunca armazenar senha, senha temporária, token ou credencial no Firestore/localStorage. Se a persistência do perfil falhar após a criação da identidade, tentar excluir a identidade recém-criada como rollback, igual ao Louvor IDE.

## Objetivo
Gerenciar perfis da aplicação, status ativo/inativo e metadados operacionais sem armazenar credenciais.

## Entidades e DTOs
- `User`: `id/uid`, `name`, `email`, `active`, `role`, `profileType`, `createdAt`, `updatedAt`, `lastAccessAt?`.
- `CreateUserDTO` e `UpdateUserDTO` devem aceitar somente campos editáveis explicitamente.

## Regras e validações
- E-mail deve ser válido e normalizado.
- E-mail de login não é alterado pela edição comum do usuário.
- Usuário com histórico deve ser inativado, não excluído fisicamente.
- Nunca armazenar ou exibir senha.
- Cadastro administrativo cria a identidade no Firebase Authentication e solicita redefinição/definição de senha pelo Firebase.
- Alterações administrativas relevantes geram Audit Log.
- O perfil de acesso determina automaticamente o preset de permissões; a UI não oferece personalização módulo a módulo.

## Perfis
- `ADM_SUPER`
- `CORRETOR`
- `ADMINISTRATIVO`
- `GESTAO`

Somente `ADM_SUPER` corresponde a `SUPER_ADMIN`. Os demais permanecem com role técnica `USER` e recebem acesso pelo preset do perfil.

## Services / Repositories / Components
- UI: lista, filtros, último acesso, status e ações.
- Formulário: nome, e-mail, status quando aplicável e perfil de acesso.
- Ações: editar, redefinir senha, inativar/reativar.
- Regra de negócio fica em Service; acesso ao Firestore fica em Repository.
- Firebase Auth secundário é usado apenas para provisionar a nova identidade sem substituir a sessão do administrador.

## Collections
- `users`
- `permissions`
- `auditLogs`

## Segurança e LGPD
- Minimizar campos pessoais.
- Firestore Rules devem validar criação/edição administrativa e impedir elevação por payload arbitrário.
- Escritas em `permissions` são restritas a `SUPER_ADMIN`.
- Auditoria é append-only para o cliente.
- Usuário não pode promover ou inativar a própria conta administrativa pelo fluxo comum.

## Testes
- criação/edição validam campos permitidos;
- provisionamento usa app Auth secundário e preserva a sessão principal;
- falha de persistência tenta rollback da identidade criada;
- inativação preserva registro;
- filtros são previsíveis;
- presets de perfil são aplicados automaticamente;
- payload comum não promove perfil administrativo;
- não existe dependência de Cloud Functions no fluxo de usuários.
