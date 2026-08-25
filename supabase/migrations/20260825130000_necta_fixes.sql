-- Correções do módulo Necta: endereço real do pagador, fila de revisão manual,
-- e dedupe real de eventos de webhook por (event_type, necta_reference_id).

-- Fase 2: endereço do pagador (a Necta exige endereço completo do buyer para emitir boleto;
-- o código anterior usava o endereço do ESTABELECIMENTO como se fosse do comprador).
ALTER TABLE public.necta_sales
  ADD COLUMN IF NOT EXISTS payer_address_street text,
  ADD COLUMN IF NOT EXISTS payer_address_number text,
  ADD COLUMN IF NOT EXISTS payer_address_complement text,
  ADD COLUMN IF NOT EXISTS payer_address_neighborhood text,
  ADD COLUMN IF NOT EXISTS payer_address_city text,
  ADD COLUMN IF NOT EXISTS payer_address_state text,
  ADD COLUMN IF NOT EXISTS payer_address_postal_code text;

-- Fase 4: fila de revisão manual (estorno/falha/erro de sincronização não devem
-- reverter Contas a Receber sozinhos — só sinalizar para revisão humana).
ALTER TABLE public.necta_sales
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid;

CREATE INDEX IF NOT EXISTS idx_necta_sales_needs_review
  ON public.necta_sales(company_id, needs_review) WHERE needs_review = true;

-- Fase 3: dedupe real de webhook. A Necta avisa que marketplace e estabelecimento
-- podem entregar o mesmo fato com svix-id diferente, então a chave de dedupe é
-- (event_type, necta_reference_id), não svix_id isolado.
ALTER TABLE public.necta_webhook_events
  ADD COLUMN IF NOT EXISTS svix_id text;

-- UNIQUE (não parcial): no Postgres, NULL nunca conflita consigo mesmo, então eventos
-- sem necta_reference_id continuam sendo sempre inseridos (não há como dedupá-los mesmo).
-- Isso também deixa o índice compatível com o upsert(onConflict:) do supabase-js.
ALTER TABLE public.necta_webhook_events
  ADD CONSTRAINT necta_webhook_events_event_reference_unique UNIQUE (event_type, necta_reference_id);
