/**
 * PIX BR Code (EMV) Payload Generator
 * Follows BACEN specification for static QR Codes
 */

export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';

export interface PixParams {
  pixKey: string;
  pixKeyType: PixKeyType;
  merchantName: string;
  merchantCity: string;
  amount?: number;
  txId?: string;
  description?: string;
}

function pad(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

/**
 * Normalize a PIX key to the canonical format expected by BACEN/DICT.
 * If this doesn't match the DICT registration exactly, the receiving PSP
 * rejects the payment even though the QR is readable.
 */
export function normalizePixKey(key: string, type: PixKeyType): string {
  const trimmed = (key || '').trim();
  switch (type) {
    case 'cpf':
    case 'cnpj':
      return trimmed.replace(/\D/g, '');
    case 'phone': {
      let digits = trimmed.replace(/\D/g, '').replace(/^0+/, '');
      if (!digits.startsWith('55')) digits = '55' + digits;
      return '+' + digits;
    }
    case 'email':
      return trimmed.toLowerCase();
    case 'random':
      return trimmed.toLowerCase();
    default:
      return trimmed;
  }
}

function sanitizeAlphaNum(s: string, max: number): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, max);
}

function sanitizeTxId(s: string): string {
  const cleaned = (s || '').replace(/[^A-Za-z0-9]/g, '').substring(0, 25).toUpperCase();
  return cleaned || '***';
}

function buildMerchantAccountInfo(pixKey: string): string {
  const gui = pad('00', 'br.gov.bcb.pix');
  const key = pad('01', pixKey);
  return pad('26', gui + key);
}

function calculateCRC16(payload: string): string {
  const polynomial = 0x1021;
  let crc = 0xFFFF;

  const bytes = new TextEncoder().encode(payload);
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ polynomial;
      } else {
        crc = crc << 1;
      }
      crc &= 0xFFFF;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function generatePixPayload(params: PixParams): string {
  const { pixKeyType, merchantName, merchantCity, amount, txId } = params;

  const normalizedKey = normalizePixKey(params.pixKey, pixKeyType);

  let payload = '';

  // Tag 00 - Payload Format Indicator
  payload += pad('00', '01');

  // Tag 01 - Point of Initiation Method (12 = static)
  payload += pad('01', '12');

  // Tag 26 - Merchant Account Information
  payload += buildMerchantAccountInfo(normalizedKey);

  // Tag 52 - Merchant Category Code
  payload += pad('52', '0000');

  // Tag 53 - Transaction Currency (986 = BRL)
  payload += pad('53', '986');

  // Tag 54 - Transaction Amount (optional)
  if (amount && amount > 0) {
    payload += pad('54', amount.toFixed(2));
  }

  // Tag 58 - Country Code
  payload += pad('58', 'BR');

  // Tag 59 - Merchant Name (max 25 chars)
  const name = sanitizeAlphaNum(merchantName, 25) || 'RECEBEDOR';
  payload += pad('59', name);

  // Tag 60 - Merchant City (max 15 chars)
  const city = sanitizeAlphaNum(merchantCity, 15) || 'BRASIL';
  payload += pad('60', city);

  // Tag 62 - Additional Data Field
  const txIdValue = sanitizeTxId(txId || '***');
  payload += pad('62', pad('05', txIdValue));

  // Tag 63 - CRC16 (placeholder for calculation)
  payload += '6304';

  const crc = calculateCRC16(payload);
  return payload + crc;
}

export function formatPixKeyForDisplay(key: string, type: string): string {
  switch (type) {
    case 'cpf':
      return key.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    case 'cnpj':
      return key.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    case 'phone':
      return key.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    default:
      return key;
  }
}

/**
 * Validate a PIX key. Returns null if valid, otherwise an error message.
 */
export function validatePixKey(key: string, type: PixKeyType): string | null {
  const normalized = normalizePixKey(key, type);
  switch (type) {
    case 'cpf':
      return /^\d{11}$/.test(normalized) ? null : 'CPF deve conter 11 dígitos';
    case 'cnpj':
      return /^\d{14}$/.test(normalized) ? null : 'CNPJ deve conter 14 dígitos';
    case 'phone':
      return /^\+55\d{10,11}$/.test(normalized)
        ? null
        : 'Telefone inválido. Use DDD + número (ex: 11999998888)';
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? null : 'E-mail inválido';
    case 'random':
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(normalized)
        ? null
        : 'Chave aleatória deve ser um UUID';
    default:
      return 'Tipo de chave inválido';
  }
}
