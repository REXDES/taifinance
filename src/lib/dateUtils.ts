import { format } from 'date-fns';

/**
 * Datas "date-only" (yyyy-MM-dd) devem SEMPRE ser interpretadas como data local.
 * `new Date('2026-09-25')` é interpretado como UTC e, em UTC-3, exibe 24/09.
 */
export function parseLocalDate(value: string | Date | null | undefined): Date {
  if (!value) return new Date(NaN);
  if (value instanceof Date) return value;
  const str = String(value).trim();
  // yyyy-MM-dd (sem hora) => força meia-noite local
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return new Date(`${str}T00:00:00`);
  return new Date(str);
}

/** Converte uma Date para 'yyyy-MM-dd' usando o calendário local (nunca toISOString). */
export function formatLocalISO(date: Date | null | undefined): string {
  if (!date || isNaN(date.getTime())) return '';
  return format(date, 'yyyy-MM-dd');
}

/** Data de hoje em 'yyyy-MM-dd' local. */
export function todayISO(): string {
  return formatLocalISO(new Date());
}

/** Exibe uma data date-only no formato brasileiro. */
export function formatBR(value: string | Date | null | undefined): string {
  const d = parseLocalDate(value);
  if (isNaN(d.getTime())) return '—';
  return format(d, 'dd/MM/yyyy');
}

/** Comparador para ordenação por data (ascendente). */
export function compareDate(a: string | Date | null | undefined, b: string | Date | null | undefined): number {
  return parseLocalDate(a).getTime() - parseLocalDate(b).getTime();
}

/** Mesmo dia, considerando datas date-only como locais. */
export function isSameLocalDay(a: string | Date | null | undefined, b: string | Date | null | undefined): boolean {
  const da = parseLocalDate(a);
  const db = parseLocalDate(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}
