import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  FileUp,
  FileText,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Paperclip,
} from 'lucide-react';
import { toast } from 'sonner';
import type { SimulationData } from './SimulationStep';

type Formalization = {
  id: string;
  pdf_url: string | null;
  invoice_url: string | null;
  invoice_name: string | null;
  contract_file_url: string | null;
  contract_file_name: string | null;
};

type DocKind = 'invoice' | 'contract';

const ACCEPT = '.pdf,image/*,.doc,.docx';

export function FormalizationStep({
  applicationId,
  companyId,
  pendingSimulation,
  onCompleted,
}: {
  applicationId: string;
  companyId: string;
  pendingSimulation: SimulationData | null;
  onCompleted: () => void;
}) {
  const [row, setRow] = useState<Formalization | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<DocKind | 'conclude' | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('credit_contracts')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setRow(data);
    setLoading(false);
  }, [applicationId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  /** Garante que a operação exista no histórico (dados confirmados na Simulação). */
  const ensureRow = useCallback(async (): Promise<Formalization> => {
    if (row) return row;
    if (!pendingSimulation) {
      throw new Error('Volte à etapa Simulação e confirme os dados antes de formalizar.');
    }
    const { data, error } = await (supabase as any)
      .from('credit_contracts')
      .insert({
        application_id: applicationId,
        company_id: companyId,
        principal_amount: pendingSimulation.principal,
        num_parcelas: pendingSimulation.num_parcelas,
        juros_mensal_pct: pendingSimulation.juros_mensal_pct,
        parcela_amount: pendingSimulation.parcela_amount,
        total_amount: pendingSimulation.total_amount,
        first_due_date: pendingSimulation.first_due_date,
        description: pendingSimulation.description,
        contract_status: 'active',
      })
      .select()
      .single();
    if (error) throw error;
    setRow(data);
    return data;
  }, [row, pendingSimulation, applicationId, companyId]);

  const upload = async (kind: DocKind, file: File) => {
    setBusy(kind);
    try {
      const current = await ensureRow();
      const safeName = (file.name.replace(/[^\w.\-]+/g, '_').slice(0, 60) || 'arquivo');
      const path = `${companyId}/formalization/${applicationId}/${kind}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await (supabase as any).storage
        .from('credit-documents')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const patch =
        kind === 'invoice'
          ? { invoice_url: path, invoice_name: file.name }
          : { contract_file_url: path, contract_file_name: file.name };
      const { error: dbError } = await (supabase as any)
        .from('credit_contracts')
        .update(patch)
        .eq('id', current.id);
      if (dbError) throw dbError;

      toast.success(kind === 'invoice' ? 'Nota fiscal anexada' : 'Contrato anexado');
      await refetch();
    } catch (e: any) {
      toast.error('Não foi possível anexar o arquivo: ' + (e?.message || 'erro desconhecido'));
    } finally {
      setBusy(null);
    }
  };

  const openFile = async (path: string) => {
    const { data } = await (supabase as any).storage
      .from('credit-documents')
      .createSignedUrl(path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    else toast.error('Não foi possível abrir o arquivo');
  };

  const removeFile = async (kind: DocKind) => {
    if (!row) return;
    const path = kind === 'invoice' ? row.invoice_url : row.contract_file_url;
    if (!path) return;
    setBusy(kind);
    try {
      await (supabase as any).storage.from('credit-documents').remove([path]);
      const patch =
        kind === 'invoice'
          ? { invoice_url: null, invoice_name: null }
          : { contract_file_url: null, contract_file_name: null };
      const { error } = await (supabase as any)
        .from('credit_contracts')
        .update(patch)
        .eq('id', row.id);
      if (error) throw error;
      toast.success('Arquivo removido');
      await refetch();
    } catch (e: any) {
      toast.error('Não foi possível remover: ' + (e?.message || 'erro desconhecido'));
    } finally {
      setBusy(null);
    }
  };

  const conclude = async () => {
    setBusy('conclude');
    try {
      await ensureRow();
      onCompleted();
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível concluir a formalização');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="py-6 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  const attached = [row?.invoice_url, row?.contract_file_url].filter(Boolean).length;
  const canConclude = Boolean(row || pendingSimulation);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold">Formalização</h3>
        {attached > 0 ? (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
            <Paperclip className="w-3 h-3 mr-1" />
            {attached} de 2 anexados
          </Badge>
        ) : (
          <Badge variant="outline">Nenhum anexo (opcional)</Badge>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Anexe a nota fiscal e/ou o contrato da operação. Os dois são opcionais — é possível
        concluir sem enviar nada.
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        <DocSlot
          title="Nota fiscal"
          kind="invoice"
          url={row?.invoice_url ?? null}
          name={row?.invoice_name ?? null}
          busy={busy === 'invoice'}
          onPick={(file) => upload('invoice', file)}
          onOpen={openFile}
          onRemove={() => removeFile('invoice')}
        />
        <DocSlot
          title="Contrato"
          kind="contract"
          url={row?.contract_file_url ?? null}
          name={row?.contract_file_name ?? null}
          busy={busy === 'contract'}
          onPick={(file) => upload('contract', file)}
          onOpen={openFile}
          onRemove={() => removeFile('contract')}
        />
      </div>

      {row?.pdf_url && (
        <button
          onClick={() => openFile(row.pdf_url!)}
          className="flex w-full items-center gap-2 rounded border bg-muted/30 px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted/50"
        >
          <FileText className="w-3.5 h-3.5" />
          Contrato gerado pelo app nesta proposta — abrir
        </button>
      )}

      {!canConclude && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          A simulação ainda não foi confirmada. Volte à etapa Simulação para poder concluir.
        </p>
      )}

      <div className="flex justify-end">
        <Button onClick={conclude} disabled={busy === 'conclude' || !canConclude}>
          {busy === 'conclude' ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <CheckCircle2 className="w-4 h-4 mr-2" />
          )}
          Concluir formalização
        </Button>
      </div>
    </div>
  );
}

function DocSlot({
  title,
  kind,
  url,
  name,
  busy,
  onPick,
  onOpen,
  onRemove,
}: {
  title: string;
  kind: DocKind;
  url: string | null;
  name: string | null;
  busy: boolean;
  onPick: (file: File) => void;
  onOpen: (path: string) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{title}</span>
        <Badge variant="outline" className="text-[10px]">
          opcional
        </Badge>
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={ACCEPT}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = '';
        }}
      />

      {url ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded bg-muted/40 px-2 py-1.5">
            <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-xs" title={name || url}>
              {name || 'Arquivo anexado'}
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant="outline" onClick={() => onOpen(url)}>
              <ExternalLink className="w-3 h-3 mr-1" />
              Abrir
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
              {busy ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <FileUp className="w-3 h-3 mr-1" />}
              Trocar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={onRemove}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Remover
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded border border-dashed px-3 py-4 text-center">
          <p className="text-xs text-muted-foreground mb-2">Nenhum {title.toLowerCase()} enviada</p>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <FileUp className="w-3 h-3 mr-1" />}
            Selecionar arquivo
          </Button>
        </div>
      )}
      <span className="sr-only">{kind === 'invoice' ? 'nota fiscal' : 'contrato'}</span>
    </div>
  );
}
