# Configuração Firebase — `baroli-admin`

O projeto Firebase já deve existir com o ID `baroli-admin`.

## 1. Registrar o Web App

No Firebase Console:

1. Configurações do projeto → Seus apps.
2. Adicionar app Web.
3. Nome sugerido: `baroli-admin-web`.
4. Copiar `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId` e `appId`.
5. Preencher essas informações em um arquivo `.env` local baseado em `.env.example`.

Nunca commitar o `.env`.

## 2. Authentication

Em Authentication → Sign-in method, habilitar:

- Google;
- E-mail/senha.

Domínios autorizados devem conter apenas os ambientes necessários.

## 3. Firestore

Criar o banco Cloud Firestore. Não utilizar regras de teste em produção. As regras oficiais deste repositório estão em `firestore.rules`.

## 4. Selecionar o projeto na CLI

```bash
firebase login
firebase use --add
```

Selecionar `baroli-admin` e usar o alias `default`.

Como alternativa para comandos pontuais:

```bash
firebase deploy --project baroli-admin
```

## 5. Primeiro SUPER_ADMIN

O sistema foi desenhado para não permitir que qualquer pessoa autenticada se torne administradora automaticamente.

Primeiro, faça a conta existir no Firebase Authentication (criando-a pelo Console ou fazendo o primeiro login Google depois de habilitar o provedor). Depois, em ambiente confiável com Application Default Credentials configuradas:

```bash
cd functions
npm install
BOOTSTRAP_ADMIN_EMAIL="seu-email@dominio.com" npm run bootstrap:super-admin
```

O script somente funciona enquanto **não existir nenhum `SUPER_ADMIN` ativo**. Depois disso, toda administração deve ocorrer pelo próprio sistema.

## 6. Build

Na raiz:

```bash
npm install
npm run check
```

O build gera `dist/config/runtime-config.js` usando as variáveis `FIREBASE_*` do ambiente.

## 7. Deploy inicial

```bash
npm run build
firebase deploy --project baroli-admin
```

Antes do primeiro deploy de Functions, confirme que o projeto possui os recursos/billing exigidos pelo Firebase para Cloud Functions.

## 8. Validação obrigatória

Após deploy:

- testar login Google;
- testar e-mail/senha;
- confirmar bloqueio de usuário sem perfil;
- confirmar bloqueio de usuário inativo;
- testar matriz de permissões;
- verificar `lastAccessAt`;
- verificar logs de LOGIN/LOGOUT e alterações administrativas;
- tentar acesso direto a uma coleção sem permissão e confirmar `permission-denied`.
