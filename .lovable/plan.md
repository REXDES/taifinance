
# Gestão de Usuários Global + Cargos com Permissões

## Objetivo
No modo administrativo, transformar a Gestão de Usuários em uma tela global (todos os usuários de todas as empresas) com filtro por nome, edição de dados, criação de cargos customizados e matriz de permissões (cargo × módulo/submenu).

Regra: **supervisor sempre tem acesso total** e não aparece na matriz.

---

## 1. Backend (banco de dados)

### 1.1 Cargos customizáveis
Hoje `app_role` é enum fixo (`supervisor`, `gerente`, `operador`). Para permitir criar novos cargos sem quebrar o resto do sistema, vamos adicionar uma tabela paralela:

- **`custom_roles`**: cargos criados pelo supervisor (nome, descrição, cor).
- Mantemos o enum atual para compatibilidade. O campo `user_roles.role` continua sendo `supervisor` / `gerente` / `operador` (base), e adicionamos `user_roles.custom_role_id` opcional para cargos criados.

### 1.2 Matriz de permissões
- **`role_permissions`**: uma linha por cargo + chave de permissão.
  - `role_key` (texto: `gerente`, `operador`, ou id do custom_role)
  - `permission_key` (texto: ex. `finance.transactions`, `finance.reports.balance_sheet`, `machines.rentals`, `payments.dashboard`, etc.)
  - `allowed` (boolean)
- Função `has_permission(_user_id, _permission_key)` — retorna true se supervisor OU se o cargo do usuário tem a permissão marcada.

### 1.3 Catálogo de permissões
Definido em código (arquivo `src/lib/permissions.ts`) — lista fixa das chaves com rótulos e agrupamento por módulo:
- Gestão Financeira (dashboard, contas, transações, transferências, pagar/receber, quick entry, split pix, banco digital)
- Relatórios (balancete, movimentações, fluxo de caixa, categorias, pagar/receber, auditoria)
- Cadastros (categorias, tags, clientes/fornecedores)
- Máquinas (dashboard, inventário, locações, tabela de preços, manutenção, operadores, mecânicos, catálogo)
- Pagamentos (dashboard, cobranças, transações, liquidações, terminais, estabelecimentos, planos, webhooks)
- Crédito (aplicações, admin, ocorrências ignoradas)
- Configurações (empresas, usuários, convites)

---

## 2. UI Admin — Gestão de Usuários global

### 2.1 Nova tela `AdminUsersPage`
Substitui/expande o `UsersDialog` atual quando acessado pelo supervisor no modo administrativo:
- Lista global de **todos** os usuários (join `profiles` + `user_roles` + `user_companies` → nomes das empresas)
- Campo de busca por nome/email (filtro client-side)
- Colunas: avatar, nome, email, cargo (base + custom), empresas vinculadas, ações
- Ações por linha: editar dados (nome, email display, cargo), gerenciar acessos (dialog existente), remover

### 2.2 Nova tela `AdminRolesPage` (Cargos & Permissões)
Acessada a partir da tela de usuários (botão "Cargos & permissões"):
- Bloco superior: lista de cargos (gerente, operador, + customizados). Botão "Novo cargo" para criar (nome, descrição, cor). Editar/excluir custom roles.
- Bloco principal: **matriz de permissões**
  - Coluna 1 (vertical): cargos
  - Linhas do cabeçalho horizontal: módulos e submenus (agrupados)
  - Células: checkbox `allowed` — salva em `role_permissions` on-change (com debounce/toast)
  - Cabeçalho tem checkbox "marcar todos do módulo" para agilidade
  - Supervisor não aparece (sempre acesso total)

### 2.3 Aplicação das permissões
- Hook `usePermissions()` — carrega permissões do usuário logado (via função RPC) e expõe `can(key)`.
- Sidebar (`FinanceSidebar`) filtra itens usando `can(permission_key)`.
- Rotas sensíveis ficam com guard leve (retorna "Sem acesso" se não permitido).
- Supervisor: `can()` sempre retorna true.

---

## 3. Detalhes técnicos

**Migração SQL** (uma migração):
```
CREATE TABLE public.custom_roles (id, company_scope_null, name, description, color, created_by, created_at, updated_at);
CREATE TABLE public.role_permissions (id, role_key text, permission_key text, allowed bool, UNIQUE(role_key, permission_key));
ALTER TABLE public.user_roles ADD COLUMN custom_role_id uuid REFERENCES custom_roles(id);
CREATE FUNCTION public.has_permission(_user_id, _permission_key) RETURNS boolean SECURITY DEFINER;
-- GRANTs + RLS: só supervisor lê/escreve custom_roles e role_permissions; usuários autenticados leem apenas as próprias permissões via RPC.
```

**Arquivos front-end**:
- `src/lib/permissions.ts` — catálogo de chaves + labels + grupos
- `src/hooks/usePermissions.ts` — carrega e expõe `can()`
- `src/hooks/useCustomRoles.ts` — CRUD de cargos customizados
- `src/hooks/useRolePermissions.ts` — leitura/escrita da matriz
- `src/components/admin/AdminUsersPage.tsx` — listagem global
- `src/components/admin/AdminRolesPage.tsx` — matriz + gestão de cargos
- Ajustes em `FinanceSidebar.tsx` para filtrar por `can()`
- Ajuste no roteamento de `Finance.tsx` (ou onde o modo admin renderiza) para exibir as duas novas telas

**Compatibilidade**: cargos existentes (`gerente`, `operador`) continuam funcionando; se `role_permissions` estiver vazio para um cargo, assume-se **acesso total** (para não travar quem já usa) até o supervisor customizar — depois exibimos aviso na UI de matriz.

---

## Fora de escopo
- Migrar o enum `app_role` para tabela (mantido por compatibilidade).
- Permissões por linha/registro (só por módulo/menu).
- Reescrever telas para checagem granular além do que a sidebar já filtra.

Confirma que posso implementar assim?
