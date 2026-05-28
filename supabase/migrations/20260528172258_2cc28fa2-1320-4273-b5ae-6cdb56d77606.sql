UPDATE public.credit_applications
SET probabilidade_inadimplencia = 9,
    decision_reason = replace(decision_reason, 'inadimplência 900', 'inadimplência 9')
WHERE probabilidade_inadimplencia = 900;