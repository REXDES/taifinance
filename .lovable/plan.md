# Corrigir a biometria e destravar o funil

## O que foi encontrado
- Os 3 erros 400 são das **miniaturas das fotos**: o app tenta abri-las, mas as fotos foram salvas numa pasta `biometry/...` e a regra de acesso dos arquivos espera que a pasta comece pelo ID da empresa. Por isso as fotos não aparecem.
- A biometria em teste está **aprovada** (similaridade 90%, liveness ok) e a proposta já foi movida para a etapa seguinte no banco. Ou seja, o erro das fotos não deveria travar o funil — o travamento é na tela.

## O que será feito
1. **Fotos:** passar a salvar as novas fotos em `<empresa>/biometry/<proposta>/<biometria>/...` e mover as fotos já enviadas para esse formato (atualizando os endereços na biometria e no cadastro do cliente). As miniaturas voltam a abrir.
2. **Avançar de etapa:** quando a biometria estiver aprovada, mostrar o botão **"Avançar para Formalização"** na tela e conferir que a tela abre a etapa já gravada na proposta (hoje ela fica parada na Biometria).
3. **Teste:** abrir a proposta em teste, ver as 3 fotos carregando e avançar para Formalização.

## Detalhes técnicos
- `credit-biometry-analyze`: `base = ${bio.company_id}/biometry/${application_id}/${bio.id}`; redeploy.
- Script de migração de arquivos: `storage.move` dos objetos `biometry/%` para o novo prefixo e UPDATE de `credit_biometry` e `clients_suppliers` (`selfie_url`, `doc_front_url`, `doc_back_url`).
- `BiometryStep`/`CreditApplicationsPage`: ação de avançar quando `status='approved'` e sincronizar a etapa ativa com `current_step` após refetch.
