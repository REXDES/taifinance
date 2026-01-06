
-- Tabela de clientes/fornecedores
CREATE TABLE public.clients_suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('client', 'supplier', 'both')),
  document TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de contas a pagar/receber
CREATE TABLE public.payables_receivables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('payable', 'receivable')),
  payment_type TEXT NOT NULL CHECK (payment_type IN ('single', 'installment', 'recurring')),
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  category_id UUID REFERENCES public.transaction_categories(id),
  subcategory_id UUID REFERENCES public.transaction_subcategories(id),
  client_supplier_id UUID REFERENCES public.clients_suppliers(id),
  installment_number INTEGER,
  total_installments INTEGER,
  parent_id UUID REFERENCES public.payables_receivables(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  paid_amount NUMERIC,
  paid_date DATE,
  paid_account_id UUID REFERENCES public.accounts(id),
  transaction_id UUID REFERENCES public.transactions(id),
  created_by UUID,
  paid_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clients_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payables_receivables ENABLE ROW LEVEL SECURITY;

-- RLS policies for clients_suppliers
CREATE POLICY "Users can view clients_suppliers in their companies"
ON public.clients_suppliers FOR SELECT
USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can manage clients_suppliers in their companies"
ON public.clients_suppliers FOR ALL
USING (has_company_access(auth.uid(), company_id));

-- RLS policies for payables_receivables
CREATE POLICY "Users can view payables_receivables in their companies"
ON public.payables_receivables FOR SELECT
USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can manage payables_receivables in their companies"
ON public.payables_receivables FOR ALL
USING (has_company_access(auth.uid(), company_id));

-- Triggers for updated_at
CREATE TRIGGER update_clients_suppliers_updated_at
BEFORE UPDATE ON public.clients_suppliers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payables_receivables_updated_at
BEFORE UPDATE ON public.payables_receivables
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for performance
CREATE INDEX idx_payables_receivables_due_date ON public.payables_receivables(due_date);
CREATE INDEX idx_payables_receivables_status ON public.payables_receivables(status);
CREATE INDEX idx_payables_receivables_type ON public.payables_receivables(type);
