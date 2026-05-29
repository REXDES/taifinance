-- Rename column to reflect correct semantics (probabilidade de pagamento)
ALTER TABLE public.credit_rules RENAME COLUMN texto_inadimplencia_block_levels TO texto_pagamento_block_levels;

-- Invert previously stored values (legacy was inadimplência-based; new semantics is pagamento)
UPDATE public.credit_rules
SET texto_pagamento_block_levels = (
  SELECT COALESCE(jsonb_agg(
    CASE elem::text
      WHEN '"muito_alta"' THEN '"muito_baixa"'::jsonb
      WHEN '"alta"'       THEN '"baixa"'::jsonb
      WHEN '"baixa"'      THEN '"alta"'::jsonb
      WHEN '"muito_baixa"' THEN '"muito_alta"'::jsonb
      ELSE elem
    END
  ), '[]'::jsonb)
  FROM jsonb_array_elements(texto_pagamento_block_levels) AS elem
)
WHERE jsonb_typeof(texto_pagamento_block_levels) = 'array'
  AND jsonb_array_length(texto_pagamento_block_levels) > 0;