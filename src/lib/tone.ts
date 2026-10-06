// Tons semânticos: o QUE a cor significa, não qual cor é. Ao escolher cor para um status,
// uma variação ou um alerta, use um tom daqui (e nunca text-green-600 / text-red-600 soltos),
// para que tema claro/escuro e futuras personalizações mudem num lugar só.
//
// Cor nunca vai sozinha: sempre com ícone, sinal (▲/▼, +/−) ou texto — por causa de daltonismo.

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface ToneClasses {
  /** Texto/ícone na cor do tom. */
  text: string;
  /** Fundo suave (cartão de ícone, chip). */
  softBg: string;
  /** Fundo cheio com texto legível por cima (contador, selo). */
  solidBg: string;
  /** Borda na cor do tom. */
  border: string;
  /** Ponto de status. */
  dot: string;
}

export const TONE: Record<Tone, ToneClasses> = {
  success: {
    text: 'text-success',
    softBg: 'bg-success/15',
    solidBg: 'bg-success text-success-foreground',
    border: 'border-success/40',
    dot: 'bg-success',
  },
  warning: {
    text: 'text-warning',
    softBg: 'bg-warning/15',
    solidBg: 'bg-warning text-warning-foreground',
    border: 'border-warning/40',
    dot: 'bg-warning',
  },
  danger: {
    text: 'text-destructive',
    softBg: 'bg-destructive/15',
    solidBg: 'bg-destructive text-destructive-foreground',
    border: 'border-destructive/40',
    dot: 'bg-destructive',
  },
  info: {
    text: 'text-info',
    softBg: 'bg-info/15',
    solidBg: 'bg-info text-info-foreground',
    border: 'border-info/40',
    dot: 'bg-info',
  },
  neutral: {
    text: 'text-foreground',
    softBg: 'bg-muted/40',
    solidBg: 'bg-muted text-foreground',
    border: 'border-border',
    dot: 'bg-muted-foreground/40',
  },
};

/** Ordem de gravidade: o mais grave primeiro. */
export const TONE_PRIORITY: Record<Tone, number> = { danger: 0, warning: 1, info: 2, success: 3, neutral: 4 };

/** Sinal do valor → tom (saldo positivo = sucesso, negativo = perigo). */
export const toneForSign = (value: number): Tone => (value > 0 ? 'success' : value < 0 ? 'danger' : 'neutral');
