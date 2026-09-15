# Cobrança: cada empresa cobra só como ela mesma, e só os clientes dela

Faz total sentido — e hoje está errado. Ao importar os estabelecimentos que a Pagando tem na Necta, esses 16 cadastros foram gravados dentro de cada empresa cliente. Confirmado no banco: Originatto tem 19 estabelecimentos (1 próprio + 16 importados da Pagando) e Rone Filho tem 16, todos importados. Por isso eles aparecem tanto na lista de "estabelecimento recebedor" quanto na lista de pagadores.

O modelo correto:

```text
Pagando (marketplace)   → vê tudo, é a administradora
  Originatto            → recebedor = só a própria Originatto
                          pagadores = só clientes/estabelecimentos que a Originatto cadastrou
  Rone Filho            → recebedor = só o próprio Rone Filho
                          pagadores = só os cadastros dele
```

## O que muda

1. **Recebedor fixo.** Na tela Cobranças, o recebedor deixa de ser uma lista. Passa a ser a própria empresa (o perfil dela homologado na Necta), exibido como texto fixo. Se a empresa ainda não tiver perfil homologado/credencial, aparece o aviso orientando a concluir a homologação, e a emissão fica bloqueada.

2. **Pagadores só do próprio cadastro.** A lista "usar cadastro existente" passa a trazer apenas clientes/fornecedores e estabelecimentos cadastrados pela própria empresa. Os cadastros vindos da Necta (marketplace da Pagando) não entram mais.

3. **Estabelecimentos importados saem da visão do cliente.** Os registros importados do marketplace passam a ser marcados como "origem: marketplace" e ficam visíveis somente no Modo Administrativo (aba Estabelecimentos). A tela Estabelecimentos do modo normal mostra só o que a empresa cadastrou.

4. **Vincular seller à empresa = definir o perfil dela.** Ao vincular na tela administrativa, o seller escolhido passa a ser o perfil próprio de recebimento daquela empresa (não um cadastro comum). Um perfil próprio por empresa.

5. **Limpeza dos dados atuais.** Os 32 registros importados hoje dentro de Originatto e Rone Filho são reclassificados como marketplace (nada é excluído) e o seller correspondente de cada empresa é promovido a perfil próprio: "Originatto Semijoias Comércio Ltda" para a Originatto e "Rone Tadeu de Almeida e Silva Filho" para a Rone Filho.

6. **Trava no servidor.** Na emissão, o backend confere que o recebedor é o perfil próprio da empresa dona da cobrança e que a credencial usada é a dessa empresa. Qualquer outro recebedor é recusado.

## Detalhes técnicos

**Banco (uma migração, aditiva)**
- `necta_establishments.origin text not null default 'local'` (valores `local` | `marketplace`).
- Backfill: `origin = 'marketplace'` onde `created_by is null and necta_establishment_id is not null`.
- Backfill: promover a `is_own_profile = true, origin = 'local'` a linha cujo documento (só dígitos) coincide com `companies.cnpj`/documento da empresa; para Originatto e Rone Filho isso resolve as duas linhas citadas. Índice único parcial em `(company_id) where is_own_profile` para garantir um perfil por empresa.

**Front-end**
- `NectaChargesPage.tsx`: substituir `receivers`/`Select` por um único `receiver` (`is_own_profile = true` e `necta_establishment_id not null`); `form.establishment_id` sempre esse id. Query de pagadores ganha `.eq('origin','local')` além de `is_own_profile = false`. Aviso quando não houver perfil próprio ou `companies.necta_credentials_at` for nulo.
- `NectaEstablishmentsPage.tsx`: listagem com `.eq('origin','local')`; remover o botão "Importar estabelecimentos da Necta" desta tela (fica só no modo administrativo).
- `NectaAdminRegistrationPage.tsx`: coluna/badge de origem (Marketplace / Cadastro da empresa) e filtro por origem no bloco de estabelecimentos locais.
- `NectaSellerLinkDialog.tsx`: ao vincular, marcar como perfil próprio da empresa escolhida.

**Backend (edge functions)**
- `necta-api`: `import_sellers` e `link_sellers` gravam `origin: 'marketplace'`; `link_sellers` faz upsert do seller escolhido como `is_own_profile = true, origin = 'local'` na empresa destino, desmarcando qualquer perfil anterior.
- `necta-sale`: em `issue`, validar que `establishment_id` pertence a `sale.company_id` e é o perfil próprio; erro em português caso contrário. Redeploy de `necta-api` e `necta-sale`.

**Verificação**
- Entrar como Originatto: conferir que Cobranças mostra apenas "Originatto" como recebedor e nenhum cadastro da Pagando na lista de pagadores; emitir um boleto de teste e conferir o retorno da Necta. Repetir na Rone Filho.
