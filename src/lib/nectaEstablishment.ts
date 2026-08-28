// Monta o payload de estabelecimento exatamente no contrato da Necta Multi-Pay
// (POST /establishments — schema EstablishmentCreate).
//
// Regras do contrato:
// - legalPerson: enum PHYSICAL | JURIDICAL (NÃO existe "NATURAL")
// - obrigatórios: name, document, email, phone, legalPerson, birthDate, address, bankAccount
// - mccId é obrigatório (mccId ou mccDbId)
// - bankAccount.type: enum CHECKING | SAVINGS | PAYMENTS | DEPOSIT
// - valores de endereço com country BR e postalCode apenas dígitos

import {
  digitsOnly as fmtDigits, isValidDocument, isValidEmail, normalizeCep,
  normalizeDate, normalizePhone, normalizeTime, normalizeUF, trimText,
} from './nectaFormat';

export const digitsOnly = fmtDigits;

export type LegalPerson = 'PHYSICAL' | 'JURIDICAL';

export function legalPersonOf(document?: string | null, personType?: string | null): LegalPerson {
  const doc = digitsOnly(document);
  if (personType === 'PJ') return 'JURIDICAL';
  if (personType === 'PF') return 'PHYSICAL';
  return doc.length > 11 ? 'JURIDICAL' : 'PHYSICAL';
}

const ACCOUNT_TYPES = ['CHECKING', 'SAVINGS', 'PAYMENTS', 'DEPOSIT'] as const;
export type NectaAccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS: Record<NectaAccountType, string> = {
  CHECKING: 'Conta corrente',
  SAVINGS: 'Conta poupança',
  PAYMENTS: 'Conta de pagamento',
  DEPOSIT: 'Conta depósito',
};

export const WEEK_DAYS = [
  { value: 'MON', label: 'Seg' },
  { value: 'TUE', label: 'Ter' },
  { value: 'WED', label: 'Qua' },
  { value: 'THU', label: 'Qui' },
  { value: 'FRI', label: 'Sex' },
  { value: 'SAT', label: 'Sáb' },
  { value: 'SUN', label: 'Dom' },
] as const;

const FIELD_LABELS: Record<string, string> = {
  legal_name: 'Razão social / nome',
  document: 'CPF/CNPJ',
  email: 'E-mail',
  phone: 'Telefone',
  mcc_id: 'Ramo de atividade (MCC)',
  birth_date: 'Data de nascimento',
  opening_date: 'Data de abertura',
  legal_nature: 'Natureza jurídica',
  address_zip: 'CEP',
  address_street: 'Rua',
  address_number: 'Número',
  address_district: 'Bairro',
  address_city: 'Cidade',
  address_state: 'UF',
  bank_code: 'Banco',
  bank_agency: 'Agência',
  bank_account: 'Conta',
};

/** Campos que a Necta exige e ainda estão vazios no cadastro local. */
export function missingEstablishmentFields(row: Record<string, any>): string[] {
  const legalPerson = legalPersonOf(row.document, row.person_type);
  const required = [
    'legal_name', 'document', 'email', 'phone', 'mcc_id',
    'address_zip', 'address_street', 'address_number', 'address_district', 'address_city', 'address_state',
    'bank_code', 'bank_agency', 'bank_account',
  ];
  // A API exige birthDate sempre; para PJ usamos a data de abertura como referência.
  required.push(legalPerson === 'JURIDICAL' ? 'opening_date' : 'birth_date');
  if (legalPerson === 'JURIDICAL') required.push('legal_nature');
  return required.filter((k) => {
    const v = row[k];
    return v === null || v === undefined || String(v).trim() === '';
  }).map((k) => FIELD_LABELS[k] ?? k);
}

/**
 * Campos preenchidos mas em formato que a Necta recusa (400 no gateway).
 * Complementa `missingEstablishmentFields`, que só checa ausência.
 */
export function invalidEstablishmentFields(row: Record<string, any>): string[] {
  const errors: string[] = [];
  if (row.document && !isValidDocument(row.document)) errors.push('CPF/CNPJ inválido (dígito verificador não confere).');
  if (row.email && !isValidEmail(row.email)) errors.push('E-mail inválido.');
  if (row.phone && !normalizePhone(row.phone)) errors.push('Telefone inválido: use DDD + número (10 ou 11 dígitos).');
  if (row.address_zip && !normalizeCep(row.address_zip)) errors.push('CEP inválido: deve ter 8 dígitos.');
  if (row.address_state && !normalizeUF(row.address_state)) errors.push('UF inválida.');
  const dateField = legalPersonOf(row.document, row.person_type) === 'JURIDICAL' ? 'opening_date' : 'birth_date';
  if (row[dateField] && !normalizeDate(row[dateField])) errors.push(`${FIELD_LABELS[dateField]} inválida (use AAAA-MM-DD).`);
  if (row.bank_account_document && !isValidDocument(row.bank_account_document)) {
    errors.push('CPF/CNPJ do titular da conta inválido.');
  }
  if (row.bank_agency && digitsOnly(row.bank_agency).length > 5) errors.push('Agência deve ter até 5 dígitos.');
  if (row.bank_account && digitsOnly(row.bank_account).length < 2) errors.push('Número da conta inválido.');
  for (const k of ['opening_hours', 'closing_hours']) {
    if (row[k] && !normalizeTime(row[k])) errors.push('Horário de funcionamento inválido (use HH:MM).');
  }
  return errors;
}

/** Payload EstablishmentCreate pronto para POST /establishments. */
export function buildEstablishmentPayload(row: Record<string, any>): Record<string, unknown> {
  const legalPerson = legalPersonOf(row.document, row.person_type);
  const document = digitsOnly(row.document);
  const birthDate = legalPerson === 'JURIDICAL'
    ? (row.opening_date ?? row.birth_date)
    : (row.birth_date ?? row.opening_date);
  const accountType: NectaAccountType = ACCOUNT_TYPES.includes(row.bank_account_type)
    ? row.bank_account_type
    : 'CHECKING';

  const payload: Record<string, unknown> = {
    name: trimText(row.legal_name),
    document,
    email: trimText(row.email).toLowerCase(),
    phone: normalizePhone(row.phone) ?? digitsOnly(row.phone),
    legalPerson,
    birthDate: normalizeDate(birthDate) ?? String(birthDate).slice(0, 10),
    mccId: row.mcc_id,
    address: {
      street: trimText(row.address_street),
      number: trimText(String(row.address_number)),
      neighborhood: trimText(row.address_district),
      city: trimText(row.address_city),
      state: normalizeUF(row.address_state) ?? String(row.address_state).toUpperCase().slice(0, 2),
      country: 'BR',
      postalCode: normalizeCep(row.address_zip) ?? digitsOnly(row.address_zip),
      complement: row.address_complement ? trimText(row.address_complement) : undefined,
    },
    bankAccount: {
      document: digitsOnly(row.bank_account_document || row.document),
      corporateName: trimText(row.bank_account_holder || row.legal_name),
      legalPerson: legalPersonOf(row.bank_account_document || row.document, row.person_type),
      bankCode: row.bank_code ? String(row.bank_code).padStart(3, '0') : undefined,
      compeCode: row.bank_code ? String(row.bank_code).padStart(3, '0') : undefined,
      bankName: row.bank_name ?? undefined,
      agencyNumber: digitsOnly(row.bank_agency),
      accountNumber: digitsOnly(row.bank_account),
      accountType,
      type: accountType,
      active: true,
    },
  };

  if (row.marketplace_id) payload.marketplaceId = row.marketplace_id;
  if (row.legal_nature) payload.legalNature = String(row.legal_nature);
  if (row.cnae_id) payload.cnae = row.cnae_id;
  if (row.opening_date) payload.openingDate = normalizeDate(row.opening_date) ?? String(row.opening_date).slice(0, 10);
  if (row.revenue !== null && row.revenue !== undefined && String(row.revenue) !== '') {
    payload.revenue = String(row.revenue);
  }
  if (Array.isArray(row.opening_days) && row.opening_days.length) payload.openingDays = row.opening_days;
  if (row.opening_hours) payload.openingHours = normalizeTime(row.opening_hours) ?? row.opening_hours;
  if (row.closing_hours) payload.closingHours = normalizeTime(row.closing_hours) ?? row.closing_hours;
  if (row.establishment_format) payload.establishmentFormat = row.establishment_format;
  if (typeof row.digital_account === 'boolean') payload.digitalAccount = row.digital_account;

  return payload;
}

/** Normaliza a situação devolvida pela Necta para o acompanhamento local. */
export function mapHomologationStatus(statusName?: string | null): 'approved' | 'rejected' | 'pending' {
  const name = String(statusName ?? '').toLowerCase();
  if (/(aprov|approv|active|ativo|homologad)/.test(name)) return 'approved';
  if (/(recus|reject|denied|inativ|blocked|bloquead)/.test(name)) return 'rejected';
  return 'pending';
}
