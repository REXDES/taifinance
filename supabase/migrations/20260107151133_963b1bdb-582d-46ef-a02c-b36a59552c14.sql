-- Alterar coluna amount para aceitar NULL
ALTER TABLE public.payables_receivables 
ALTER COLUMN amount DROP NOT NULL;

-- Adicionar coluna para marcar contas com valor pendente
ALTER TABLE public.payables_receivables 
ADD COLUMN is_amount_pending boolean NOT NULL DEFAULT false;

-- Adicionar comentário para documentação
COMMENT ON COLUMN public.payables_receivables.is_amount_pending IS 'Indica se o valor está pendente de definição (true = valor a definir posteriormente)';