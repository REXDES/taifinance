# Diagnóstico

O **texto está certo** e a **análise está certa** — quem está invertido é o **valor salvo** na régua atual.

- O campo do bureau (`texto_score`) descreve **probabilidade de PAGAMENTO**:
  - `muito_alta` = melhor pagador
  - `muito_baixa` = pior pagador
- A edge `credit-consult` (linhas 252–258) classifica esse texto e reprova quando o bucket está na lista `texto_inadimplencia_block_levels`.
- O label da UI ("Reprovar quando a probabilidade de pagamento for…") e os hints "melhor"/"pior" estão **corretos**.

O problema: o nome interno da coluna ainda é `texto_inadimplencia_block_levels` (legado, da época em que a régua era "probabilidade de inadimplência"). Quando o admin marcou `media + alta + muito_alta`, ele está hoje **reprovando os melhores pagadores** — exatamente o oposto do que queria. Isso vem de um registro salvo antes da troca de semântica, ou de o usuário ter lido a opção pela ordem visual e não pelo hint.

# Correções propostas

1. **Migração de dados (1x)** — em `credit_rules`, inverter os valores já salvos em `texto_inadimplencia_block_levels` aplicando o mapa:
   - `muito_alta ↔ muito_baixa`
   - `alta ↔ baixa`
   - `media → media`
   
   Isso faz com que a configuração atual passe a significar o que o admin originalmente queria (bloquear os piores pagadores).

2. **Renomear a coluna** para `texto_pagamento_block_levels` (com `ALTER … RENAME COLUMN`), e atualizar referências em:
   - `supabase/functions/credit-consult/index.ts` (3 ocorrências)
   - `src/hooks/useCreditModule.ts` (tipo + default)
   - `src/components/credit/CreditAdminPage.tsx` (binding do checkbox)
   
   O default passa a sugerir `['muito_baixa', 'baixa']` (bloquear apenas os piores pagadores) em vez de `[]`, para refletir a intenção típica.

3. **UI** — manter o label atual, mas:
   - Reordenar os checkboxes da **pior → melhor** (muito_baixa, baixa, média, alta, muito_alta), para que a leitura natural deixe claro que marcar "muito_alta" é absurdo.
   - Destacar visualmente (cor vermelha nos hints "pior" e verde em "melhor").

# Arquivos afetados

- Migração SQL: rename de coluna + UPDATE com mapa de inversão
- `supabase/functions/credit-consult/index.ts`
- `src/hooks/useCreditModule.ts`
- `src/components/credit/CreditAdminPage.tsx`

# Confirmação

Confirma que era exatamente isso (admin queria reprovar **maus pagadores**, não bons) e que posso executar a migração de inversão nos dados já salvos?
