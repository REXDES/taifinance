# AGENTS

- Antecipação de recebíveis: liquidação ao financiador ocorre apenas via split pós-pagamento disparado pelo `necta-webhook` (`supabase/functions/_shared/anticipation.ts`), idempotente por `request_id` — o cedente nunca participa do repasse, eliminando risco de retenção.
