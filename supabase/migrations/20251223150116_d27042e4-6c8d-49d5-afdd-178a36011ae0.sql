-- =============================================
-- TAI FINANCE - ESTRUTURA DO BANCO DE DADOS
-- =============================================

-- Grupos de Contas (ex: Bancos, Investimentos, Caixa)
CREATE TABLE public.account_groups (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL DEFAULT '#3B82F6',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Contas Financeiras
CREATE TABLE public.accounts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    group_id UUID REFERENCES public.account_groups(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    initial_balance NUMERIC NOT NULL DEFAULT 0,
    current_balance NUMERIC NOT NULL DEFAULT 0,
    color TEXT NOT NULL DEFAULT '#10B981',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Grupos de Categorias (ex: Alimentação, Transporte, Vendas)
CREATE TABLE public.transaction_categories (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'both')),
    color TEXT NOT NULL DEFAULT '#8B5CF6',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Sub-grupos de Categorias (ex: Restaurantes, Uber, Vendas Online)
CREATE TABLE public.transaction_subcategories (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    category_id UUID NOT NULL REFERENCES public.transaction_categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Transações (Receitas e Despesas)
CREATE TABLE public.transactions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.transaction_categories(id) ON DELETE SET NULL,
    subcategory_id UUID REFERENCES public.transaction_subcategories(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    amount NUMERIC NOT NULL CHECK (amount > 0),
    description TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Transferências entre Contas
CREATE TABLE public.transfers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    from_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    to_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    description TEXT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT different_accounts CHECK (from_account_id != to_account_id)
);

-- Triggers para updated_at
CREATE TRIGGER update_account_groups_updated_at
    BEFORE UPDATE ON public.account_groups
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at
    BEFORE UPDATE ON public.accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transaction_categories_updated_at
    BEFORE UPDATE ON public.transaction_categories
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transaction_subcategories_updated_at
    BEFORE UPDATE ON public.transaction_subcategories
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Função para atualizar saldo da conta após transação
CREATE OR REPLACE FUNCTION public.update_account_balance_on_transaction()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.type = 'income' THEN
            UPDATE public.accounts SET current_balance = current_balance + NEW.amount WHERE id = NEW.account_id;
        ELSE
            UPDATE public.accounts SET current_balance = current_balance - NEW.amount WHERE id = NEW.account_id;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.type = 'income' THEN
            UPDATE public.accounts SET current_balance = current_balance - OLD.amount WHERE id = OLD.account_id;
        ELSE
            UPDATE public.accounts SET current_balance = current_balance + OLD.amount WHERE id = OLD.account_id;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Reverter transação antiga
        IF OLD.type = 'income' THEN
            UPDATE public.accounts SET current_balance = current_balance - OLD.amount WHERE id = OLD.account_id;
        ELSE
            UPDATE public.accounts SET current_balance = current_balance + OLD.amount WHERE id = OLD.account_id;
        END IF;
        -- Aplicar nova transação
        IF NEW.type = 'income' THEN
            UPDATE public.accounts SET current_balance = current_balance + NEW.amount WHERE id = NEW.account_id;
        ELSE
            UPDATE public.accounts SET current_balance = current_balance - NEW.amount WHERE id = NEW.account_id;
        END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_update_balance_on_transaction
    AFTER INSERT OR UPDATE OR DELETE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_account_balance_on_transaction();

-- Função para atualizar saldos após transferência
CREATE OR REPLACE FUNCTION public.update_account_balance_on_transfer()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.accounts SET current_balance = current_balance - NEW.amount WHERE id = NEW.from_account_id;
        UPDATE public.accounts SET current_balance = current_balance + NEW.amount WHERE id = NEW.to_account_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.accounts SET current_balance = current_balance + OLD.amount WHERE id = OLD.from_account_id;
        UPDATE public.accounts SET current_balance = current_balance - OLD.amount WHERE id = OLD.to_account_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_update_balance_on_transfer
    AFTER INSERT OR DELETE ON public.transfers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_account_balance_on_transfer();

-- RLS Policies
ALTER TABLE public.account_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

-- Account Groups Policies
CREATE POLICY "Users can view account groups in their companies"
    ON public.account_groups FOR SELECT
    USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can manage account groups in their companies"
    ON public.account_groups FOR ALL
    USING (has_company_access(auth.uid(), company_id));

-- Accounts Policies
CREATE POLICY "Users can view accounts in their companies"
    ON public.accounts FOR SELECT
    USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can manage accounts in their companies"
    ON public.accounts FOR ALL
    USING (has_company_access(auth.uid(), company_id));

-- Transaction Categories Policies
CREATE POLICY "Users can view categories in their companies"
    ON public.transaction_categories FOR SELECT
    USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can manage categories in their companies"
    ON public.transaction_categories FOR ALL
    USING (has_company_access(auth.uid(), company_id));

-- Transaction Subcategories Policies
CREATE POLICY "Users can view subcategories in their companies"
    ON public.transaction_subcategories FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.transaction_categories tc
        WHERE tc.id = transaction_subcategories.category_id
        AND has_company_access(auth.uid(), tc.company_id)
    ));

CREATE POLICY "Users can manage subcategories in their companies"
    ON public.transaction_subcategories FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.transaction_categories tc
        WHERE tc.id = transaction_subcategories.category_id
        AND has_company_access(auth.uid(), tc.company_id)
    ));

-- Transactions Policies
CREATE POLICY "Users can view transactions in their companies"
    ON public.transactions FOR SELECT
    USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can manage transactions in their companies"
    ON public.transactions FOR ALL
    USING (has_company_access(auth.uid(), company_id));

-- Transfers Policies
CREATE POLICY "Users can view transfers in their companies"
    ON public.transfers FOR SELECT
    USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can manage transfers in their companies"
    ON public.transfers FOR ALL
    USING (has_company_access(auth.uid(), company_id));

-- Indexes para performance
CREATE INDEX idx_accounts_company ON public.accounts(company_id);
CREATE INDEX idx_accounts_group ON public.accounts(group_id);
CREATE INDEX idx_transactions_company ON public.transactions(company_id);
CREATE INDEX idx_transactions_account ON public.transactions(account_id);
CREATE INDEX idx_transactions_date ON public.transactions(date);
CREATE INDEX idx_transfers_company ON public.transfers(company_id);
CREATE INDEX idx_transfers_date ON public.transfers(date);