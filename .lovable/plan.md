

# Plano: Página "Banco Digital" com múltiplas contas Unida BaaS

## Visão Geral

Criar uma página dedicada "Banco Digital" no sidebar do Finance onde cada empresa pode conectar múltiplas contas Unida BaaS, inserindo credenciais (Client ID / Client Secret) via dialog. A página mostrará saldo e extrato de cada conta conectada.

## Arquitetura

```text
┌─────────────────────────────────────────────────┐
│  Sidebar: Nova seção "Banco Digital"            │
│  └─ Ícone: Landmark (banco)                     │
├─────────────────────────────────────────────────┤
│  Página BankDigitalPage                         │
│  ┌─────────────────────────────────────────┐    │
│  │ Botão "+ Conectar Conta"                │    │
│  │ → Dialog: nome, clientId, clientSecret  │    │
│  │ → Teste de conexão antes de salvar      │    │
│  └─────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────┐    │
│  │ Cards por conta conectada:              │    │
│  │  - Nome, Agência, Conta, Status         │    │
│  │  - Saldo atual                          │    │
│  │  - Botão "Ver Extrato" → tabela         │    │
│  │  - Botão "Editar" / "Desconectar"       │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

## Mudanças

### 1. Migration — Tabela `bank_connections`

```sql
CREATE TABLE public.bank_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  client_id text NOT NULL,
  client_secret text NOT NULL,
  account_id text,
  agency text,
  account_number text,
  is_active boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_connections ENABLE ROW LEVEL SECURITY;

-- Policies: mesma lógica de has_company_access
CREATE POLICY "Users can manage bank connections" ON public.bank_connections
  FOR ALL TO authenticated USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can view bank connections" ON public.bank_connections
  FOR SELECT TO authenticated USING (has_company_access(auth.uid(), company_id));
```

**Nota sobre segurança**: As credenciais (client_id, client_secret) ficam armazenadas na tabela com RLS. O acesso direto à API bancária é feito apenas pela Edge Function no servidor — o frontend nunca recebe as credenciais de volta.

### 2. Edge Function — `bank-api-proxy`

Nova Edge Function que:
- Recebe `connectionId` + ação (`balance` ou `extract`) do frontend
- Busca credenciais da tabela `bank_connections` usando service_role_key
- Autentica na API Unida (`/auth/token`) e cacheia o JWT
- Proxy para `/balance` ou `/extract` conforme solicitado
- Retorna dados ao frontend sem expor credenciais
- CORS headers incluídos

Ações suportadas:
- `test` — testa conexão (autentica e busca saldo)
- `balance` — retorna saldo atual
- `extract` — retorna extrato com filtros (startDate, endDate, type, status, page, limit)

### 3. Frontend — Novos componentes

- **`src/components/finance/BankDigitalPage.tsx`** — Página principal com lista de contas conectadas, cards de saldo, e visualização de extrato
- **Dialog de conexão** — Formulário com campos: Nome da conexão, Client ID, Client Secret. Botão "Testar Conexão" antes de salvar
- **Hook `useBankConnections`** — CRUD na tabela `bank_connections` + chamadas à edge function para saldo/extrato

### 4. Sidebar e Routing

- Adicionar item "Banco Digital" no sidebar (seção principal, após Dashboard)
- Adicionar `'bank-digital'` ao type `FinanceView`
- Renderizar `BankDigitalPage` no switch de views em `Finance.tsx`

### 5. Fluxo do Usuário

1. Acessa "Banco Digital" no menu
2. Clica em "+ Conectar Conta"
3. Preenche nome, Client ID, Client Secret
4. Clica em "Testar Conexão" — edge function autentica e retorna saldo
5. Se sucesso, salva na tabela `bank_connections` com dados da conta (agência, número)
6. Card aparece na página com saldo em tempo real
7. Pode expandir para ver extrato com filtros de data e tipo
8. Pode editar credenciais ou desconectar conta

### 6. Segurança

- Credenciais nunca retornam ao frontend (a edge function lê do banco, usa, e retorna apenas dados)
- RLS garante isolamento por empresa
- Edge function com `verify_jwt = false` mas valida autenticação internamente via Supabase auth

