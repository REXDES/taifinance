-- 0020 — Antecipação, Fase 1, parte 1 (banco): travar o caminho do dinheiro.
--
-- Compatível com o código atual. Só o navegador (papel authenticated/anon no JWT)
-- é restringido; as funções do servidor (service_role) e o console continuam
-- com acesso total. Pode ser reaplicada sem efeito colateral.
--
-- O que muda:
--   1. Título com cessão ativa não pode ser editado (valor, vencimento, status,
--      baixa), cancelado nem excluído pelo navegador; o boleto dele também não.
--   2. A cessão só muda pelo servidor (sem UPDATE pelo navegador) e o histórico
--      de eventos só é gravado pelo servidor.
--   3. A solicitação é recalculada no banco a partir do título e do boleto reais
--      e das regras do financiador — o navegador não define valores.
--   4. Novo status split_pending (repasse criado na Necta, aguardando liquidação),
--      campos do repasse e da taxa da plataforma, e configuração global da taxa.

-- ---------------------------------------------------------------- ajudantes

-- true quando quem chama é o navegador. Lê o papel do JWT da requisição, então
-- continua valendo dentro de funções SECURITY DEFINER chamadas pelo usuário.
CREATE OR REPLACE FUNCTION public.ra_is_end_user()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    nullif(current_setting('request.jwt.claim.role', true), ''),
    ''
  ) IN ('authenticated', 'anon');
$$;

-- Status em que o título está comprometido com o financiador.
CREATE OR REPLACE FUNCTION public.ra_active_statuses()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY['requested', 'approved', 'assigned', 'paid_by_debtor', 'split_pending', 'settlement_failed']::text[];
$$;

CREATE OR REPLACE FUNCTION public.ra_brl(_v numeric)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 'R$ ' || replace(to_char(coalesce(_v, 0), 'FM999999999990.00'), '.', ',');
$$;

-- ------------------------------------------------------ cessões: status e campos

ALTER TABLE public.receivable_assignments DROP CONSTRAINT IF EXISTS ra_status_chk;
ALTER TABLE public.receivable_assignments ADD CONSTRAINT ra_status_chk CHECK (status IN (
  'requested', 'approved', 'rejected', 'assigned', 'paid_by_debtor', 'split_pending',
  'settled', 'settlement_failed', 'cancelled'
));

ALTER TABLE public.receivable_assignments
  ADD COLUMN IF NOT EXISTS platform_fee_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_fee_payer text,
  ADD COLUMN IF NOT EXISTS platform_fee_recipient_type text,
  ADD COLUMN IF NOT EXISTS platform_fee_recipient_id text,
  ADD COLUMN IF NOT EXISTS terms_computed_at timestamptz,
  ADD COLUMN IF NOT EXISTS settlement_base_amount numeric,
  ADD COLUMN IF NOT EXISTS financier_split_amount numeric,
  ADD COLUMN IF NOT EXISTS platform_split_amount numeric,
  ADD COLUMN IF NOT EXISTS split_id text,
  ADD COLUMN IF NOT EXISTS platform_split_id text,
  ADD COLUMN IF NOT EXISTS split_status text,
  ADD COLUMN IF NOT EXISTS platform_split_status text,
  ADD COLUMN IF NOT EXISTS split_credential text,
  ADD COLUMN IF NOT EXISTS split_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS settle_claim_id uuid,
  ADD COLUMN IF NOT EXISTS settle_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS last_error text;

ALTER TABLE public.receivable_assignments DROP CONSTRAINT IF EXISTS ra_fee_payer_chk;
ALTER TABLE public.receivable_assignments ADD CONSTRAINT ra_fee_payer_chk
  CHECK (platform_fee_payer IS NULL OR platform_fee_payer IN ('cedent', 'financier'));

CREATE INDEX IF NOT EXISTS ra_title_idx ON public.receivable_assignments (payable_receivable_id);
CREATE INDEX IF NOT EXISTS ra_sale_idx ON public.receivable_assignments (necta_sale_id);
CREATE INDEX IF NOT EXISTS ra_disbursement_sale_idx ON public.receivable_assignments (disbursement_sale_id);
CREATE INDEX IF NOT EXISTS ra_status_idx ON public.receivable_assignments (status);

-- ------------------------------------------- configuração global da antecipação

CREATE TABLE IF NOT EXISTS public.anticipation_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  platform_fee_percent numeric NOT NULL DEFAULT 0 CHECK (platform_fee_percent >= 0 AND platform_fee_percent < 100),
  platform_fee_fixed numeric NOT NULL DEFAULT 0 CHECK (platform_fee_fixed >= 0),
  platform_fee_payer text NOT NULL DEFAULT 'cedent' CHECK (platform_fee_payer IN ('cedent', 'financier')),
  platform_fee_recipient_type text NOT NULL DEFAULT 'SELLER' CHECK (platform_fee_recipient_type IN ('SELLER', 'MARKETPLACE')),
  platform_fee_recipient_id text,
  split_base text NOT NULL DEFAULT 'gross' CHECK (split_base IN ('gross', 'net')),
  internal_transfer_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
INSERT INTO public.anticipation_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
GRANT SELECT, UPDATE ON public.anticipation_settings TO authenticated;
GRANT ALL ON public.anticipation_settings TO service_role;
ALTER TABLE public.anticipation_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anticipation settings read" ON public.anticipation_settings;
CREATE POLICY "anticipation settings read" ON public.anticipation_settings
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "anticipation settings supervisor update" ON public.anticipation_settings;
CREATE POLICY "anticipation settings supervisor update" ON public.anticipation_settings
  FOR UPDATE TO authenticated
  USING (public.is_supervisor(auth.uid())) WITH CHECK (public.is_supervisor(auth.uid()));
DROP TRIGGER IF EXISTS anticipation_settings_updated ON public.anticipation_settings;
CREATE TRIGGER anticipation_settings_updated BEFORE UPDATE ON public.anticipation_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------- condições calculadas no banco

-- Calcula e valida as condições de uma cessão a partir do título e do boleto
-- reais, das regras do financiador e da taxa da plataforma. Lança erro com a
-- mensagem para o usuário quando o título não pode ser antecipado.
CREATE OR REPLACE FUNCTION public.ra_quote(
  _payable_receivable_id uuid,
  _cedent_company_id uuid,
  _financier_company_id uuid,
  _exclude_assignment_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pr public.payables_receivables%ROWTYPE;
  s public.necta_sales%ROWTYPE;
  r public.financier_credit_rules%ROWTYPE;
  st public.anticipation_settings%ROWTYPE;
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_title text;
  v_debtor text;
  v_debtor_doc text;
  v_cedent text;
  v_face numeric;
  v_due date;
  v_days integer;
  v_discount numeric;
  v_fee numeric := 0;
  v_fee_on boolean := false;
  v_net numeric;
  v_used numeric;
BEGIN
  IF public.ra_is_end_user() AND NOT public.has_company_access(auth.uid(), _cedent_company_id) THEN
    RAISE EXCEPTION 'Sem acesso à empresa cedente.';
  END IF;

  SELECT * INTO pr FROM public.payables_receivables WHERE id = _payable_receivable_id;
  IF NOT FOUND OR pr.company_id IS DISTINCT FROM _cedent_company_id THEN
    RAISE EXCEPTION 'Título não encontrado nesta empresa.';
  END IF;
  v_title := coalesce(nullif(pr.description, ''), 'título');
  IF pr.type <> 'receivable' THEN
    RAISE EXCEPTION 'Só contas a receber podem ser antecipadas ("%").', v_title;
  END IF;
  IF pr.status <> 'pending' THEN
    RAISE EXCEPTION 'O título "%" não está em aberto.', v_title;
  END IF;
  IF pr.is_amount_pending OR pr.amount IS NULL OR pr.amount <= 0 THEN
    RAISE EXCEPTION 'O título "%" não tem valor definido.', v_title;
  END IF;

  SELECT * INTO s FROM public.necta_sales
   WHERE payable_receivable_id = pr.id
     AND company_id = pr.company_id
     AND necta_sale_id IS NOT NULL
     AND status IN ('pending', 'issued')
     AND method NOT IN ('link', 'credit_card')
   ORDER BY created_at DESC
   LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'O título "%" não tem boleto Pagando.net em aberto.', v_title;
  END IF;
  v_face := round(s.amount, 2);
  IF abs(v_face - pr.amount) >= 0.01 THEN
    RAISE EXCEPTION 'O valor do título "%" (%) é diferente do boleto emitido (%).',
      v_title, public.ra_brl(pr.amount), public.ra_brl(v_face);
  END IF;
  v_due := coalesce(s.due_date, pr.due_date);
  IF v_due IS NULL THEN
    RAISE EXCEPTION 'O título "%" não tem vencimento.', v_title;
  END IF;
  v_days := v_due - v_today;

  SELECT * INTO r FROM public.financier_credit_rules WHERE financier_company_id = _financier_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'O financiador ainda não configurou as regras de antecipação.';
  END IF;
  IF NOT r.active THEN
    RAISE EXCEPTION 'O financiador não está aceitando solicitações no momento.';
  END IF;
  IF v_days < r.min_days THEN
    RAISE EXCEPTION '"%" vence em % dia(s); o prazo mínimo do financiador é % dia(s).', v_title, v_days, r.min_days;
  END IF;
  IF v_days > r.max_days THEN
    RAISE EXCEPTION '"%" vence em % dia(s); o prazo máximo do financiador é % dia(s).', v_title, v_days, r.max_days;
  END IF;
  IF v_face < coalesce(r.min_title_amount, 0) THEN
    RAISE EXCEPTION '"%" está abaixo do valor mínimo do financiador (%).', v_title, public.ra_brl(r.min_title_amount);
  END IF;
  IF r.max_title_amount IS NOT NULL AND v_face > r.max_title_amount THEN
    RAISE EXCEPTION '"%" está acima do valor máximo do financiador (%).', v_title, public.ra_brl(r.max_title_amount);
  END IF;
  IF r.requires_invoice AND NOT EXISTS (
    SELECT 1 FROM public.receivable_assignment_attachments x
     WHERE x.payable_receivable_id = pr.id AND x.company_id = pr.company_id
  ) THEN
    RAISE EXCEPTION 'Anexe a nota fiscal de "%".', v_title;
  END IF;

  IF r.limit_per_cedent IS NOT NULL THEN
    SELECT coalesce(sum(a.face_amount), 0) INTO v_used
      FROM public.receivable_assignments a
     WHERE a.financier_company_id = _financier_company_id
       AND a.cedent_company_id = _cedent_company_id
       AND a.status = ANY (public.ra_active_statuses())
       AND (_exclude_assignment_id IS NULL OR a.id <> _exclude_assignment_id);
    IF v_used + v_face > r.limit_per_cedent THEN
      RAISE EXCEPTION 'Limite por cedente do financiador excedido com "%" (em uso: %, limite: %).',
        v_title, public.ra_brl(v_used), public.ra_brl(r.limit_per_cedent);
    END IF;
  END IF;

  SELECT cs.name, regexp_replace(coalesce(cs.document, ''), '\D', '', 'g')
    INTO v_debtor, v_debtor_doc
    FROM public.clients_suppliers cs
   WHERE cs.id = pr.client_supplier_id;
  IF r.limit_per_debtor IS NOT NULL THEN
    SELECT coalesce(sum(a.face_amount), 0) INTO v_used
      FROM public.receivable_assignments a
      JOIN public.payables_receivables p ON p.id = a.payable_receivable_id
      LEFT JOIN public.clients_suppliers c ON c.id = p.client_supplier_id
     WHERE a.financier_company_id = _financier_company_id
       AND a.status = ANY (public.ra_active_statuses())
       AND (_exclude_assignment_id IS NULL OR a.id <> _exclude_assignment_id)
       AND (
         (coalesce(v_debtor_doc, '') <> '' AND regexp_replace(coalesce(c.document, ''), '\D', '', 'g') = v_debtor_doc)
         OR (coalesce(v_debtor_doc, '') = '' AND pr.client_supplier_id IS NOT NULL AND p.client_supplier_id = pr.client_supplier_id)
       );
    IF v_used + v_face > r.limit_per_debtor THEN
      RAISE EXCEPTION '"%" excede o limite por sacado do financiador.', v_title;
    END IF;
  END IF;

  v_discount := greatest(0, round(v_face * (r.monthly_discount_rate / 100.0) * (v_days::numeric / 30), 2));

  SELECT * INTO st FROM public.anticipation_settings WHERE id;
  IF FOUND THEN
    v_fee_on := (st.platform_fee_percent > 0 OR st.platform_fee_fixed > 0)
      AND (st.platform_fee_recipient_type = 'MARKETPLACE' OR coalesce(st.platform_fee_recipient_id, '') <> '');
  END IF;
  IF v_fee_on THEN
    v_fee := round(v_face * st.platform_fee_percent / 100.0 + st.platform_fee_fixed, 2);
    IF v_fee >= v_face THEN
      RAISE EXCEPTION 'A taxa da plataforma é maior que o valor de "%".', v_title;
    END IF;
  END IF;

  v_net := v_face - v_discount - CASE WHEN v_fee_on AND st.platform_fee_payer = 'cedent' THEN v_fee ELSE 0 END;
  IF v_net <= 0 THEN
    RAISE EXCEPTION 'O valor líquido de "%" ficaria zero ou negativo.', v_title;
  END IF;

  SELECT name INTO v_cedent FROM public.companies WHERE id = _cedent_company_id;

  RETURN jsonb_build_object(
    'necta_sale_id', s.id,
    'face_amount', v_face,
    'due_date', v_due,
    'days', v_days,
    'discount_rate', r.monthly_discount_rate,
    'discount_amount', v_discount,
    'platform_fee_amount', v_fee,
    'platform_fee_payer', CASE WHEN v_fee_on THEN st.platform_fee_payer END,
    'platform_fee_recipient_type', CASE WHEN v_fee_on THEN st.platform_fee_recipient_type END,
    'platform_fee_recipient_id', CASE WHEN v_fee_on THEN st.platform_fee_recipient_id END,
    'net_amount', v_net,
    'title_description', pr.description,
    'debtor_name', v_debtor,
    'cedent_name', v_cedent
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.ra_quote(uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ra_quote(uuid, uuid, uuid, uuid) TO authenticated, service_role;

-- Solicitação feita pelo navegador: o banco recalcula tudo e ignora o que veio.
CREATE OR REPLACE FUNCTION public.ra_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  q jsonb;
BEGIN
  IF NOT public.ra_is_end_user() THEN
    RETURN NEW;
  END IF;
  q := public.ra_quote(NEW.payable_receivable_id, NEW.cedent_company_id, NEW.financier_company_id, NULL);
  NEW.status := 'requested';
  NEW.requested_by := auth.uid();
  NEW.necta_sale_id := (q ->> 'necta_sale_id')::uuid;
  NEW.face_amount := (q ->> 'face_amount')::numeric;
  NEW.due_date := (q ->> 'due_date')::date;
  NEW.discount_rate := (q ->> 'discount_rate')::numeric;
  NEW.discount_amount := (q ->> 'discount_amount')::numeric;
  NEW.net_amount := (q ->> 'net_amount')::numeric;
  NEW.platform_fee_amount := (q ->> 'platform_fee_amount')::numeric;
  NEW.platform_fee_payer := q ->> 'platform_fee_payer';
  NEW.platform_fee_recipient_type := q ->> 'platform_fee_recipient_type';
  NEW.platform_fee_recipient_id := q ->> 'platform_fee_recipient_id';
  NEW.title_description := q ->> 'title_description';
  NEW.debtor_name := q ->> 'debtor_name';
  NEW.cedent_name := q ->> 'cedent_name';
  NEW.terms_computed_at := now();
  -- Campos que só o servidor preenche.
  NEW.rejection_reason := NULL;
  NEW.decided_by := NULL;
  NEW.decided_at := NULL;
  NEW.settled_at := NULL;
  NEW.disbursed_at := NULL;
  NEW.disbursement_method := NULL;
  NEW.disbursement_sale_id := NULL;
  NEW.disbursement_transfer_id := NULL;
  NEW.disbursement_proof_path := NULL;
  NEW.disbursement_note := NULL;
  NEW.settlement_base_amount := NULL;
  NEW.financier_split_amount := NULL;
  NEW.platform_split_amount := NULL;
  NEW.split_id := NULL;
  NEW.platform_split_id := NULL;
  NEW.split_status := NULL;
  NEW.platform_split_status := NULL;
  NEW.split_credential := NULL;
  NEW.split_checked_at := NULL;
  NEW.settle_claim_id := NULL;
  NEW.settle_claimed_at := NULL;
  NEW.cancel_reason := NULL;
  NEW.last_error := NULL;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS ra_before_insert ON public.receivable_assignments;
CREATE TRIGGER ra_before_insert BEFORE INSERT ON public.receivable_assignments
  FOR EACH ROW EXECUTE FUNCTION public.ra_before_insert();

-- Recalcula as condições na aprovação (servidor). Valida de novo o título e o boleto.
CREATE OR REPLACE FUNCTION public.ra_refresh_terms(_assignment_id uuid)
RETURNS public.receivable_assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a public.receivable_assignments%ROWTYPE;
  q jsonb;
BEGIN
  SELECT * INTO a FROM public.receivable_assignments WHERE id = _assignment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cessão não encontrada.';
  END IF;
  q := public.ra_quote(a.payable_receivable_id, a.cedent_company_id, a.financier_company_id, a.id);
  UPDATE public.receivable_assignments SET
    necta_sale_id = (q ->> 'necta_sale_id')::uuid,
    face_amount = (q ->> 'face_amount')::numeric,
    due_date = (q ->> 'due_date')::date,
    discount_rate = (q ->> 'discount_rate')::numeric,
    discount_amount = (q ->> 'discount_amount')::numeric,
    net_amount = (q ->> 'net_amount')::numeric,
    platform_fee_amount = (q ->> 'platform_fee_amount')::numeric,
    platform_fee_payer = q ->> 'platform_fee_payer',
    platform_fee_recipient_type = q ->> 'platform_fee_recipient_type',
    platform_fee_recipient_id = q ->> 'platform_fee_recipient_id',
    title_description = q ->> 'title_description',
    debtor_name = q ->> 'debtor_name',
    cedent_name = q ->> 'cedent_name',
    terms_computed_at = now()
  WHERE id = a.id
  RETURNING * INTO a;
  RETURN a;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.ra_refresh_terms(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ra_refresh_terms(uuid) TO service_role;

-- Uma liquidação por vez: o servidor reserva a cessão antes de falar com a Necta.
-- Devolve a cessão reservada, ou nada se outra liquidação está em andamento.
CREATE OR REPLACE FUNCTION public.ra_claim_settlement(_assignment_id uuid, _claim_id uuid, _ttl_seconds integer DEFAULT 120)
RETURNS SETOF public.receivable_assignments
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.receivable_assignments
     SET settle_claim_id = _claim_id, settle_claimed_at = now()
   WHERE id = _assignment_id
     AND status IN ('assigned', 'paid_by_debtor', 'split_pending', 'settlement_failed')
     AND (settle_claimed_at IS NULL OR settle_claimed_at < now() - make_interval(secs => greatest(_ttl_seconds, 10)))
  RETURNING *;
$$;
REVOKE EXECUTE ON FUNCTION public.ra_claim_settlement(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ra_claim_settlement(uuid, uuid, integer) TO service_role;

-- ------------------------------------------------- travas do título e do boleto

CREATE OR REPLACE FUNCTION public.ra_lock_title()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_financier text;
BEGIN
  IF NOT public.ra_is_end_user() THEN
    RETURN coalesce(NEW, OLD);
  END IF;
  SELECT a.status, c.name INTO v_status, v_financier
    FROM public.receivable_assignments a
    LEFT JOIN public.companies c ON c.id = a.financier_company_id
   WHERE a.payable_receivable_id = OLD.id
     AND a.status = ANY (public.ra_active_statuses())
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN coalesce(NEW, OLD);
  END IF;
  IF TG_OP = 'DELETE' THEN
    -- Exclusão em cascata de uma empresa inteira, feita pelo administrador.
    IF public.is_supervisor(auth.uid()) THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Título "%" está em antecipação com %: não pode ser excluído.', OLD.description, coalesce(v_financier, 'o financiador')
      USING HINT = 'Cancele a solicitação na tela Antecipação (enquanto não aprovada) ou fale com o financiador.';
  END IF;
  IF NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.due_date IS DISTINCT FROM OLD.due_date
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.type IS DISTINCT FROM OLD.type
     OR NEW.company_id IS DISTINCT FROM OLD.company_id
     OR NEW.client_supplier_id IS DISTINCT FROM OLD.client_supplier_id
     OR NEW.is_amount_pending IS DISTINCT FROM OLD.is_amount_pending
     OR NEW.paid_amount IS DISTINCT FROM OLD.paid_amount
     OR NEW.paid_date IS DISTINCT FROM OLD.paid_date
     OR NEW.paid_account_id IS DISTINCT FROM OLD.paid_account_id
     OR NEW.paid_by IS DISTINCT FROM OLD.paid_by
     OR NEW.transaction_id IS DISTINCT FROM OLD.transaction_id
     OR NEW.assignment_id IS DISTINCT FROM OLD.assignment_id THEN
    RAISE EXCEPTION 'Título "%" está em antecipação com %: valor, vencimento e baixa não podem ser alterados.', OLD.description, coalesce(v_financier, 'o financiador')
      USING HINT = 'O título é baixado automaticamente quando o sacado paga o boleto.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS ra_lock_title ON public.payables_receivables;
CREATE TRIGGER ra_lock_title BEFORE UPDATE OR DELETE ON public.payables_receivables
  FOR EACH ROW EXECUTE FUNCTION public.ra_lock_title();

CREATE OR REPLACE FUNCTION public.ra_lock_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.ra_is_end_user() THEN
    RETURN coalesce(NEW, OLD);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.receivable_assignments a
     WHERE a.status = ANY (public.ra_active_statuses())
       AND (a.necta_sale_id = OLD.id
            OR a.disbursement_sale_id = OLD.id
            OR (OLD.payable_receivable_id IS NOT NULL AND a.payable_receivable_id = OLD.payable_receivable_id))
  ) THEN
    RETURN coalesce(NEW, OLD);
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF public.is_supervisor(auth.uid()) THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Esta cobrança está ligada a uma antecipação ativa e não pode ser excluída.';
  END IF;
  IF NEW.payable_receivable_id IS DISTINCT FROM OLD.payable_receivable_id
     OR NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.company_id IS DISTINCT FROM OLD.company_id
     OR NEW.necta_sale_id IS DISTINCT FROM OLD.necta_sale_id
     OR NEW.necta_payment_link_id IS DISTINCT FROM OLD.necta_payment_link_id
     OR NEW.method IS DISTINCT FROM OLD.method
     OR NEW.due_date IS DISTINCT FROM OLD.due_date
     OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
     OR NEW.establishment_id IS DISTINCT FROM OLD.establishment_id THEN
    RAISE EXCEPTION 'Esta cobrança está ligada a uma antecipação ativa: valor, status e vínculo não podem ser alterados.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS ra_lock_sale ON public.necta_sales;
CREATE TRIGGER ra_lock_sale BEFORE UPDATE OR DELETE ON public.necta_sales
  FOR EACH ROW EXECUTE FUNCTION public.ra_lock_sale();

-- ------------------------------------------- cessão e histórico só pelo servidor

DROP POLICY IF EXISTS "ra update parties" ON public.receivable_assignments;
REVOKE UPDATE, DELETE ON public.receivable_assignments FROM authenticated;
DROP POLICY IF EXISTS "rae insert" ON public.receivable_assignment_events;
REVOKE INSERT, UPDATE, DELETE ON public.receivable_assignment_events FROM authenticated;

NOTIFY pgrst, 'reload schema';
