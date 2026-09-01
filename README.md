# Baroli Admin

Base administrativa para os sistemas internos da **Baroli Imóveis**.

## Objetivo

Centralizar autenticação, usuários, permissionamento, auditoria, segurança e componentes administrativos reutilizáveis para futuros módulos da empresa.

## Stack proposta

- Firebase Authentication
- Cloud Firestore
- Firebase Hosting
- JavaScript modular (mesmo princípio do `daviopen/louvor-ide`)
- GitHub Actions para validação e deploy

## Núcleo administrativo

1. **Login seguro**
   - Google e e-mail/senha.
   - Somente usuários cadastrados e ativos acessam o sistema.
   - Sessão validada também nas regras do Firestore.

2. **Usuários**
   - Cadastro administrativo.
   - Ativar/desativar usuário.
   - Perfis: `USER`, `ADMIN`, `SUPER_ADMIN`.
   - Não excluir usuários fisicamente; preservar histórico.

3. **Permissões**
   - Documento por usuário e módulo.
   - Ações: `READ`, `CREATE`, `UPDATE`, `DELETE`.
   - `SUPER_ADMIN` possui acesso total.

4. **Auditoria**
   - Registro imutável de ações relevantes.
   - Guarda ator, ação, entidade, data/hora, antes/depois e justificativa quando aplicável.

5. **Design e arquitetura compartilháveis**
   - Features independentes.
   - Services e repositories separados.
   - Novos módulos de negócio utilizam o mesmo núcleo de autenticação, ACL e auditoria.

## Estrutura

```text
src/
  config/
  core/
  features/
    auth/
    users/
    permissions/
    audit/
    dashboard/
  services/
  repositories/
  routes/
  dtos/
  utils/
docs/
.github/workflows/
firestore.rules
firebase.json
ROADMAP.md
AGENTS.md
```

## Modelo de dados inicial

### `users/{uid}`

```json
{
  "uid": "firebase-uid",
  "name": "Nome",
  "email": "usuario@baroli.com.br",
  "role": "USER",
  "active": true,
  "createdAt": "timestamp",
  "createdBy": "uid",
  "updatedAt": "timestamp",
  "updatedBy": "uid",
  "lastAccessAt": "timestamp"
}
```

### `permissions/{uid}__{module}`

```json
{
  "userId": "firebase-uid",
  "module": "contracts",
  "actions": ["READ", "CREATE", "UPDATE"],
  "updatedAt": "timestamp",
  "updatedBy": "uid"
}
```

### `auditLogs/{id}`

```json
{
  "actorUserId": "uid",
  "actorUserEmail": "email",
  "actorUserName": "nome",
  "action": "USER_UPDATED",
  "entityType": "USER",
  "entityId": "uid",
  "createdAt": "server timestamp",
  "before": {},
  "after": {},
  "reason": null
}
```

## Princípios de segurança

- UI nunca é a fonte de autorização.
- Toda autorização crítica deve existir também em `firestore.rules`.
- Auditoria é append-only.
- Usuário desativado perde acesso imediatamente às coleções protegidas.
- `SUPER_ADMIN` deve ser usado por poucas contas.
- Nenhum segredo Firebase Admin deve ficar no frontend ou no GitHub.
- Operações administrativas sensíveis que exigirem Firebase Admin SDK devem ser implementadas em Cloud Functions/Cloud Run.

## Próximos passos

Consulte o [ROADMAP.md](ROADMAP.md).
