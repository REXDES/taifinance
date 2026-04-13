/**
 * PIX BR Code (EMV) Payload Generator
 * Follows BACEN specification for static QR Codes
 */

export interface PixParams {
  pixKey: string;
  pixKeyType: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
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
  const { pixKey, merchantName, merchantCity, amount, txId } = params;

  let payload = '';

  // Tag 00 - Payload Format Indicator
  payload += pad('00', '01');

  // Tag 01 - Point of Initiation Method (12 = static)
  payload += pad('01', '12');

  // Tag 26 - Merchant Account Information
  payload += buildMerchantAccountInfo(pixKey);

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
  const name = merchantName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .substring(0, 25);
  payload += pad('59', name);

  // Tag 60 - Merchant City (max 15 chars)
  const city = merchantCity
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .substring(0, 15);
  payload += pad('60', city);

  // Tag 62 - Additional Data Field
  const txIdValue = txId || '***';
  const additionalData = pad('05', txIdValue);
  payload += pad('62', additionalData);

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
