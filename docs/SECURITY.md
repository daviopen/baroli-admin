# Segurança

## Autenticação
- Firebase Auth com Google e e-mail/senha.
- Não liberar acesso automaticamente para qualquer conta autenticada.
- Exigir documento de usuário ativo no Firestore.

## Autorização
- RBAC para macro perfil.
- ACL por módulo/ação para granularidade.
- Regras do Firestore são obrigatórias e independentes da UI.

## Auditoria
- Append-only.
- Timestamp gerado no servidor.
- before/after para mutações críticas.
- Registros de autenticação sensíveis devem, preferencialmente, ser emitidos por backend confiável.

## LGPD
- Coletar apenas dados necessários.
- Definir política de retenção.
- Restringir exportações.
- Registrar acesso e alteração de dados pessoais relevantes.
