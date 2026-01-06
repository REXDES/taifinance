import { supabase } from "@/integrations/supabase/client";

export type AuditAction = 
  | 'invitation_created'
  | 'invitation_deleted'
  | 'company_created'
  | 'company_updated'
  | 'company_deleted'
  | 'user_role_updated'
  | 'user_removed'
  | 'user_permissions_updated';

export type EntityType = 
  | 'invitation'
  | 'company'
  | 'user'
  | 'user_role';

interface AuditLogEntry {
  action: AuditAction;
  entity_type: EntityType;
  entity_id?: string;
  details?: Record<string, unknown>;
  company_id?: string;
}

export const useAuditLog = () => {
  const logAction = async (entry: AuditLogEntry) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Using type assertion since audit_logs table was just created
      const { error } = await (supabase as any)
        .from('audit_logs')
        .insert({
          user_id: user.id,
          action: entry.action,
          entity_type: entry.entity_type,
          entity_id: entry.entity_id,
          details: entry.details,
          company_id: entry.company_id,
        });

      if (error) {
        console.error('Error logging audit action:', error);
      }
    } catch (error) {
      console.error('Error in audit log:', error);
    }
  };

  return { logAction };
};
