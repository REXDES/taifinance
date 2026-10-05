import * as XLSX from 'xlsx';

export interface SheetColumn<T> {
  header: string;
  /** Largura em caracteres. */
  width?: number;
  /** Colunas de dinheiro saem como número com formato #.##0,00 (não texto). */
  money?: boolean;
  value: (row: T) => string | number | null;
}

interface ExportSheetOptions<T> {
  fileName: string;
  sheetName: string;
  title: string;
  /** Linhas de cabeçalho que dizem de onde veio o relatório (filtro, origem, data). */
  meta: [string, string][];
  columns: SheetColumn<T>[];
  rows: T[];
  /** Totais ao final, alinhados sob a última coluna. */
  footer?: [string, number][];
}

/**
 * Exporta uma lista para Excel com o contexto junto: título, filtro aplicado, origem e
 * data de geração no topo, e os totais no fim. Quem recebe a planilha consegue
 * saber de onde cada número saiu e conferir a soma sem abrir o sistema.
 */
export function exportSheet<T>({ fileName, sheetName, title, meta, columns, rows, footer = [] }: ExportSheetOptions<T>) {
  const aoa: (string | number | null)[][] = [[title], ...meta.map(([k, v]) => [k, v]), []];
  const headerRow = aoa.length;
  aoa.push(columns.map((c) => c.header));
  for (const row of rows) aoa.push(columns.map((c) => c.value(row)));
  const lastCol = columns.length - 1;
  if (footer.length) {
    aoa.push([]);
    for (const [label, value] of footer) {
      const line: (string | number | null)[] = columns.map(() => null);
      line[Math.max(0, lastCol - 1)] = label;
      line[lastCol] = value;
      aoa.push(line);
    }
  }

  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet['!cols'] = columns.map((c) => ({ wch: c.width ?? 16 }));

  const moneyCols = columns.map((c, i) => (c.money ? i : -1)).filter((i) => i >= 0);
  const footerStart = headerRow + 1 + rows.length + 1;
  for (let r = headerRow + 1; r < aoa.length; r++) {
    const isFooter = r >= footerStart;
    for (const c of isFooter ? [lastCol] : moneyCols) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell && typeof cell.v === 'number') cell.z = '#,##0.00';
    }
  }

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName.slice(0, 31));
  XLSX.writeFile(book, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
}
