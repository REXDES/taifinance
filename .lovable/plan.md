# Menu mobile: módulos opcionais e permissões

## Por que algumas funcionalidades não aparecem no mobile

O menu lateral (desktop) e o menu mobile são dois componentes diferentes com listas de itens escritas separadamente:

- `FinanceSidebar.tsx` recebe as flags de módulo por empresa (`machinesEnabled`, `creditEnabled`, `bankDigitalEnabled`, `paymentsEnabled`) e aplica também as permissões de cargo (`can(...)`).
- `MobileMenuSheet.tsx` **não recebe nenhuma dessas flags** e **não usa permissões**: as listas de itens são fixas.

Consequências verificadas:

- Itens ausentes no menu mobile: Máquinas e Locações (dashboard, inventário, manutenções, locações, tabela de preços, cadastros, movimentações), Gestão de Crédito (propostas, ocorrências ignoradas, admin), Pagamentos (dashboard, cadastro, cobranças e as telas admin), Tags, Relatório por Tag, Importar Extrato, Split PIX, e no modo administrativo Usuários (global) e Cargos/Permissões.
- "Banco Digital" aparece no mobile **sempre**, mesmo para empresas com o módulo desligado (no desktop respeita a flag).
- No mobile, itens aparecem mesmo para cargos sem permissão, porque a checagem `can(...)` não existe lá.

## O que fazer

1. Passar as flags de módulo ao `MobileMenuSheet` (já estão em `sharedSidebarProps`, só falta declarar nas props do componente).
2. Usar `usePermissions()` no `MobileMenuSheet` e aplicar `can(...)` em cada item, com o mesmo mapa de chaves usado pelo sidebar (`src/lib/permissions.ts`).
3. Espelhar no mobile as seções que faltam, com a mesma condição do desktop:
   - Máquinas e Locações (com submenus Cadastros / Gestão) — só se `machinesEnabled`.
   - Gestão de Crédito — só se `creditEnabled`.
   - Pagamentos (normal e admin) — só se `paymentsEnabled`.
   - Banco Digital — só se `bankDigitalEnabled`.
   - Tags, Relatório por Tag, Importar Extrato, Split PIX.
   - Modo admin: Usuários (global) e Cargos/Permissões.
4. Manter o padrão visual atual do menu mobile (seções colapsáveis, ícones, badge de versão no rodapé) e esconder seções que fiquem vazias após os filtros.
5. Verificar no preview em viewport mobile, com uma empresa com módulos ligados e outra com módulos desligados.

## Detalhes técnicos

- Somente frontend: `src/components/finance/MobileMenuSheet.tsx` (principal) e, se necessário, tipagem das props em `src/pages/Finance.tsx`.
- Para evitar divergência futura, extrair a definição das seções/itens (view, label, ícone, chave de permissão, flag de módulo) para um módulo compartilhado consumido por sidebar e menu mobile — assim um novo módulo aparece nos dois automaticamente.
- Nenhuma mudança de banco de dados ou de regra de negócio.
