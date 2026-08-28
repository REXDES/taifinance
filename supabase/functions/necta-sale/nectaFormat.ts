// Camada única de normalização/validação dos dados enviados à Necta Multi-Pay.
// Espelhada em supabase/functions/_shared/nectaFormat.ts (o backend não importa
// de src/). Regras vindas do contrato oficial (OpenAPI 3.1):
// - document: CPF (11) ou CNPJ (14), apenas dígitos e com DV válido
// - phoneNumber: DDD + número (10 ou 11 dígitos)
// - email: format email
// - Address: street, number, neighborhood, city, state (UF), country, postalCode (8 dígitos)
// - datas em YYYY-MM-DD, horas em HH:mm, valores em centavos inteiros

export const digitsOnly = (v?: string | null) => String(v ?? '').replace(/\D/g, '');

export const trimText = (v?: string | null) => String(v ?? '').replace(/\s+/g, ' ').trim();

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

export function isValidCPF(value?: string | null): boolean {
  const d = digitsOnly(value);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

export function isValidCNPJ(value?: string | null): boolean {
  const d = digitsOnly(value);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * weights[i];
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

/** CPF ou CNPJ válido (dígitos verificadores conferidos). */
export const isValidDocument = (value?: string | null) => {
  const d = digitsOnly(value);
  return d.length === 11 ? isValidCPF(d) : d.length === 14 ? isValidCNPJ(d) : false;
};

export const sameDocument = (a?: string | null, b?: string | null) => {
  const x = digitsOnly(a);
  return !!x && x === digitsOnly(b);
};

/** Telefone brasileiro com DDD (10 ou 11 dígitos); remove +55 quando presente. */
export function normalizePhone(value?: string | null): string | null {
  let d = digitsOnly(value);
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  if (d.length === 11 && d[2] !== '9') d = d.slice(0, 2) + d.slice(3); // 11 dígitos sem 9 na 3ª casa
  if (d.length !== 10 && d.length !== 11) return null;
  if (Number(d.slice(0, 2)) < 11) return null;
  return d;
}

export const isValidEmail = (value?: string | null) =>
  /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(trimText(value));

/** CEP com 8 dígitos. */
export function normalizeCep(value?: string | null): string | null {
  const d = digitsOnly(value);
  return d.length === 8 ? d : null;
}

export function normalizeUF(value?: string | null): string | null {
  const uf = trimText(value).toUpperCase().slice(0, 2);
  return UFS.includes(uf) ? uf : null;
}

/** Data em YYYY-MM-DD (aceita ISO e dd/mm/aaaa). */
export function normalizeDate(value?: unknown): string | null {
  const raw = trimText(String(value ?? ''));
  if (!raw) return null;
  let iso = raw.slice(0, 10);
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) iso = `${br[3]}-${br[2]}-${br[1]}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return iso;
}

export const todayISO = () => new Date().toISOString().slice(0, 10);

/** Hora em HH:mm (aceita "9", "9:5", "0900"). */
export function normalizeTime(value?: string | null): string | null {
  const raw = trimText(value);
  if (!raw) return null;
  let h: number, m: number;
  const withColon = raw.match(/^(\d{1,2})[:h.]?(\d{0,2})$/);
  if (withColon) {
    h = Number(withColon[1]);
    m = Number(withColon[2] || 0);
  } else {
    const d = digitsOnly(raw);
    if (d.length !== 4) return null;
    h = Number(d.slice(0, 2));
    m = Number(d.slice(2));
  }
  if (!Number.isFinite(h) || !Number.isFinite(m) || h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const toCents = (v: unknown) => Math.round(Number(v ?? 0) * 100);

export const isUuid = (v?: string | null) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v ?? ''));

/** Valor mínimo do boleto por gateway (contrato: Rinne R$ 5,00; Barte/Getnet R$ 10,00). */
export const boletoMinCents = (gateway?: string | null) =>
  /rinne/i.test(String(gateway ?? 'rinne')) ? 500 : 1000;

export interface PayerInput {
  payer_name?: string | null;
  payer_document?: string | null;
  payer_email?: string | null;
  payer_phone?: string | null;
  payer_address_street?: string | null;
  payer_address_number?: string | null;
  payer_address_neighborhood?: string | null;
  payer_address_city?: string | null;
  payer_address_state?: string | null;
  payer_address_postal_code?: string | null;
}

/** Erros (em português) que impediriam a Necta/gateway de aceitar o pagador. */
export function validatePayer(p: PayerInput): string[] {
  const errors: string[] = [];
  if (!trimText(p.payer_name)) errors.push('Informe o nome do pagador.');
  const doc = digitsOnly(p.payer_document);
  if (!doc) errors.push('Informe o CPF/CNPJ do pagador.');
  else if (doc.length !== 11 && doc.length !== 14) errors.push('O documento do pagador deve ter 11 (CPF) ou 14 (CNPJ) dígitos.');
  else if (!isValidDocument(doc)) errors.push(`${doc.length === 11 ? 'CPF' : 'CNPJ'} do pagador inválido (dígitos verificadores não conferem).`);
  if (!isValidEmail(p.payer_email)) errors.push('Informe um e-mail válido do pagador.');
  if (!normalizePhone(p.payer_phone)) errors.push('Informe o telefone do pagador com DDD (10 ou 11 dígitos).');
  if (!trimText(p.payer_address_street)) errors.push('Informe a rua do pagador.');
  if (!trimText(p.payer_address_neighborhood)) errors.push('Informe o bairro do pagador.');
  if (!trimText(p.payer_address_city)) errors.push('Informe a cidade do pagador.');
  if (!normalizeUF(p.payer_address_state)) errors.push('Informe uma UF válida do pagador (ex.: SP).');
  if (!normalizeCep(p.payer_address_postal_code)) errors.push('Informe um CEP válido do pagador (8 dígitos).');
  return errors;
}

/** Objeto `BuyerCreate` normalizado (usar somente após validatePayer sem erros). */
export function buildBuyer(p: PayerInput) {
  return {
    name: trimText(p.payer_name),
    document: digitsOnly(p.payer_document),
    email: trimText(p.payer_email),
    phoneNumber: normalizePhone(p.payer_phone) as string,
    address: {
      street: trimText(p.payer_address_street),
      number: trimText(p.payer_address_number) || 'S/N',
      neighborhood: trimText(p.payer_address_neighborhood),
      city: trimText(p.payer_address_city),
      state: normalizeUF(p.payer_address_state) as string,
      country: 'BR',
      postalCode: normalizeCep(p.payer_address_postal_code) as string,
    },
  };
}

/** Traduz as mensagens 400 mais comuns dos gateways (Rinne/Barte/Getnet). */
export function translateGatewayError(raw?: string | null): string {
  const msg = String(raw ?? '');
  if (!msg) return 'Falha desconhecida ao falar com o adquirente.';
  const rules: Array<[RegExp, string]> = [
    [/Payer document cannot be the same as the receiver|same as the (merchant|receiver)/i,
      'O pagador não pode ter o mesmo CPF/CNPJ do recebedor. Selecione outro pagador ou emita por outro estabelecimento.'],
    [/document_number.*valid CPF|valid CPF \(11 digits\)/i,
      'CPF/CNPJ do pagador inválido para o adquirente — confira os dígitos informados.'],
    [/invalid (e-?mail|email)/i, 'E-mail do pagador inválido para o adquirente.'],
    [/(phone|telefone).*(invalid|inválid)/i, 'Telefone do pagador inválido — use DDD + número.'],
    [/(zip|postal).*(invalid|inválid|not found)/i, 'CEP do pagador inválido para o adquirente.'],
    [/due ?date.*(past|invalid|inválid)/i, 'Data de vencimento inválida — use uma data futura.'],
    [/(minimum|mínimo).*(amount|valor)/i, 'Valor abaixo do mínimo aceito pelo adquirente para este método.'],
    [/merchant.*(not|não).*(active|homolog|approved)/i,
      'O estabelecimento recebedor ainda não está homologado/ativo no adquirente.'],
    [/unauthorized|401/i, 'Credenciais da integração recusadas pelo adquirente.'],
  ];
  for (const [re, text] of rules) if (re.test(msg)) return text;
  // Mensagem "field — message" das validações do gateway
  const field = msg.match(/([\w.]+)\s+—\s+([^"}]+)/);
  if (field) return `Recusado pelo adquirente em "${field[1]}": ${field[2].trim()}`;
  return msg;
}
