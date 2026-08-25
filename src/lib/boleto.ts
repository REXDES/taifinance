// Decodificador de boletos bancários brasileiros
// Suporta: Linha Digitável bancária (47 dígitos) e Código de Barras (44 dígitos)
// Referência: Febraban — Manual de Normas e Instrução 004

export interface BoletoDecoded {
  bankCode: string;
  bankName: string;
  amount: number | null;        // null = valor em aberto
  dueDate: Date | null;         // null = sem vencimento
  isValid: boolean;
  error?: string;
}

// Principais bancos brasileiros
const BANK_NAMES: Record<string, string> = {
  '001': 'Banco do Brasil',
  '003': 'Banco da Amazônia',
  '004': 'Banco do Nordeste',
  '033': 'Santander',
  '036': 'Bradesco BBI',
  '041': 'Banrisul',
  '047': 'Banese',
  '070': 'BRB',
  '077': 'Banco Inter',
  '085': 'Cooperativa Central de Crédito Urbano',
  '104': 'Caixa Econômica Federal',
  '133': 'Cresol',
  '136': 'Unicred',
  '184': 'Banco Itaú BBA',
  '208': 'BTG Pactual',
  '212': 'Banco Original',
  '218': 'BS2',
  '237': 'Bradesco',
  '260': 'Nubank',
  '318': 'Banco BMG',
  '320': 'China Construction Bank',
  '336': 'C6 Bank',
  '341': 'Itaú Unibanco',
  '389': 'Banco Mercantil do Brasil',
  '394': 'Banco Bradesco Financiamentos',
  '399': 'HSBC',
  '422': 'Safra',
  '456': 'Banco MUFG Brasil',
  '464': 'Banco Sumitomo Mitsui',
  '473': 'Caixa Geral - Brasil',
  '477': 'Citibank',
  '505': 'Credit Suisse',
  '600': 'Banco Luso Brasileiro',
  '611': 'Banco Paulista',
  '623': 'Banco PAN',
  '633': 'Banco Rendimento',
  '641': 'Banco Alvorada',
  '643': 'Banco Pine',
  '652': 'Itaú Unibanco Holding',
  '655': 'Banco Votorantim',
  '707': 'Banco Daycoval',
  '735': 'Banco Neon',
  '739': 'BCO Cetelem S.A.',
  '741': 'Banco Ribeirão Preto',
  '743': 'Banco Semear',
  '745': 'Citibank',
  '746': 'Banco Modal',
  '748': 'Sicredi',
  '751': 'Scotiabank Brasil',
  '752': 'BNP Paribas Brasil',
  '753': 'Novo Banco Continental',
  '755': 'Bank of America Merrill Lynch',
  '756': 'Sicoob',
  '757': 'KEB Hana do Brasil',
};

// Data base para cálculo do vencimento (07/10/1997)
const BASE_DATE = new Date(1997, 9, 7);

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function parseDueDateFactor(factor: string): Date | null {
  const f = parseInt(factor, 10);
  if (isNaN(f) || f === 0) return null;
  return addDays(BASE_DATE, f);
}

function parseValue(valueStr: string): number | null {
  if (!valueStr || /^0+$/.test(valueStr)) return null;
  return parseInt(valueStr, 10) / 100;
}

function getBankName(code: string): string {
  return BANK_NAMES[code] ?? `Banco ${code}`;
}

/**
 * Decodifica código de barras bancário (44 dígitos).
 * Layout: BBB M K UUUU VVVVVVVVVV CCCCCCCCCCCCCCCCCCCCCCCCC
 */
function decodeBarcode44(digits: string): BoletoDecoded {
  const bankCode = digits.substring(0, 3);
  const dueFactor = digits.substring(5, 9);
  const valueStr = digits.substring(9, 19);

  return {
    bankCode,
    bankName: getBankName(bankCode),
    amount: parseValue(valueStr),
    dueDate: parseDueDateFactor(dueFactor),
    isValid: true,
  };
}

/**
 * Decodifica linha digitável bancária (47 dígitos).
 * O valor e vencimento ficam nos dígitos 33–46.
 * Layout: [campo1 10d][campo2 11d][campo3 11d][digito 1d][venc+valor 10d]
 */
function decodeLinhaDigitavel47(digits: string): BoletoDecoded {
  const bankCode = digits.substring(0, 3);
  // Na linha digitável, dígito 33 = check geral, 34-37 = fator venc, 38-47 = valor
  const dueFactor = digits.substring(33, 37);
  const valueStr = digits.substring(37, 47);

  return {
    bankCode,
    bankName: getBankName(bankCode),
    amount: parseValue(valueStr),
    dueDate: parseDueDateFactor(dueFactor),
    isValid: true,
  };
}

/**
 * Decodifica linha digitável de tributos/GNRE (48 dígitos).
 * O valor fica nos dígitos 5-14; não há fator de vencimento.
 */
function decodeTributo48(digits: string): BoletoDecoded {
  const productId = digits.charAt(1); // '8' = arrecadação, '9' = GNRE
  const valueStr = digits.substring(4, 14);

  return {
    bankCode: '000',
    bankName: productId === '9' ? 'GNRE' : 'Tributo/Arrecadação',
    amount: parseValue(valueStr),
    dueDate: null,
    isValid: true,
  };
}

/**
 * Ponto de entrada principal.
 * Aceita tanto linha digitável (com ou sem espaços/pontos) quanto código de barras.
 */
export function decodeBoleto(raw: string): BoletoDecoded {
  const digits = raw.replace(/\D/g, '');

  if (digits.length === 47) return decodeLinhaDigitavel47(digits);
  if (digits.length === 44) return decodeBarcode44(digits);
  if (digits.length === 48) return decodeTributo48(digits);

  return {
    bankCode: '',
    bankName: '',
    amount: null,
    dueDate: null,
    isValid: false,
    error:
      digits.length === 0
        ? 'Nenhum dígito encontrado.'
        : `Código inválido (${digits.length} dígitos — esperado 44 ou 47).`,
  };
}

/** Formata a linha digitável no padrão visual (NNNNN.NNNNN NNNNN.NNNNNN NNNNN.NNNNNN N NNNNNNNNNNNNNNNN) */
export function formatLinhaDigitavel(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.length === 47) {
    return `${d.substring(0, 5)}.${d.substring(5, 10)} ${d.substring(10, 15)}.${d.substring(15, 21)} ${d.substring(21, 26)}.${d.substring(26, 32)} ${d.substring(32, 33)} ${d.substring(33)}`;
  }
  return raw;
}

export function isBoletoOverdue(dueDate: Date | null): boolean {
  if (!dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dueDate < today;
}
