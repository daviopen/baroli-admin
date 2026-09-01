# Baroli Admin

Base administrativa para os sistemas internos da **Baroli Imóveis**.

- Site institucional: https://baroliimoveis.com.br
- Projeto Firebase: `baroli-admin`
- Repositório de referência arquitetural: `daviopen/louvor-ide`

## Objetivo

Centralizar autenticação, usuários, permissionamento, auditoria, segurança e componentes administrativos reutilizáveis para futuros módulos da empresa.

## Stack

- Firebase Authentication
- Cloud Firestore
- Cloud Functions for Firebase
- Firebase Hosting
- JavaScript modular
- GitHub Actions

## Núcleo administrativo

1. **Login seguro**
   - Google e e-mail/senha.
   - Recuperação de senha.
   - Somente usuários cadastrados e ativos acessam o sistema.
   - Sessão validada também nas regras do Firestore.

2. **Usuários**
   - Cadastro administrativo via backend privilegiado.
   - Ativar/desativar usuário.
   - Perfis: `USER`, `ADMIN`, `SUPER_ADMIN`.
   - Proteção contra remoção do último `SUPER_ADMIN` ativo.
   - Não excluir usuários fisicamente; preservar histórico.

3. **Permissões**
   - Documento por usuário e módulo.
   - Ações: `READ`, `CREATE`, `UPDATE`, `DELETE`.
   - `SUPER_ADMIN` possui acesso total.
   - Matriz de permissões administrada pelo sistema.

4. **Auditoria**
   - Registro append-only de ações relevantes.
   - Guarda ator, ação, entidade, data/hora, antes/depois e justificativa quando aplicável.
   - Login, logout, criação/alteração de usuários e permissionamento registrados pelo backend.

5. **Design e arquitetura compartilháveis**
   - Features independentes.
   - Services e repositories separados.
   - Novos módulos de negócio utilizam o mesmo núcleo de autenticação, ACL e auditoria.
   - Identidade visual orientada pelo site oficial da Baroli, sem sacrificar acessibilidade e produtividade do sistema interno.

## Estrutura

```text
src/
  config/
  constants/
  core/
  features/
    auth/
    users/
    permissions/
    audit/
    dashboard/
  services/
  repositories/
  styles/
functions/
  scripts/
scripts/
tests/
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
  "email": "usuario@dominio.com",
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
  "module": "leases",
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
- Toda autorização crítica existe também em `firestore.rules` ou no backend privilegiado.
- Firestore usa fallback `deny-by-default`.
- Auditoria não pode ser criada, alterada ou apagada diretamente pelo cliente.
- Usuário desativado perde acesso às coleções protegidas.
- `SUPER_ADMIN` deve ser usado por poucas contas.
- Nenhum segredo Firebase Admin deve ficar no frontend ou no GitHub.
- Criação de contas, alterações sensíveis e auditoria administrativa usam Cloud Functions/Admin SDK.

## Configuração

1. Copie `.env.example` para `.env` e complete a configuração do Web App Firebase.
2. Leia [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md).
3. Execute `npm install` e `npm run check`.
4. Configure o primeiro `SUPER_ADMIN` pelo bootstrap controlado descrito na documentação.

## Documentação

- [Arquitetura](docs/ARCHITECTURE.md)
- [Segurança](docs/SECURITY.md)
- [Identidade Baroli](docs/BRAND.md)
- [Configuração Firebase](docs/FIREBASE_SETUP.md)
- [Roadmap](ROADMAP.md)
- [Regras de desenvolvimento](AGENTS.md)
