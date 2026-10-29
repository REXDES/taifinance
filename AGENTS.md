# AGENTS

- Antecipação de recebíveis: liquidação ao financiador ocorre apenas via split pós-pagamento disparado pelo `necta-webhook` (`supabase/functions/_shared/anticipation.ts`), idempotente por `request_id` — o cedente nunca participa do repasse, eliminando risco de retenção.
- Proposal WhatsApp sends must validate company access and the qualification recipient, persist provider results, and distinguish API acceptance from delivery because send responses do not prove arrival.
- Anticipation disbursement offers four methods (Pagando.net transfer, cedent-issued PIX/boleto charge against the financier, or manual "cobrança própria" with proof) so financiers without a homologated Necta account can still pay; charges are idempotent per assignment via `disbursement_sale_id`.
- Public identity capture starts camera streams after the video mounts and keeps native camera/gallery inputs accessible on permission failure so mobile users can complete verification.
