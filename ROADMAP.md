# ROADMAP — Baroli Admin

## P0 — Fundação
- [x] Definir estrutura compartilhável do projeto
- [x] Definir modelo inicial de usuários
- [x] Definir RBAC/ACL por módulo e ação
- [x] Definir auditoria imutável
- [x] Criar regras iniciais do Firestore
- [x] Criar projeto Firebase `baroli-admin`
- [ ] Configurar ambientes DEV e PRD
- [ ] Configurar Authentication: Google + e-mail/senha
- [ ] Configurar Hosting e Firestore

## P1 — Autenticação
- [ ] Tela de login
- [ ] Login Google
- [ ] Login e-mail/senha
- [ ] Logout
- [ ] Recuperação de senha
- [ ] Bloqueio de usuário não cadastrado
- [ ] Bloqueio de usuário inativo
- [ ] Registro seguro de `lastAccessAt`
- [ ] Testes de sessão e expiração

## P2 — Usuários
- [ ] Listagem com filtros e paginação
- [ ] Cadastro de usuário
- [ ] Consulta
- [ ] Edição
- [ ] Ativar/desativar
- [ ] Perfil USER / ADMIN / SUPER_ADMIN
- [ ] Proteção contra auto-rebaixamento do último SUPER_ADMIN
- [ ] Auditoria das alterações

## P3 — Permissões
- [ ] Catálogo central de módulos
- [ ] CRUD de permissões por usuário
- [ ] READ / CREATE / UPDATE / DELETE
- [ ] Matriz visual de permissões
- [ ] Cache seguro no cliente
- [ ] Validação nas regras do Firestore
- [ ] Auditoria das alterações

## P4 — Auditoria
- [ ] Tela de auditoria
- [ ] Filtros por usuário, módulo, ação e período
- [ ] Visualização before/after
- [ ] Registro de login/logout
- [ ] Registro de alterações administrativas
- [ ] Exportação CSV/PDF
- [ ] Política de retenção

## P5 — Shell administrativo
- [ ] Dashboard inicial
- [ ] Menu lateral responsivo
- [ ] Design system Baroli
- [ ] Tema claro/escuro
- [ ] Estados loading/empty/error padronizados
- [ ] Toasts e confirmações
- [ ] Preservação de filtros/paginação ao voltar

## P6 — Qualidade e DevOps
- [ ] ESLint/format
- [ ] Testes unitários
- [ ] Testes das Firestore Rules com Emulator Suite
- [ ] E2E Playwright
- [ ] GitHub Actions PR checks
- [ ] Deploy DEV automático
- [ ] Deploy PRD com aprovação
- [ ] Monitoramento de erros

## P7 — Primeiros módulos de negócio
- [ ] Cadastros gerais
- [ ] Proprietários
- [ ] Inquilinos
- [ ] Imóveis
- [ ] Contratos/locações
- [ ] Vistorias
- [ ] Manutenções/ocorrências
- [ ] Financeiro administrativo
- [ ] Documentos e histórico

> Os módulos de negócio devem consumir o mesmo núcleo de autenticação, permissionamento, auditoria e componentes, sem duplicar infraestrutura.
