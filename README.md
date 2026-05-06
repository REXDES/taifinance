# TAI Finance

Sistema de gestão financeira multi-empresas com lançamentos rápidos, extratos, fluxos financeiros e agente de IA para classificação contábil.

## Stack

- **Frontend:** Vite + React 18 + TypeScript + Tailwind CSS
- **UI:** shadcn/ui (Radix UI) + Lucide Icons + Sonner
- **Estado/Dados:** TanStack Query + React Hook Form + Zod
- **Backend:** Supabase (Auth, PostgreSQL + RLS, Edge Functions, Storage)
- **Extras:** Recharts, jsPDF, xlsx, date-fns, dnd-kit, qrcode.react

## Pré-requisitos

- [Bun](https://bun.sh) >= 1.0 (gerenciador de pacotes padrão)
- Node.js >= 18
- Conta no [Supabase](https://supabase.com)

## Rodando localmente

```bash
# 1. Clone o repositório
git clone <repo-url>
cd taifinance

# 2. Instale as dependências
bun install

# 3. Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com as chaves do seu projeto Supabase

# 4. Inicie o servidor de desenvolvimento
bun run dev
```

O app estará disponível em `http://localhost:8080`.

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

| Variável | Onde encontrar |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase → Settings → API → anon/public key |
| `VITE_SUPABASE_PROJECT_ID` | Supabase → Settings → General → Reference ID |

## Scripts disponíveis

```bash
bun run dev        # Servidor de desenvolvimento (porta 8080)
bun run build      # Build de produção
bun run preview    # Pré-visualizar o build
bun run lint       # Verificar linting
```

## Migrações do banco de dados

As migrações estão em `supabase/migrations/`. Para aplicar em um projeto Supabase:

```bash
# Instale o Supabase CLI
npm install -g supabase

# Faça login e vincule o projeto
supabase login
supabase link --project-ref <project-id>

# Aplique as migrações
supabase db push
```

## Roles de acesso

| Role | Permissões |
|---|---|
| `supervisor` | Acesso total à plataforma, modo administrativo |
| `gerente` | Gerencia empresas e usuários dentro dos seus limites |
| `operador` | Acesso operacional — lançamentos, relatórios, transações |

## Funcionalidades

- **Dashboard** financeiro com gráfico de evolução patrimonial
- **Lance Rápido** para registrar entradas/saídas em segundos
- **Lançamentos** com categorização e subcategorias
- **Transferências** entre contas
- **Contas a Pagar/Receber** com calendário e fluxo
- **Relatórios:** Balancete, Extrato, Por Categoria, Fluxo Financeiro
- **Banco Digital** com integração Open Finance
- **Clientes/Fornecedores**
- **Multi-empresas** com controle de acesso granular (RLS)
- **Audit Log** de ações críticas
- **PWA** instalável no mobile
