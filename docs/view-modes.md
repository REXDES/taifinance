# Modos de visualização

O app tem três níveis de detalhe. Cada pessoa escolhe o seu pelo ícone no header (ou digitando
"modo visual" na busca, Ctrl/Cmd + K). A escolha fica salva por usuário.

| Modo | Nível | Para quem | O que mostra |
|---|---|---|---|
| **Visual** | 0 | Uso rápido, celular, quem quer só o essencial | Números grandes, ícones, pouco texto, toque fácil — quase um painel de KPIs |
| **Balanceado** | 1 | Padrão — **é o app como ele sempre foi** | Ícones + explicações na medida certa |
| **Descritivo** | 2 | Quem acompanha e analisa | Tudo do Balanceado + variação vs mês anterior, percentuais, previsões, sugestões e cores de status |

Os modos são **camadas aditivas**: o que existe no Visual existe no Balanceado, e o Balanceado está
contido no Descritivo. Por isso cada tela é uma só e decide o que mostrar pelo nível — não há três
versões da mesma tela.

## Como usar nas telas

```tsx
import { useViewMode, ViewModeOnly } from '@/contexts/ViewModeContext';

const { mode, atLeast } = useViewMode();

// Bloco que só existe no Descritivo
<ViewModeOnly min="detailed">…variação %, previsão, sugestões…</ViewModeOnly>

// Bloco que some no Visual
<ViewModeOnly min="balanced">…explicações, tabelas…</ViewModeOnly>

// Decisão em código
const showDescriptions = atLeast('balanced');
```

Regras:

1. **Balanceado é a base e não muda.** Ao criar ou alterar uma tela, o que ela mostra hoje é o
   Balanceado. Visual e Descritivo entram como camadas por cima.
2. **Visual** troca tabelas por cartões/tiles grandes, esconde descrições e deixa só o dado e o
   ícone. Alvos de toque grandes (mínimo ~44px).
3. **Descritivo** só acrescenta — nunca remove nada do Balanceado.
4. Telas de configuração/cadastro não precisam mudar entre os modos.
5. O modo vale para o modo normal do app; o modo administrativo não é afetado.

## Cores: use os tons semânticos

Nunca escolha cor "solta" (`text-green-600`, `text-red-600`, `bg-amber-500`…). Use os tons de
`src/lib/tone.ts` (que vêm das variáveis `--success`, `--warning`, `--destructive`, `--info` em
`src/index.css`, com versões para tema claro e escuro):

```tsx
import { TONE } from '@/lib/tone';
<span className={TONE.success.text}>+12%</span>
<span className={cn('rounded-full p-2', TONE.danger.softBg, TONE.danger.text)}>…</span>
```

- Para uma variação, o tom depende do sentido: **receita subindo = sucesso; despesa subindo =
  atenção/perigo**.
- **Cor nunca vai sozinha**: sempre junto de ícone, sinal (▲/▼, +/−) ou texto (daltonismo).

## Números, previsões e IA

- Todo número exibido é **calculado em código** (testável). A IA nunca inventa valores: no máximo
  escolhe e redige o que destacar a partir de números já calculados.
- Previsão e sugestão aparecem **rotuladas** ("Previsão", "Sugestão") e dizem a base de cálculo
  ("considera as contas já cadastradas com vencimento até 31/10").
- Ao mandar dados para uma IA, enviar só valores agregados — nada de dados pessoais (LGPD).
- Todo número clicável abre a tela de detalhe já filtrada e confere o total (ver `src/lib/drillDown.ts`).

## Texto sugerido para o Knowledge do Lovable

> O app tem 3 modos de visualização (Visual, Balanceado, Descritivo) — ver `docs/view-modes.md`.
> Ao criar ou editar telas: o Balanceado é o comportamento atual e não deve mudar; use
> `useViewMode()` / `<ViewModeOnly min="detailed">` para acrescentar o Descritivo e um layout
> enxuto (números grandes, ícones, pouco texto) para o Visual. Use sempre os tons semânticos de
> `src/lib/tone.ts` (success, warning, destructive/danger, info) em vez de cores soltas, e nunca
> deixe a cor sozinha (junte ícone, sinal ou texto). Números sempre calculados em código; previsões
> e sugestões rotuladas com a base de cálculo.
