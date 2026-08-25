import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useCustomRoles } from '@/hooks/useCustomRoles';
import { FinanceUserManagementDialog } from '@/components/dialogs/FinanceUserManagementDialog';
import { UserCog, Search, Users } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface AdminUserRow {
  user_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: AppRole;
  custom_role_id: string | null;
  companies: { id: string; name: string }[];
}

const roleLabels: Record<AppRole, string> = {
  supervisor: 'Supervisor',
  gerente: 'Gerente',
  operador: 'Operador',
};

export function AdminUsersPage() {
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const { toast } = useToast();
  const { roles: customRoles } = useCustomRoles();

  const load = async () => {
    setLoading(true);
    const [profilesRes, rolesRes, ucRes, compRes] = await Promise.all([
      supabase.from('profiles').select('user_id, email, full_name, avatar_url'),
      supabase.from('user_roles').select('user_id, role, custom_role_id') as any,
      supabase.from('user_companies').select('user_id, company_id'),
      supabase.from('companies').select('id, name'),
    ]);

    const companiesById = new Map((compRes.data || []).map((c: any) => [c.id, c.name]));
    const rolesByUser = new Map((rolesRes.data || []).map((r: any) => [r.user_id, r]));
    const compsByUser = new Map<string, { id: string; name: string }[]>();
    (ucRes.data || []).forEach((uc: any) => {
      const arr = compsByUser.get(uc.user_id) || [];
      const name = companiesById.get(uc.company_id);
      if (name) arr.push({ id: uc.company_id, name });
      compsByUser.set(uc.user_id, arr);
    });

    const merged: AdminUserRow[] = (profilesRes.data || []).map((p: any) => {
      const r = rolesByUser.get(p.user_id) as any;
      return {
        user_id: p.user_id,
        email: p.email,
        full_name: p.full_name,
        avatar_url: p.avatar_url,
        role: (r?.role as AppRole) || 'operador',
        custom_role_id: r?.custom_role_id ?? null,
        companies: compsByUser.get(p.user_id) || [],
      };
    });
    setRows(merged);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      (r.full_name || '').toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const initials = (name: string | null, email: string) =>
    name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : email.charAt(0).toUpperCase();

  const openEdit = (u: AdminUserRow) => setEditing(u);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6" /> Usuários
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Todos os usuários de todas as empresas. Edite perfil, cargo, limites de empresas/convites e acessos.
          </p>
        </div>
        <div className="relative w-72">
          <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por nome ou email…"
            className="pl-8"
          />
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{filtered.length} usuário(s)</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
          ) : (
            <div className="space-y-2">
              {filtered.map(u => (
                <div key={u.user_id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar>
                      <AvatarImage src={u.avatar_url || undefined} />
                      <AvatarFallback>{initials(u.full_name, u.email)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{u.full_name || u.email}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {u.companies.slice(0, 5).map(c => (
                          <Badge key={c.id} variant="outline" className="text-[10px]">{c.name}</Badge>
                        ))}
                        {u.companies.length > 5 && (
                          <Badge variant="outline" className="text-[10px]">+{u.companies.length - 5}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={u.role === 'supervisor' ? 'default' : u.role === 'gerente' ? 'secondary' : 'outline'}>
                      {roleLabels[u.role]}
                    </Badge>
                    {u.custom_role_id && (
                      <Badge variant="outline" className="text-[10px]">
                        {customRoles.find(r => r.id === u.custom_role_id)?.name || 'custom'}
                      </Badge>
                    )}
                    <Button size="sm" variant="outline" onClick={() => openEdit(u)}>
                      <UserCog className="w-4 h-4 mr-1" /> Gerenciar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {editing && (
        <FinanceUserManagementDialog
          open={!!editing}
          onOpenChange={(v) => {
            if (!v) {
              setEditing(null);
              load();
            }
          }}
          userId={editing.user_id}
          userName={editing.full_name || editing.email}
          userEmail={editing.email}
          userAvatar={editing.avatar_url}
          currentUserRole="supervisor"
        />
      )}

    </div>
  );
}
