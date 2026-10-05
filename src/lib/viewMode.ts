// Modos de visualização do app. São camadas ADITIVAS: o que aparece no Visual também
// existe no Balanceado, e o Balanceado está contido no Descritivo. Por isso uma tela só
// decide o que mostrar pelo nível, em vez de ter três versões.
//
//   visual   (0) números grandes, ícones e toque rápido — quase um painel de KPIs
//   balanced (1) o app como ele é: ícones + explicações na medida certa (padrão)
//   detailed (2) mais números: variações, percentuais, previsões e sugestões

export type ViewMode = 'visual' | 'balanced' | 'detailed';

export const VIEW_MODES: readonly ViewMode[] = ['visual', 'balanced', 'detailed'];
export const DEFAULT_VIEW_MODE: ViewMode = 'balanced';

// Único lugar com os nomes mostrados na tela — para renomear um modo, mude só aqui.
export const VIEW_MODE_INFO: Record<ViewMode, { label: string; description: string; keywords: string[] }> = {
  visual: {
    label: 'Visual',
    description: 'Só o essencial: números grandes, ícones e toque rápido.',
    keywords: ['simples', 'kpi', 'celular', 'rapido', 'resumido'],
  },
  balanced: {
    label: 'Balanceado',
    description: 'Ícones e explicações na medida certa. É o padrão.',
    keywords: ['padrao', 'normal', 'equilibrado'],
  },
  detailed: {
    label: 'Descritivo',
    description: 'Mais números: variações, percentuais, previsões e sugestões.',
    keywords: ['detalhado', 'analitico', 'completo', 'analise'],
  },
};

const LEVEL: Record<ViewMode, number> = { visual: 0, balanced: 1, detailed: 2 };

/** O modo atual mostra pelo menos o nível `min`? (ex.: atLeast('detailed', 'balanced') === true) */
export const atLeast = (current: ViewMode, min: ViewMode) => LEVEL[current] >= LEVEL[min];

/** O modo atual mostra no máximo o nível `max`? (ex.: atMost('visual', 'balanced') === true) */
export const atMost = (current: ViewMode, max: ViewMode) => LEVEL[current] <= LEVEL[max];

export const isViewMode = (value: unknown): value is ViewMode =>
  typeof value === 'string' && (VIEW_MODES as readonly string[]).includes(value);

// A preferência é por usuário (vários usuários podem dividir o mesmo navegador).
export const viewModeStorageKey = (userId?: string | null) => (userId ? `tai-view-mode:${userId}` : 'tai-view-mode');

export function readStoredViewMode(userId?: string | null): ViewMode {
  try {
    const stored = localStorage.getItem(viewModeStorageKey(userId));
    return isViewMode(stored) ? stored : DEFAULT_VIEW_MODE;
  } catch {
    return DEFAULT_VIEW_MODE;
  }
}

export function writeStoredViewMode(userId: string | null | undefined, mode: ViewMode) {
  try {
    localStorage.setItem(viewModeStorageKey(userId), mode);
  } catch { /* sem localStorage: vale só até recarregar a página */ }
}
