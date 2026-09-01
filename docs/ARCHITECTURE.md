# Arquitetura

## Visão

O projeto separa **plataforma administrativa** de **módulos de negócio**.

### Plataforma
- Auth
- Users
- Permissions
- Audit
- Navigation
- Design System
- Error handling

### Módulos de negócio
Entram como features independentes e declaram suas permissões no catálogo central.

## Fluxo de autorização

1. Firebase Authentication autentica a identidade.
2. `users/{uid}` define estado e papel.
3. `permissions/{uid}__{module}` define ações permitidas.
4. Frontend usa essas informações apenas para UX.
5. Firestore Rules repete a autorização como barreira efetiva de segurança.
6. Mutações registram `auditLogs`.

## Evolução recomendada

Quando houver operações privilegiadas (criar usuário Auth, custom claims, integrações externas, processamento de documentos), adicionar backend Firebase Functions/Cloud Run e manter o frontend sem credenciais privilegiadas.
