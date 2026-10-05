# Modos de visualização

O app tem três níveis de detalhe. Cada pessoa escolhe o seu pelo ícone no header (ou digitando
"modo visual" na busca, Ctrl/Cmd + K). A escolha fica salva por usuário.

| Modo | Nível | Para quem | O que mostra |
|---|---|---|---|
| **Visual** | 0 | Uso rápido, celular, quem quer só o essencial | Números grandes, ícones, pouco texto, toque fácil — quase um painel de KPIs |
| **Balanceado** | 1 | Padrão — **é o app como ele sempre foi** | Ícones + explicações na medida certa |
| **Descritivo** | 2 | Quem acompanha e analisa | Tudo do Balanceado + variação vs mês anterior, percentuais, previsões, sugestões e cores de status |

Os modos são **níveis de detalhe da mesma tela**: o Descritivo contém tudo do Balanceado e
acrescenta análise; o Visual reorganiza o essencial em tiles grandes. Por isso cada tela é uma só
e decide o que mostrar pelo nível — não há três versões da mesma tela.

## O que já está em cada modo

**Dashboard**

| | Visual | Balanceado | Descritivo |
|---|---|---|---|
| Resumo do mês | 4 tiles (saldo, receitas, despesas, balanço), 2 por linha no celular | 4 cards, como sempre | 4 cards + comparação com o mês anterior e % da receita |
| Variação vs mês anterior | selo ▲/▼ com % nos tiles de receita e despesa | — | selo + valor do mês anterior |
| Semana | tiles "a pagar" / "a receber" (clicáveis) | calendário "Contas da Semana" | calendário "Contas da Semana" |
| Atalhos | só ícone e nome | ícone, nome e descrição | ícone, nome e descrição |
| Análise | — | — | resumo em texto, previsão de fechamento, sugestões e alertas, participação por categoria |

Todo número clicável abre a tela de detalhe **já filtrada** e a tela confere o total com o número
clicado ("Confere com «…»").

### Regras de cálculo do Descritivo (`src/lib/dashboardInsights.ts`)

- **Comparação com o mês anterior = mesmo trecho dos dois meses.** Mês em andamento (dias 1 a N)
  contra os dias 1 a N do mês anterior. Comparar com o mês anterior inteiro faria quase toda
  despesa parecer "em queda" nos primeiros dias do mês. O texto sempre diz a base ("ao mesmo
  período de setembro (dias 1 a 5)").
- **Sem base, sem número**: se o mês anterior não tem lançamentos no trecho, ou se a lista
  carregada bateu no teto de 1.000 linhas do servidor (pode estar cortada), a comparação some.
  Pelo mesmo motivo, "nenhuma conta em atraso" só aparece quando há contas em aberto à vista —
  com a lista vazia não dá para distinguir "nada atrasado" de "não consegui carregar".
- **Alertas de variação** só aparecem a partir do 7º dia do mês (antes disso a amostra é pequena
  demais) e quando a variação passa de 10%.
- **Previsão de fechamento** = balanço já realizado no mês + contas a receber em aberto − contas
  a pagar em aberto, com vencimento até o fim do mês (inclui atrasadas). É **estimativa
  rotulada**, mostra a base de cálculo e não adivinha gastos que ainda não foram lançados. Contas
  sem valor definido entram na contagem, mas não na soma (e o texto avisa).
- **Sugestões são regras sobre os números** (`source: 'rule'`). O campo `source: 'ai'` está
  reservado para quando houver sugestões geradas por IA — que só poderão escolher e redigir o que
  destacar a partir de números já calculados aqui.
- Variação de despesa usa o sentido: **despesa subindo = atenção** (âmbar), não perigo; perigo
  fica para saldo negativo e atrasos.

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
3. **Descritivo** só acrescenta — nunca remove nada do Balanceado. Informação nova no Descritivo
   (comparações, previsões, sugestões) entra como bloco separado, não alterando o que o Balanceado mostra.
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
