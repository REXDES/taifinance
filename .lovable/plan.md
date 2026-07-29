## Objetivo
1. Permitir que um convite já seja criado com um **cargo customizado** vinculado, propagando-o para `user_roles.custom_role_id` quando o convite for aceito.
2. Tornar `src/lib/permissions.ts` a fonte única e documentada para novos módulos/menus, garantindo que apareçam automaticamente na matriz de **Cargos & Permissões**.

---

## 1. Banco de dados — campo `custom_role_id` no convite
- Adicionar coluna `custom_role_id uuid references public.custom_roles(id) on delete set null` na tabela `public.invitations`.
- Atualizar a função `public.handle_new_user()` para, ao encontrar um convite válido, copiar `invitations.custom_role_id` para `user_roles.custom_role_id` junto com `role` e `company_limit`.
- Atualizar a função `public.accept_invitation(_invitation_id uuid, _user_id uuid)` para também gravar `custom_role_id` em `user_roles`.
- Garantir que, se o convite não tiver cargo customizado, o comportamento atual se mantenha (`custom_role_id = null`).

## 2. Hook de convites
- Alterar `src/hooks/useUsers.ts`:
  - A função `createInvitation` deve aceitar um novo parâmetro opcional `customRoleId?: string | null`.
  - Incluir `custom_role_id: customRoleId || null` no `insert` da tabela `invitations`.

## 3. UI de convites
- Em `src/components/dialogs/FinanceInvitationsDialog.tsx`:
  - Adicionar estado `customRoleId` (string | null).
  - Incluir seletor **"Cargo customizado (opcional)"** abaixo do cargo base, listando os cargos criados em **Cargos & Permissões**.
  - Passar o `customRoleId` para `createInvitation`.
  - Mostrar helper explicando que, se informado, as permissões do cargo customizado se somam/sobrepõem às do cargo base.
- Verificar se `src/components/dialogs/InvitationsDialog.tsx` (fluxo antigo de projetos/elementos) ainda é utilizado; se sim, aplicar a mesma alteração. Caso contrário, deixar documentado na análise.

## 4. Catálogo de permissões como fonte única
- Em `src/lib/permissions.ts`:
  - Adicionar um comentário de cabeçalho explicando que **toda nova tela, menu ou módulo deve ser registrada aqui** para aparecer na matriz de permissões.
  - Manter a estrutura atual de `PERMISSION_GROUPS` e `ALL_PERMISSIONS`.
  - Opcionalmente criar uma função utilitária `getPermissionLabel(key: string)` para centralizar a resolução de nomes.
- Em `src/components/admin/AdminRolesPage.tsx`:
  - Garantir que a matriz continue lendo de `PERMISSION_GROUPS`/`ALL_PERMISSIONS` (já está assim; apenas validar após eventuais ajustes).

## 5. Registro de memória / convenção
- Atualizar `mem://index.md` (se aplicável) ou criar memória de desenvolvimento lembrando:
  > "Ao criar novos módulos/menus, sempre adicionar a `key` correspondente em `src/lib/permissions.ts` para que apareça na matriz de Cargos & Permissões."

## 6. Validação
- Testar o fluxo completo:
  1. Criar um cargo customizado em **Cargos & Permissões**.
  2. Criar um convite selecionando esse cargo customizado.
  3. Aceitar o convite e confirmar que `user_roles.custom_role_id` foi preenchido corretamente.
  4. Verificar que a sidebar respeita as permissões do cargo customizado (`usePermissions`/`can`).

---

## Arquivos esperados de alteração
- `supabase/functions` (migração): adicionar `custom_role_id` em `invitations` e atualizar `handle_new_user` / `accept_invitation`.
- `src/hooks/useUsers.ts`
- `src/components/dialogs/FinanceInvitationsDialog.tsx`
- `src/components/dialogs/InvitationsDialog.tsx` (se ainda em uso)
- `src/lib/permissions.ts`
- `mem://index.md` (convenção de desenvolvimento)

---

## Notas
- Nenhuma alteração visual drástica; o objetivo é funcional.
- Supervisor continua com acesso total e não aparece na matriz.
- Cargos base (`gerente`, `operador`) continuam funcionando normalmente quando nenhum cargo customizado for selecionado.