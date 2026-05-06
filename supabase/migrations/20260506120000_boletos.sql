-- Central de Boletos
-- Armazena boletos bancários para acompanhamento de pagamentos

CREATE TABLE public.boletos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  barcode TEXT NOT NULL,
  description TEXT,
  recipient TEXT,
  amount NUMERIC(15, 2),
  due_date DATE,
  bank_code TEXT,
  bank_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  paid_amount NUMERIC(15, 2),
  paid_at DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.boletos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view boletos in their companies"
ON public.boletos FOR SELECT
USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can manage boletos in their companies"
ON public.boletos FOR ALL
USING (has_company_access(auth.uid(), company_id))
WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE TRIGGER update_boletos_updated_at
BEFORE UPDATE ON public.boletos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_boletos_company_id ON public.boletos(company_id);
CREATE INDEX idx_boletos_due_date ON public.boletos(due_date);
CREATE INDEX idx_boletos_status ON public.boletos(status);
