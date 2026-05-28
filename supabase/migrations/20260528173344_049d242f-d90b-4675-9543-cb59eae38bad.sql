ALTER TABLE public.credit_rules
  ALTER COLUMN max_probabilidade_inadimplencia SET DEFAULT 1;

UPDATE public.credit_rules
SET max_probabilidade_inadimplencia = GREATEST(1, LEAST(9, 10 - COALESCE(max_probabilidade_inadimplencia, 9)));

UPDATE public.credit_applications
SET decision_reason = NULLIF(
  trim(both ' ;' from regexp_replace(
    regexp_replace(
      decision_reason,
      '(^|; )Probabilidade de inadimplência [0-9]+ acima do máximo permitido \([0-9]+\)(; |$)',
      CASE
        WHEN decision_reason ~ '^[[:space:]]*Probabilidade de inadimplência [0-9]+ acima do máximo permitido \([0-9]+\)[[:space:]]*$' THEN ''
        ELSE '; '
      END,
      'g'
    ),
    ';\s*;',
    '; ',
    'g'
  )),
  ''
)
WHERE decision_reason ~ 'Probabilidade de inadimplência [0-9]+ acima do máximo permitido \([0-9]+\)';

UPDATE public.credit_consultations
SET decision_reason = NULLIF(
  trim(both ' ;' from regexp_replace(
    regexp_replace(
      decision_reason,
      '(^|; )Probabilidade de inadimplência [0-9]+ acima do máximo permitido \([0-9]+\)(; |$)',
      CASE
        WHEN decision_reason ~ '^[[:space:]]*Probabilidade de inadimplência [0-9]+ acima do máximo permitido \([0-9]+\)[[:space:]]*$' THEN ''
        ELSE '; '
      END,
      'g'
    ),
    ';\s*;',
    '; ',
    'g'
  )),
  ''
)
WHERE decision_reason ~ 'Probabilidade de inadimplência [0-9]+ acima do máximo permitido \([0-9]+\)';