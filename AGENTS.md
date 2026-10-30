# AGENTS

- Anticipation settlement is centralized in `supabase/functions/_shared/anticipation.ts`, triggered after payment by `necta-webhook` and idempotent by assignment request ID; use the assignment's financier company so administrator configuration remains authoritative and the cedent does not perform a manual onward transfer.
- Proposal WhatsApp sends must validate company access and the qualification recipient, persist provider results, and distinguish API acceptance from delivery because send responses do not prove arrival.
- Anticipation disbursement offers four methods (Pagando.net transfer, cedent-issued PIX/boleto charge against the financier, or manual "cobrança própria" with proof) so financiers without a homologated Necta account can still pay; charges are idempotent per assignment via `disbursement_sale_id`.
- Public identity capture starts camera streams after the video mounts and keeps native camera/gallery inputs accessible on permission failure so mobile users can complete verification.
