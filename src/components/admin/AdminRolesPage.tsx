import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { DeleteConfirmDialog } from '@/components/dialogs/DeleteConfirmDialog';
import { Plus, Pencil, Trash2, Shield } from 'lucide-react';
import { PERMISSION_GROUPS, ALL_PERMISSIONS, type PermissionGroup } from '@/lib/permissions';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useCustomRoles, type CustomRole } from '@/hooks/useCustomRoles';
import { useRolePermissions } from '@/hooks/useRolePermissions';

type RoleRow = { key: string; label: string; color: string; isCustom: boolean };

const BASE_ROLES: RoleRow[] = [
  { key: 'gerente', label: 'Gerente', color: '#0ea5e9', isCustom: false },
  { key: 'operador', label: 'Operador', color: '#64748b', isCustom: false },
];

export function AdminRolesPage() {
  const { roles: customRoles, createRole, updateRole, deleteRole } = useCustomRoles();
  const { isAllowed, setAllowed } = useRolePermissions();

  const [editing, setEditing] = useState<CustomRole | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', color: '#6366f1' });
  const [toDelete, setToDelete] = useState<CustomRole | null>(null);

  const allRoles: RoleRow[] = useMemo(() => [
    ...BASE_ROLES,
    ...customRoles.map(r => ({ key: r.id, label: r.name, color: r.color, isCustom: true })),
  ], [customRoles]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', color: '#6366f1' });
    setCreating(true);
  };

  const openEdit = (r: CustomRole) => {
    setEditing(r);
    setForm({ name: r.name, description: r.description || '', color: r.color });
    setCreating(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    const ok = editing
      ? await updateRole(editing.id, form)
      : await createRole(form.name.trim(), form.description, form.color);
    if (ok) setCreating(false);
  };

  const toggleAll = async (roleKey: string, groupKeys: string[], value: boolean) => {
    for (const k of groupKeys) {
      // eslint-disable-next-line no-await-in-loop
      await setAllowed(roleKey, k, value);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6" />
            Cargos & Permissões
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Supervisor tem acesso total automaticamente e não aparece na matriz.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> Novo cargo
        </Button>
      </div>

      {customRoles.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Cargos customizados</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {customRoles.map(r => (
              <div key={r.id} className="flex items-center gap-2 border rounded-md pl-2 pr-1 py-1">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: r.color }} />
                <span className="text-sm font-medium">{r.name}</span>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(r)}>
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => setToDelete(r)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Matriz de permissões</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 bg-background text-left p-2 border-b min-w-[180px]">Cargo</th>
                {PERMISSION_GROUPS.map(g => (
                  <th key={g.label} colSpan={g.items.length} className="p-2 border-b border-l text-center bg-muted/50">
                    {g.label}
                  </th>
                ))}
              </tr>
              <tr>
                <th className="sticky left-0 bg-background border-b p-2 text-left">
                  <span className="text-xs text-muted-foreground">Item</span>
                </th>
                {PERMISSION_GROUPS.map(g => g.items.map((it, idx) => (
                  <th
                    key={it.key}
                    className={`p-2 border-b text-xs font-normal text-muted-foreground align-bottom ${idx === 0 ? 'border-l' : ''}`}
                    style={{ minWidth: 90 }}
                  >
                    <div className="rotate-[-40deg] origin-bottom-left whitespace-nowrap translate-y-1">
                      {it.label}
                    </div>
                  </th>
                )))}
              </tr>
            </thead>
            <tbody>
              {allRoles.map(role => (
                <tr key={role.key} className="hover:bg-muted/30">
                  <td className="sticky left-0 bg-background border-b p-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: role.color }} />
                      <span className="font-medium">{role.label}</span>
                      {role.isCustom && <Badge variant="outline" className="text-[10px]">custom</Badge>}
                    </div>
                    <div className="mt-1 flex gap-1">
                      <button
                        className="text-[10px] text-primary hover:underline"
                        onClick={() => toggleAll(role.key, ALL_PERMISSIONS.map(p => p.key), true)}
                      >tudo</button>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <button
                        className="text-[10px] text-muted-foreground hover:underline"
                        onClick={() => toggleAll(role.key, ALL_PERMISSIONS.map(p => p.key), false)}
                      >nada</button>
                    </div>
                  </td>
                  {PERMISSION_GROUPS.map(g => g.items.map((it, idx) => (
                    <td key={it.key} className={`border-b p-2 text-center ${idx === 0 ? 'border-l' : ''}`}>
                      <Checkbox
                        checked={isAllowed(role.key, it.key)}
                        onCheckedChange={(v) => setAllowed(role.key, it.key, !!v)}
                      />
                    </td>
                  )))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground mt-3">
            Dica: marque um item para liberar o acesso àquele menu/submenu para o cargo selecionado.
            Enquanto não configurado, o comportamento padrão é liberar (para não travar usuários existentes).
          </p>
        </CardContent>
      </Card>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar cargo' : 'Novo cargo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Nome</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">Descrição</label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">Cor</label>
              <Input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="w-20 h-10 p-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancelar</Button>
            <Button onClick={handleSubmit}>{editing ? 'Salvar' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        title="Excluir cargo"
        description={`Deseja excluir o cargo "${toDelete?.name}"? Usuários com este cargo perderão a vinculação.`}
        onConfirm={async () => {
          if (toDelete) await deleteRole(toDelete.id);
          setToDelete(null);
        }}
      />
    </div>
  );
}
