# AGENTS

- Statement balance suggestions use the pure `statementBalanceMatch` helper and exact cents to select only a verified chronological remainder; never auto-post entries; lines flagged as possible duplicates are treated as already in the account balance (linked, not posted) unless the verified balance chain proves they are missing.

- Anticipation settlement is centralized in `supabase/functions/_shared/anticipation.ts`, triggered after payment by `necta-webhook` and idempotent by assignment request ID; use the assignment's financier company so administrator configuration remains authoritative and the cedent does not perform a manual onward transfer.
- Proposal WhatsApp sends must validate company access and the qualification recipient, persist provider results, and distinguish API acceptance from delivery because send responses do not prove arrival.
- Anticipation disbursement offers four methods (Pagando.net transfer, cedent-issued PIX/boleto charge against the financier, or manual "cobrança própria" with proof) so financiers without a homologated Necta account can still pay; charges are idempotent per assignment via `disbursement_sale_id`.
- Public identity capture starts camera streams after the video mounts and keeps native camera/gallery inputs accessible on permission failure so mobile users can complete verification.
- Finance tag catalog mutations publish company-scoped updates to all mounted picker hooks so newly created tags are immediately reusable.
- TagPicker uses the Fast Refresh reset directive so live changes to its nested catalog hook cannot reuse an incompatible React hook queue.
- Statement line refreshes reject stale import callbacks; upload results replace only the active import's lines so async suggestions cannot empty an open reconciliation.
- Reconciliation edits reuse the persisted suggested description and create categories inline through the existing catalog hook so the bank history is preserved and selectors refresh without navigation.
- Protected workspaces remain mounted during session recovery when a user is still present so long-running imports are not interrupted.
