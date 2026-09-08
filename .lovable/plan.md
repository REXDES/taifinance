# Pagamentos: credencial por empresa, estabelecimentos coerentes e menu agrupado

Faz sentido, e o modelo que você descreveu é este:

```text
Pagando (marketplace) ── credencial "Integration-TAI" (já no backend) ── só leitura/catálogos
   ├── Empresa TAI "Rone Filho"  ── credencial própria do Portal Necta ── emite boletos/PIX
   │       └── estabelecimentos cadastrados por ela (quem ela cobra / recebe)
   └── Empresa TAI "Originatto"  ── ainda sem homologação ── não emite
           └── estabelecimentos cadastrados por ela
```

Hoje a credencial está amarrada ao par Empresa→Estabelecimento (tabela por estabelecimento), o que obriga a repetir a mesma chave para cada cadastro e não representa a realidade: quem é homologado e tem "Tokens de API" no Portal é a **empresa**, não cada estabelecimento dela.

## O que muda

1. **Credenciais de cobrança passam a ser por empresa.** A aba "Credenciais de cobrança" (Modo Administrativo → Pagamentos → Cadastro) lista as empresas do TAI Finance com o módulo Pagamentos ligado, mostrando: nome, CNPJ, situação ("Liberada para cobrar" / "Aguardando credencial"), data da última validação e o botão "Informar/Atualizar credencial". Ao salvar, a chave é testada na Necta antes de gravar. Nenhum item por estabelecimento nessa aba.

2. **Emissão usa a credencial da empresa.** Ao emitir/cancelar uma cobrança, o sistema autentica com a credencial da empresa dona da cobrança e envia a venda com o recebedor escolhido. Se a empresa não tiver credencial, a mensagem orienta a pedir ao administrador. O selo "Pronto para cobrar / Aguardando liberação" da tela Estabelecimentos (modo normal) e o aviso da tela Cobranças passam a refletir a situação da **empresa**, não do estabelecimento.

3. **Aba Estabelecimentos (admin) fica coerente com o modelo.** Dois blocos na mesma aba:
   - **Sellers na Necta (marketplace Pagando)** — a lista que já existe, com uma coluna nova "Empresa(s) TAI vinculada(s)" mostrando a qual empresa cada seller foi ligado (ou "não vinculado").
   - **Estabelecimentos cadastrados no TAI Finance** — todos os cadastros locais de todas as empresas, com colunas: Empresa, Nome, Documento, Cadastrado por (usuário), Situação da homologação, Seller Necta vinculado (sim/não). Filtro por empresa e busca por nome/documento.
   O botão "Vincular sellers às empresas" continua nessa aba.

4. **Menu lateral do Modo Administrativo agrupado.** Os quatro itens soltos "Pagamentos — Dashboard / Cadastros / Liquidações / Configurações" viram um grupo recolhível "Pagamentos" (mesmo padrão já usado para Máquinas, Crédito e Pagamentos no modo normal), com os rótulos curtos (Dashboard, Cadastros, Liquidações, Configurações). O menu mobile já tem essa seção e permanece igual.

## Detalhes técnicos

**Banco de dados (uma migração)**
- Nova tabela `necta_company_credentials` (company_id único → companies, client_secret, secret_key, token_name, validated_at, created_by, created_at/updated_at). RLS ligada, GRANT apenas para `service_role` (segredos nunca chegam ao navegador).
- Nova coluna `companies.necta_credentials_at timestamptz` (nula = sem credencial) para o front exibir a situação sem ler os segredos.
- `necta_seller_credentials` e `necta_establishments.has_charge_credentials` deixam de ser usados (mantidos por ora, sem exclusão de dados).

**Edge functions**
- `_shared/nectaSeller.ts`: `companyCredentials(admin, companyId)` e `saveCompanyCredentials(admin, companyId, creds)` (valida em `POST /auth`, faz upsert e atualiza `companies.necta_credentials_at`). Remover uso de `savedSellerCredentials`.
- `necta-api`: ação `set_company_credentials { company_id, client_secret, secret_key }` substitui `set_seller_credentials`. Ação `list_sellers` passa a devolver também as empresas vinculadas a cada seller (join em `necta_establishments.necta_establishment_id`).
- `necta-sale`: em `issue` e `void`, credencial = `companyCredentials(admin, sale.company_id)`; mensagem de pendência em português referindo a empresa. Deploy de `necta-api` e `necta-sale`.

**Front-end**
- `NectaAdminRegistrationPage.tsx`: aba Credenciais lista `companies` com `payments_module_enabled = true` (nome, cnpj, `necta_credentials_at`) e chama `nectaAction('set_company_credentials', …)`; aba Estabelecimentos ganha o segundo bloco lendo `necta_establishments` com `companies(name)` e `profiles(full_name)` de `created_by`, filtro por empresa e busca.
- `NectaEstablishmentsPage.tsx` e `NectaChargesPage.tsx`: selo/aviso derivados de `companies.necta_credentials_at` da empresa ativa (uma consulta), não mais de `has_charge_credentials`.
- `financeMenuItems.tsx`: rótulos curtos em `paymentsAdminMenuItems`. `FinanceSidebar.tsx` (modo admin): substituir o `map` solto por um `Collapsible` "Pagamentos" (aberto quando a view atual pertence ao grupo; no modo recolhido, ícones soltos como nos demais grupos).
- Sem alteração em `src/lib/permissions.ts` (chaves já existem).

**Verificação**
- Cadastrar a credencial da empresa Rone Filho na aba nova, emitir um boleto de teste em Cobranças e confirmar retorno da Necta; tentar emitir pela Originatto e confirmar a mensagem orientativa.
