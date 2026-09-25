# Deixar os atalhos do Dashboard com cara de botão

Hoje os seis cards de atalho (Lance Rápido, Contas a Pagar/Receber, Transferências, Balancete, Extrato, Relatório Pagar/Receber) usam exatamente o mesmo recipiente dos cards de números: mesmo fundo, mesma borda fina, mesmo canto arredondado. Por isso parecem informação, não botão.

Você escolheu o estilo **"Vidro escuro com brilho azul"**: tile com fundo translúcido, chip do ícone azul com brilho suave, e ao passar o mouse a borda acende em azul, o fundo clareia e o ícone vira branco sobre azul cheio. Os cards de números embaixo ficam como estão (mais discretos), então a diferença fica imediata.

## O que será feito

1. **Nova cor de ação (azul)** no sistema de temas — uma cor própria para "isso é clicável", separada do verde que hoje representa dinheiro. Definida com os dois modos (escuro e claro) para não quebrar o tema claro.
2. **Novos tiles de atalho** em um componente próprio, com o visual escolhido:
   - fundo translúcido com leve sombra, borda discreta;
   - ícone dentro de um quadradinho azul com borda e brilho;
   - título em negrito e a descrição embaixo;
   - ao passar o mouse: borda azul acesa, fundo clareia, uma luz azul cruza o tile, o quadradinho do ícone fica azul cheio com o símbolo branco, e o tile sobe/clareia levemente; ao clicar ele "afunda" um pouco.
   - continua 3 por linha no computador, 2 no celular, sempre 6 tiles, sempre os mesmos atalhos que seguem o seu uso.
3. **Título da faixa "Atalhos"** com uma linha discreta ao lado ("as telas que você mais usa") — ajuda a ler a faixa como grupo de botões. Se preferir sem o título, é só dizer que deixo sem.
4. **Cards de informação financeira** permanecem sem alteração.

## Detalhes técnicos

- `src/index.css`: novos tokens HSL `--shortcut`, `--shortcut-foreground`, `--shortcut-surface`, `--shortcut-border` e `--shadow-shortcut` em `:root` e `.dark`.
- `tailwind.config.ts`: cores `shortcut` (DEFAULT/foreground/surface/border) e a sombra nova, para uso via classes utilitárias.
- Novo `src/components/finance/ShortcutTiles.tsx`: recebe a lista de atalhos e `onNavigate`, renderiza título + grade + tiles no estilo escolhido.
- `src/components/finance/FinanceDashboard.tsx`: substitui a grade atual de botões (linhas 175-194) por `<ShortcutTiles shortcuts={shortcuts} onNavigate={onNavigate} />`.
- Nenhuma mudança de lógica: continua vindo de `useShortcutCards` (histórico de uso, com os 6 padrões enquanto não há histórico).
- `src/lib/appVersion.ts` e `package.json` sobem para **1.4.9**.
- Verificação: `npx tsgo --noEmit` limpo e captura de tela da prévia nos dois temas (escuro e claro) confirmando que os tiles se distinguem dos cards de números.
