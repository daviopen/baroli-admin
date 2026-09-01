# AGENTS.md — Baroli Admin

Este arquivo define as regras obrigatórias de engenharia, arquitetura, segurança, UX, acessibilidade, auditabilidade e qualidade para qualquer alteração no repositório `baroli-admin`.

O objetivo é permitir a evolução incremental da plataforma administrativa da Baroli Imóveis sem concentrar regras de negócio na interface, sem criar acessos inseguros ao Firebase, sem duplicar infraestrutura entre módulos, sem regressões de desktop/mobile e sem reintroduzir falhas já identificadas em produção ou QA.

## 1. Propósito do produto

O Baroli Admin é a base administrativa compartilhada dos sistemas internos da Baroli Imóveis. O núcleo atual centraliza autenticação, usuários, permissionamento, auditoria e dashboard, e deve servir de fundação para módulos como proprietários, inquilinos, imóveis, contratos/locações, vistorias, manutenções, financeiro e documentos.

Princípios obrigatórios:

- UX deve funcionar bem em desktop, tablet e mobile.
- Acessibilidade e contraste não são opcionais.
- Firebase Authentication é a fonte canônica de identidade.
- Autorização não pode existir somente no frontend.
- A matriz de permissões exibida na UI deve ser coerente com Firestore Security Rules e Cloud Functions.
- Papel administrativo (`USER`, `ADMIN`, `SUPER_ADMIN`) e permissão por módulo são conceitos relacionados, mas não intercambiáveis.
- Senhas, tokens, cookies, service accounts e secrets nunca devem ser persistidos ou versionados indevidamente.
- Regras de negócio não devem ficar espalhadas em views/controllers.
- Dados pessoais, contratuais e financeiros devem seguir minimização, necessidade, finalidade e rastreabilidade compatíveis com LGPD.
- Auditoria é parte funcional do produto, não detalhe técnico.
- Erro silencioso de console, overflow acidental e quebra em breakpoint intermediário são bugs.
- Novos módulos devem reutilizar o núcleo compartilhado de autenticação, ACL, auditoria e Design System.

## 2. Stack atual

- HTML5.
- CSS3.
- JavaScript modular/ES Modules.
- Firebase Authentication.
- Cloud Firestore.
- Cloud Functions for Firebase / Admin SDK para operações privilegiadas.
- Firebase Hosting.
- Firebase CLI.
- Node.js >= 22.
- Testes automatizados com `node --test`.
- GitHub Actions.
- Playwright previsto para E2E conforme `ROADMAP.md` e obrigatório quando a cobertura E2E do fluxo existir.

Não introduzir framework, bundler ou migração ampla de tecnologia sem decisão arquitetural explícita e impacto documentado.

## 3. Arquitetura

Fluxo preferencial no cliente:

`View/Page -> Feature Controller -> Service/Use Case -> Repository -> Firebase/Data Source`

Para operações privilegiadas:

`View/Page -> Service -> Cloud Function -> Admin SDK / Firestore / Firebase Auth`

Responsabilidades:

- **Views/Pages**: renderização, interação, acessibilidade e estado estritamente visual.
- **Feature Controllers**: composição da funcionalidade e coordenação da view com services.
- **Services**: regras de negócio, casos de uso, coordenação e validações de domínio.
- **Repositories**: acesso e persistência de dados não privilegiados.
- **Cloud Functions**: operações privilegiadas, mutações sensíveis, Auth Admin e auditoria confiável.
- **DTOs/contratos**: fronteiras entre camadas e dados externos; usar JSDoc quando o contrato for relevante.
- **Core**: autenticação, autorização, sessão, erros e infraestrutura compartilhada.
- **Constants**: catálogo central de módulos, ações, roles, estados e demais enumerações estáveis.
- **Styles**: tokens, temas e componentes visuais reutilizáveis.

É proibido criar novo acesso direto ao Firestore dentro de view/controller quando houver ou puder existir Repository apropriado.

É proibido executar no browser operações que exijam Admin SDK, criação/remoção de contas, elevação de privilégio ou escrita probatória de auditoria.

## 4. Estrutura de diretórios

Estrutura atual preferencial:

```text
src/
├── config/
├── constants/
├── core/
├── features/
│   ├── auth/
│   ├── users/
│   ├── permissions/
│   ├── audit/
│   └── dashboard/
├── repositories/
├── services/
├── styles/
├── index.html
└── main.js

functions/
scripts/
tests/
docs/
.github/workflows/
```

Novas features devem seguir, quando aplicável:

```text
src/features/<feature>/
├── index.js
├── controller.js
├── view.js
└── validators.js
```

Persistência fica em `repositories/`; regra de negócio reutilizável fica em `services/`; contratos relevantes usam DTO/JSDoc; operações privilegiadas ficam em `functions/`.

## 5. Views, pages e controllers

Views/controllers devem:

- possuir responsabilidade única;
- receber dados e callbacks por contratos claros;
- evitar acesso direto ao Firebase;
- evitar autorização espalhada;
- possuir loading, erro, vazio e sucesso quando aplicável;
- ser navegáveis por teclado quando interativos;
- usar HTML semântico e ARIA somente quando necessário;
- preservar/devolver foco em modais e drawers;
- ser responsivos por padrão;
- não duplicar regra de negócio já disponível em Service.

### 5.1. Ownership de rota/view e DOM

Cada bootstrap de página/feature deve possuir **uma rota/view explícita e exclusiva**.

Obrigatório:

- validar `pathname`, `section`, `view`, `tab`, hash ou demais discriminadores antes de inicializar um módulo;
- quando duas views compartilham a mesma página, seus bootstraps devem ser mutuamente exclusivos;
- um módulo não pode assumir que seu root existe apenas porque a rota principal coincide;
- antes de escrever em `innerHTML`, anexar listeners ou consultar descendentes, validar a existência do root que o módulo realmente possui;
- listeners globais só devem ser instalados quando o módulo realmente estiver ativo;
- evitar bootstraps concorrentes que manipulem a mesma região do DOM.

Regra de regressão: correção causada por root ausente, `null.innerHTML`, bootstrap concorrente ou listener duplicado deve ganhar teste que prove a exclusividade da view.

## 6. Services

Services devem:

- receber dependências explicitamente sempre que possível;
- validar pré-condições de negócio;
- retornar resultados previsíveis;
- lançar/retornar erros padronizados;
- não depender de detalhes visuais;
- não manipular DOM;
- coordenar mais de um Repository/Function quando necessário;
- centralizar regras de domínio que possam ser reutilizadas em mais de uma tela.

Exemplos: regras de ativação/desativação, validação de último `SUPER_ADMIN`, permissões efetivas, restrições de mutação, transições de status e validações de cadastros.

## 7. Repositories

Repositories devem:

- centralizar collections e queries;
- converter documentos para contratos previsíveis;
- esconder o SDK Firestore das camadas superiores;
- evitar consultas duplicadas;
- documentar operações dependentes de índice;
- preservar IDs e timestamps relevantes;
- evitar gravações parciais inconsistentes;
- não conter lógica visual.

Usar transação/batch quando a consistência entre documentos exigir atomicidade.

Mutações privilegiadas devem ir para Cloud Functions em vez de serem forçadas para dentro de Repository cliente.

## 8. Contratos, DTOs e modelos

Como o projeto usa JavaScript, contratos relevantes devem utilizar JSDoc.

Evitar objetos sem contrato atravessando várias camadas.

Campos de entrada, saída e mutação devem ser explícitos, especialmente em operações administrativas, auditoria e módulos que envolvam dados pessoais, financeiros ou contratuais.

## 9. Rotas e autorização

Toda rota protegida deve considerar:

1. usuário autenticado;
2. perfil `users/{uid}` provisionado;
3. usuário ativo;
4. role válida;
5. permissão necessária no módulo (`READ`, `CREATE`, `UPDATE`, `DELETE`);
6. estado de carregamento da sessão/permissões;
7. comportamento seguro para acesso negado.

Ocultar item de menu **não é segurança**.

A mesma operação deve ser protegida por Firestore Security Rules e/ou Cloud Function privilegiada.

### 9.1. Paridade UI x Rules x Functions

A matriz de permissões da UI é contrato de segurança.

- Se a UI não concede uma ação, Rules/Functions não podem concedê-la implicitamente sem requisito explícito.
- Não criar exceções do tipo “todo usuário autenticado pode ler X” sem necessidade documentada.
- Dependências operacionais entre módulos devem derivar de permissão efetiva, não de bypass global.
- Toda alteração na matriz deve revisar UI, guards, Rules, Functions e testes na mesma mudança.
- O catálogo de módulos e ações deve permanecer centralizado; não duplicar strings de permissão em vários arquivos.

## 10. Autenticação e provisionamento

Provedores previstos: Google e e-mail/senha.

Regras:

- Firebase Authentication é a identidade canônica;
- nunca salvar senha, hash de senha ou credencial no Firestore;
- nunca salvar token de autenticação manualmente em `localStorage` ou `sessionStorage`;
- logout encerra Firebase Auth e limpa somente dados locais da aplicação;
- sessão expirada, refresh inválido e usuário desativado devem ter tratamento explícito;
- recuperação de senha usa Firebase Authentication;
- conta autenticada sem `users/{uid}` deve ser tratada como **não provisionada**;
- cliente/browser jamais deve se autoatribuir `ADMIN` ou `SUPER_ADMIN`;
- criação de contas Firebase Auth e mudanças privilegiadas devem ocorrer por backend confiável;
- `lastAccessAt` e auditoria de login/logout devem ser registrados por backend confiável, não depender do cliente como fonte probatória;
- dados de autenticação/autorização devem ser carregados uma vez por sessão quando possível e invalidados de forma controlada quando alterados.

Falha de popup, redirect ou storage do navegador deve gerar erro tratável e não pode deixar a aplicação presa em estado intermediário de autenticação.

## 11. Permissões e privilégio administrativo

Padrão de permissão por módulo:

- `READ`
- `CREATE`
- `UPDATE`
- `DELETE`

Roles atuais:

- `USER`
- `ADMIN`
- `SUPER_ADMIN`

`SUPER_ADMIN` deve ser reconhecido apenas por fonte confiável e perfil ativo.

É proibido:

- e-mail administrativo hardcoded como fonte de autorização no frontend;
- e-mail hardcoded de bootstrap nas Firestore Rules;
- permitir criação do primeiro `SUPER_ADMIN` pelo navegador;
- confiar em `localStorage`, query string, DOM ou estado visual para elevar privilégio;
- permitir que um fluxo normal desative/remova o último `SUPER_ADMIN` ativo.

## 12. Collections e nomenclatura

Collections atuais centrais:

- `users`
- `permissions`
- `auditLogs`

Novas collections de negócio devem seguir estas convenções:

- nome em `camelCase` e plural;
- campos em `camelCase`;
- booleanos afirmativos (`active`, `enabled`, `confirmed`);
- datas de domínio como Timestamp quando persistidas no Firestore;
- `createdAt`/`updatedAt` consistentes;
- `createdBy`/`updatedBy` quando relevante;
- referências explícitas (`userId`, `propertyId`, `leaseId`, `ownerId`, etc.);
- evitar duplicação desnecessária de dados pessoais entre documentos.

Toda collection nova deve declarar regra explícita no Firestore; o fallback permanece `deny all`.

## 13. Firestore Security Rules

As Rules são código de produção e devem ser revisadas junto com qualquer mudança de dados/permissão.

Estado esperado:

- acesso somente a usuários autenticados, provisionados e ativos, salvo endpoint mínimo necessário ao bootstrap;
- leitura/escrita por permissão explícita ou privilégio confiável;
- fallback `deny-by-default`;
- prevenção de elevação de privilégio;
- campos sensíveis protegidos;
- mutações administrativas críticas delegadas ao backend;
- regras testadas automaticamente conforme a suíte evoluir.

### 13.1. Auditoria

`auditLogs` é append-only do ponto de vista de negócio e não pode ser alterado/excluído pelo cliente.

Preferência obrigatória: ações críticas devem ser registradas por Cloud Function/Admin SDK.

Registro mínimo, quando aplicável:

- `actorUserId`;
- `actorUserName`/`actorUserEmail` quando necessário;
- `action` em `UPPER_SNAKE_CASE`;
- `entityType`;
- `entityId`;
- `createdAt` com timestamp do servidor;
- `before`/`after` quando houver alteração;
- `reason` quando a operação exigir justificativa.

Auditoria deve registrar o mínimo necessário para rastreabilidade e não virar réplica indiscriminada de dados pessoais.

## 14. Segurança e sanitização

Obrigatório:

- não versionar `.env` real, private keys, service accounts ou secrets;
- não logar tokens, senhas, headers `Authorization`, cookies ou credenciais;
- validar dados da UI antes de persistir;
- escapar conteúdo do usuário antes de renderizar HTML;
- evitar `innerHTML` com conteúdo não confiável;
- aplicar menor privilégio;
- revisar operações administrativas contra abuso;
- validar dados novamente no backend em operações privilegiadas;
- não confiar em validação exclusivamente cliente.

### 14.1. Logs, URLs e artefatos de QA

Nunca persistir em screenshot metadata, JSON, ZIP, trace, console dump ou artifact CI:

- header `Authorization`;
- bearer token;
- cookie/session;
- URL completa quando query string puder carregar credencial ou dado pessoal sensível;
- payload de request com credenciais ou dados pessoais desnecessários.

Antes de salvar evidência automática:

- sanitizar/redigir dados sensíveis;
- preferir `origin + pathname` e whitelist de query params seguros;
- diferenciar abortos normais de navegação de falhas reais de backend;
- nunca publicar artifact bruto sem revisar conteúdo sensível.

## 15. LGPD e dados imobiliários

Aplicar minimização, finalidade, necessidade, retenção proporcional e acesso por menor privilégio.

Atenção especial a:

- documentos pessoais;
- dados de contato;
- informações bancárias/financeiras;
- contratos e valores;
- documentos de imóvel;
- histórico de locação e atendimento;
- evidências de vistoria/manutenção;
- anexos e documentos assinados.

Não replicar PII sem necessidade. Não incluir conteúdo pessoal completo em logs técnicos ou auditoria quando um identificador/resumo for suficiente.

## 16. UX, responsividade e acessibilidade

Toda alteração visual deve ser validada, no mínimo, nesta matriz:

- desktop: **1440 × 900**;
- tablet/intermediário: **820–834 px** de largura;
- imediatamente antes/depois do breakpoint principal atual de **800 px** quando o shell for afetado;
- mobile: **390 × 844**;
- tema claro;
- tema escuro/sistema quando suportado pela feature.

Se o componente tem breakpoint próprio, validar imediatamente antes e depois dele.

### 16.1. Requisitos bloqueantes

- zero overflow horizontal acidental no `document`;
- regiões que precisam de scroll horizontal devem conter o scroll localmente e permanecer utilizáveis por teclado;
- touch target interativo em mobile/coarse pointer: **mínimo 44 × 44 px**;
- texto normal: contraste WCAG AA **>= 4.5:1**;
- texto grande e componentes gráficos/controles: **>= 3:1** quando aplicável;
- foco visível;
- todo controle de formulário possui accessible name (`label`, `aria-label` ou `aria-labelledby`);
- cada view possui um `h1` coerente;
- nenhuma informação relevante é comunicada somente por cor;
- loading/erro/vazio/sucesso são consistentes;
- modais/drawers preservam foco e não deixam conteúdo inacessível.

A cor institucional não pode ser usada como texto/controle se o contraste não atender WCAG. Criar token de contraste apropriado quando necessário.

### 16.2. ARIA

Preferir HTML nativo. Quando ARIA for realmente necessário:

- respeitar a hierarquia de roles exigida;
- `grid` deve possuir `row`, e `row` deve possuir `gridcell`/células apropriadas;
- não usar ARIA para mascarar semântica incorreta que poderia ser resolvida com HTML nativo;
- testar navegação por teclado e, quando disponível, Axe.

### 16.3. Navegação, menus e submenus

Funcionalidades distintas do mesmo domínio devem ser submenus reais quando isso representar melhor a arquitetura de informação.

Menus/submenus devem funcionar em desktop, estado responsivo/mobile e teclado, com rota/estado ativo correto.

### 16.4. Preservação de contexto de listagens

Ao sair de uma listagem para abrir consulta, detalhe, cadastro ou edição e depois retornar, a aplicação deve preservar o contexto anterior sempre que ele ainda for válido.

Obrigatório:

- preservar filtros ativos, busca, ordenação, paginação e seleção relevante;
- usar URL/query string como fonte principal do estado navegável quando o estado precisar sobreviver à troca de página;
- atualizar esse estado com `history.replaceState` quando possível, sem reload;
- usar `sessionStorage` somente como fallback local de curta duração, nunca como única fonte quando o estado deva ser reproduzível por URL;
- validar `returnTo`/destino de retorno e aceitar somente URLs internas da aplicação;
- não criar leituras adicionais no Firestore apenas para reconstruir filtros/paginação/contexto visual;
- omitir parâmetros neutros/default da URL quando possível;
- fluxos em modal/dialog não devem introduzir navegação artificial;
- toda correção de regressão ligada à perda de contexto deve incluir teste automatizado.

Regra de UX: **filtrar -> abrir/editar -> voltar -> continuar de onde estava**.

## 17. Erros, loading, empty states e confirmações

Erros devem preservar contexto técnico para diagnóstico sem expor detalhe sensível e apresentar mensagem amigável ao usuário.

Operações destrutivas ou administrativas relevantes exigem confirmação explícita.

Alerts/prompts nativos devem ser substituídos por componentes padronizados conforme o Design System evoluir.

Texto de status normal não deve usar semântica/classe de loading infinito. Loading deve desaparecer ou mudar semanticamente quando concluído.

## 18. Performance e estado de sessão

Autenticação, perfil e permissões não devem ser recarregados desnecessariamente a cada troca de view.

Obrigatório:

- carregar dados de sessão uma vez por ciclo autenticado quando possível;
- reutilizar permissões em memória durante a sessão;
- invalidar cache somente quando houver alteração real de usuário/permissão ou evento de autenticação relevante;
- evitar múltiplos listeners equivalentes para o mesmo dado;
- evitar flashes repetidos de “validando permissões” em navegação interna quando a sessão já está válida;
- evitar consultas Firestore apenas para reconstruir estado visual;
- medir e tratar regressões perceptíveis de navegação.

Cache de autorização não pode se tornar fonte de verdade: Rules/Functions continuam obrigatórias.

## 19. Testes

Comando principal atual:

```bash
npm test
```

Validação completa preferencial:

```bash
npm run check
```

Toda correção de bug relevante deve adicionar teste de regressão.

Prioridades:

- Services e regras de negócio;
- autorização e guards;
- Rules do Firestore;
- Cloud Functions privilegiadas;
- Repository/contratos;
- route/view ownership;
- autenticação, refresh, expiração e usuário inativo;
- auditoria;
- transformações de build;
- acessibilidade/responsividade;
- regressões observadas em produção.

E2E Playwright deve cobrir fluxos críticos à medida que a infraestrutura prevista no ROADMAP for implementada.

### 19.1. Transformações de build

Scripts de build não podem fazer substituições globais indiscriminadas em HTML/CSS/JS que alterem valores nativos ou conteúdo de dados.

Obrigatório:

- limitar transformações ao contexto correto;
- preservar valores nativos exigidos pelo browser;
- criar testes positivos e negativos para normalizações de build;
- evitar regex ampla que possa modificar atributos, SVG, `data-*`, valores de formulário ou conteúdo persistido.

## 20. Logs, observabilidade e auditoria

Logs técnicos:

- não incluem secrets ou PII desnecessária;
- usam níveis coerentes;
- não deixam `console.log` permanente sem finalidade;
- `console.error` em fluxo nominal é bug;
- erros de backend devem ser rastreáveis sem expor credenciais.

Auditoria de negócio deve registrar ator, ação, entidade/tipo, ID, horário do servidor e resumo mínimo necessário.

## 21. Design System e estilos

Novos estilos reutilizáveis devem convergir para `src/styles` e tokens compartilhados.

Evitar:

- cores hex repetidas;
- spacing/radius arbitrário;
- CSS duplicando componente existente;
- estilo inline sem necessidade;
- breakpoint conflitante entre shell e conteúdo;
- nova paleta paralela à identidade oficial da Baroli.

### 21.1. Breakpoints

O shell atual muda para layout responsivo em **800 px**.

Componentes críticos não devem permanecer em layout desktop incompatível quando o shell já virou mobile/tablet.

Ao definir breakpoint diferente, justificar e validar a faixa intermediária, especialmente imediatamente antes e depois de 800 px.

## 22. Compatibilidade e legado

Ao tocar código existente:

- não fazer refatoração ampla sem necessidade;
- extrair regra de negócio para Service quando modificada;
- mover acesso Firebase para Repository quando alterado;
- mover operação privilegiada para Cloud Function quando aplicável;
- preservar comportamento público salvo mudança intencional;
- adicionar teste de regressão.

Safety nets de runtime podem existir, mas não substituem corrigir a fonte quando o componente for novamente alterado.

## 23. Definition of Ready (DoR)

Um item está pronto quando objetivo, critérios, entidades/permissões, impacto em dados/Rules/Functions, dependências, comportamento responsivo e riscos de segurança/LGPD são conhecidos proporcionalmente ao tamanho da tarefa.

Para novos módulos de negócio, também deve estar claro quais partes reutilizam o núcleo administrativo e quais são realmente específicas do domínio.

## 24. Definition of Done (DoD)

Um item com UI só está concluído quando:

- implementação completa e arquitetura respeitada;
- testes relevantes passam;
- `npm run check` passa quando aplicável;
- fluxo principal validado;
- desktop 1440, intermediário 820/834, breakpoint 800 e mobile 390 considerados quando afetados;
- tema claro e escuro/sistema considerados;
- nenhum overflow horizontal acidental conhecido;
- touch targets >= 44 px em controles relevantes no mobile;
- contraste/acessibilidade sem regressão relevante;
- `console.error` e `pageerror` em fluxo nominal = **0**;
- nenhum HTTP 5xx inesperado;
- Rules/Functions atualizadas e coerentes com a UI quando necessário;
- auditoria implementada para mutações relevantes;
- artifacts/logs sanitizados;
- documentação/ROADMAP afetados atualizados;
- nenhum secret adicionado;
- nenhuma regressão conhecida introduzida.

## 25. Convenções de arquivos e código

- JS: `kebab-case.js` ou padrão consistente do módulo;
- classes/models: `PascalCase`;
- funções/variáveis: `camelCase`;
- constantes globais: `UPPER_SNAKE_CASE` quando realmente constantes;
- evitar abreviações ambíguas;
- funções pequenas e responsabilidade única;
- `async/await` consistente;
- JSDoc em contratos públicos/não triviais.

## 26. Branches, commits e Pull Requests

Branches: `feat/`, `fix/`, `refactor/`, `docs/`, `test/`.

Commits preferencialmente Conventional Commits.

PR deve informar, quando aplicável: problema, solução, impacto em dados/Rules/Functions, auditoria, testes, evidência visual, riscos e migrações.

Não misturar refatoração ampla não relacionada.

## 27. Checklist obrigatório para qualquer alteração

Antes de concluir, responder objetivamente:

1. A separação View/Controller -> Service -> Repository/Function foi preservada?
2. O bootstrap pertence exclusivamente à rota/view atual?
3. Todo root DOM manipulado é validado antes do uso?
4. Autenticação e autorização estão separadas?
5. UI, guard, Firestore Rules e Functions concedem exatamente o acesso pretendido?
6. Existe identidade administrativa hardcoded ou caminho de autoelevação? Se sim, bloquear.
7. Mutações relevantes geram auditoria confiável?
8. Há risco de secrets ou PII em logs, URLs, traces ou artifacts?
9. Desktop 1440, intermediário 820/834, breakpoint 800 e mobile 390 foram considerados?
10. Tema claro/escuro mantêm contraste adequado?
11. Existe overflow horizontal acidental?
12. Controles touch possuem 44 × 44 px?
13. Form controls têm accessible name e ARIA possui hierarquia válida?
14. Console nominal está sem `console.error`/`pageerror`?
15. Sessão/permissões estão sendo recarregadas sem necessidade?
16. Um teste de regressão cobre o bug corrigido?
17. Documentação/ROADMAP precisam ser atualizados?
18. A nova feature reutiliza autenticação, ACL, auditoria e Design System existentes em vez de duplicá-los?

## 28. QA de produção

Auditoria de produção deve ser **não destrutiva** por padrão.

Pode abrir consulta, filtros, detalhe, cadastro e edição sem salvar. Fluxos destrutivos somente com fixture isolada, autorização explícita e cleanup garantido.

Uma auditoria considerada completa deve, quando aplicável:

- percorrer todas as rotas expostas ao perfil testado;
- testar ao menos um perfil sem privilégio total além do `SUPER_ADMIN`;
- capturar desktop/mobile e claro/escuro;
- abrir filtros, menus, create/edit/detail seguros;
- observar `console.error`, `console.warn`, `pageerror`, requests e HTTP 5xx;
- executar Axe quando disponível;
- medir overflow do documento;
- medir touch targets;
- verificar preservação de filtros/paginação ao voltar;
- distinguir falso positivo de defeito real antes de classificar severidade;
- sanitizar toda evidência antes de upload.

Não classificar request abortado por navegação como indisponibilidade de backend sem evidência adicional.

## 29. Prioridade de instruções

Ao trabalhar em funcionalidade com `AGENTS.md` próprio, as regras específicas complementam este documento.

Em caso de conflito:

1. requisito explícito da tarefa atual;
2. `AGENTS.md` mais específico;
3. este `AGENTS.md` raiz;
4. convenções do legado.

Nunca usar legado como justificativa para reduzir segurança, autorização, auditabilidade, acessibilidade ou proteção de dados.