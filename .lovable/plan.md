## Modo Administrativo para Supervisor

Criar um "modo de acesso" para o supervisor escolher após o login: **Modo Administrativo** ou **Modo Normal**. Os dois usam a mesma base de dados e as mesmas credenciais — muda apenas a interface, os menus disponíveis e o Dashboard. O modo Administrativo será o local exclusivo das configurações do sistema (e ponto de partida para futuras funcionalidades só-admin).

### Como vai funcionar (visão do usuário)

1. Supervisor faz login normalmente em `/auth`.
2. Logo após autenticar, aparece um **dialog** centralizado:
   - "Como deseja acessar o sistema?"
   - Botão **Modo Administrativo** (ícone escudo)
   - Botão **Modo Normal** (ícone usuário)
3. A escolha fica salva em `localStorage` (`tai.accessMode = 'admin' | 'normal'`) e pode ser trocada a qualquer momento por um botão no header ("Trocar modo de acesso").
4. Usuários **Gerente** e **Operador** não veem o dialog — entram direto no Modo Normal.

### Diferenças entre os modos (Supervisor)

**Modo Normal** (operacional do dia a dia)
- Dashboard operacional (atual, da empresa selecionada)
- Lance Rápido, Banco Digital
- Transações (Lançamentos, Transferências, Contas a Pagar/Receber)
- Relatórios (Balancete, Extrato, Categoria, Fluxo, etc.)
- Cadastros operacionais (Contas, Categorias, Clientes/Fornecedores)
- **Sem** seção de Configurações

**Modo Administrativo** (gestão da plataforma)
- **Dashboard Admin (novo)** — abre por padrão, com estatísticas globais de todas as empresas
- Configurações da Empresa (Cadastro, PIX, WhatsApp)
- Gerenciar Empresas (criar/editar/excluir)
- Usuários e Permissões
- Convites
- Logs de Auditoria
- Banco Digital (configuração de credenciais/conexões)
- Sidebar visualmente diferenciada (badge "ADMIN") para deixar claro o contexto

A barra superior mostrará um badge **"Modo Administrativo"** quando ativo, com botão para trocar.

### Dashboard Admin (novo) — estatísticas globais

Cards e gráficos consolidando **todas as empresas**:
- Total de empresas, total de usuários ativos, total de convites pendentes
- Saldo consolidado (soma de `current_balance` de todas as contas, separando Ativo/Passivo)
- Total de receitas e despesas do mês corrente (todas as empresas)
- Contas a pagar/receber pendentes (totais e vencidas)
- Top 5 empresas por movimentação no mês
- Gráfico de evolução patrimonial consolidada (últimos 6 meses)
- Lista de últimas ações (a partir de `audit_logs`)

Como o supervisor já tem `is_supervisor = true`, as RLS atuais permitem ler dados de todas as empresas — não há mudança de banco.

### Onde os itens de menu vão (resumo)

| Item                                          | Modo Normal | Modo Admin |
|-----------------------------------------------|:-----------:|:----------:|
| Dashboard operacional                         | Sim         | Não        |
| **Dashboard Admin (estatísticas globais)**    | Não         | Sim        |
| Lance Rápido                                  | Sim         | Não        |
| Transações / Transferências                   | Sim         | Não        |
| Contas a Pagar/Receber                        | Sim         | Não        |
| Todos os Relatórios                           | Sim         | Não        |
| Contas, Categorias, Clientes/Fornecedores     | Sim         | Não        |
| **Configurações da Empresa (PIX/WhatsApp)**   | Não         | Sim        |
| **Gerenciar Empresas**                        | Não         | Sim        |
| **Usuários / Convites**                       | Não         | Sim        |
| **Logs de Auditoria**                         | Não         | Sim        |
| Banco Digital                                 | Sim (uso)   | Sim (config) |

### Detalhes técnicos

- **Sem mudanças no banco de dados.** O modo é apenas uma preferência de UI; as RLS já garantem segurança real por role.
- Novo contexto `AccessModeContext` (`mode: 'admin' | 'normal' | null`, `setMode`, `resetMode`) com persistência em `localStorage`.
- Novo componente `AccessModeDialog` exibido em `Finance.tsx` quando `isSupervisor && mode === null`.
- `FinanceSidebar.tsx`: receber `accessMode` e renderizar dois conjuntos de menus distintos. View padrão por modo (Dashboard normal ou Dashboard Admin).
- `FinanceHeader.tsx`: badge "Modo Administrativo" + botão "Trocar Modo" (limpa preferência e reabre o dialog).
- Novo componente `AdminDashboard.tsx` com os cards/gráficos globais e novo hook `useAdminGlobalStats.ts` para consolidar dados de todas as empresas (`companies`, `accounts`, `transactions`, `payables_receivables`, `audit_logs`).
- Para gerente/operador: `accessMode` forçado para `'normal'`, dialog nunca aparece.
- Se o supervisor abrir uma view fora do modo atual, redireciona para a view padrão do modo.

### Arquivos que serão criados/alterados

**Criar:**
- `src/contexts/AccessModeContext.tsx`
- `src/components/AccessModeDialog.tsx`
- `src/components/finance/AdminDashboard.tsx`
- `src/hooks/useAdminGlobalStats.ts`

**Editar:**
- `src/App.tsx` (envolver com `AccessModeProvider`)
- `src/pages/Finance.tsx` (mostrar dialog, controlar view padrão por modo, rotear `admin-dashboard`)
- `src/components/finance/FinanceSidebar.tsx` (renderização condicional por modo + visual admin)
- `src/components/finance/FinanceHeader.tsx` (badge + botão "Trocar Modo")