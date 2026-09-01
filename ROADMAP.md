# ROADMAP — Baroli Admin

## P0 — Fundação
- [x] Definir estrutura compartilhável do projeto
- [x] Definir modelo inicial de usuários
- [x] Definir RBAC/ACL por módulo e ação
- [x] Definir auditoria imutável
- [x] Criar regras iniciais do Firestore
- [x] Criar projeto Firebase `baroli-admin`
- [x] Documentar identidade com referência oficial `baroliimoveis.com.br`
- [ ] Configurar ambientes DEV e PRD
- [ ] Habilitar Authentication no Console: Google + e-mail/senha
- [ ] Criar/configurar Hosting, Firestore e Functions no projeto Firebase
- [ ] Registrar Web App e preencher configuração de runtime

## P1 — Autenticação
- [x] Tela de login
- [x] Login Google
- [x] Login Google responsivo no padrão `louvor-ide` (popup desktop, redirect mobile e fallback)
- [x] Login e-mail/senha
- [x] Logout
- [x] Recuperação de senha
- [x] Bloqueio de usuário não cadastrado
- [x] Bloqueio de usuário inativo
- [x] Registro seguro de `lastAccessAt` via backend
- [x] Auditoria backend de login/logout
- [ ] Testes de sessão, refresh token e expiração

## P2 — Usuários
- [ ] Listagem com filtros e paginação
- [x] Cadastro de usuário via Cloud Function/Admin SDK
- [ ] Tela de consulta detalhada
- [ ] Edição completa de nome/perfil pela UI
- [x] Ativar/desativar
- [x] Perfil USER / ADMIN / SUPER_ADMIN no modelo/backend
- [x] Bootstrap controlado do primeiro SUPER_ADMIN
- [x] Proteção contra remover/desativar o último SUPER_ADMIN
- [x] Auditoria das alterações

## P3 — Permissões
- [x] Catálogo central de módulos
- [x] Leitura/gravação de permissões por usuário
- [x] READ / CREATE / UPDATE / DELETE
- [x] Matriz visual de permissões
- [x] Carregamento das permissões uma vez por sessão
- [x] Validação nas regras do Firestore
- [x] Gravação privilegiada via backend
- [x] Auditoria das alterações

## P4 — Auditoria
- [x] Tela inicial de auditoria
- [ ] Filtros por usuário, módulo, ação e período
- [ ] Visualização before/after
- [x] Registro de login/logout
- [x] Registro de alterações administrativas
- [ ] Exportação CSV/PDF
- [ ] Política de retenção

## P5 — Shell administrativo
- [x] Dashboard inicial
- [x] Menu lateral responsivo
- [x] Tokens/design system inicial da Baroli
- [x] Suporte automático a tema claro/escuro do sistema operacional
- [ ] Alternância manual de tema
- [x] Estados loading/error básicos
- [ ] Empty states padronizados em todas as telas
- [ ] Toasts e modais de confirmação substituindo alerts/prompts provisórios
- [ ] Preservação de filtros/paginação ao voltar
- [ ] Incorporar arquivo oficial do logo/paleta institucional

## P6 — Qualidade e DevOps
- [ ] ESLint/format
- [x] Testes unitários iniciais de autorização
- [x] Testes do fluxo Google híbrido desktop/mobile
- [ ] Testes das Firestore Rules com Emulator Suite
- [ ] Testes unitários de Cloud Functions
- [ ] E2E Playwright
- [x] GitHub Actions PR/push checks
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
