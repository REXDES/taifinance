import { CompanySettingsContent } from './CompanySettingsDialog';

interface CompanySettingsPageProps {
  companyId: string | null;
  showPicker?: boolean; // se true, exibe lista de empresas para escolher (modo admin)
  showModulesTab?: boolean; // só admin/supervisor pode ver/alterar módulos
  onSaved?: () => void;
  onCancel?: () => void; // ação dos botões Fechar/Cancelar (volta à tela anterior)
}

/**
 * Versão em tela cheia das configurações da empresa (substitui o pop-up
 * "Gerenciar Empresa" quando aberto pelo menu lateral).
 */
export function CompanySettingsPage({ companyId, showPicker = false, showModulesTab = false, onSaved, onCancel }: CompanySettingsPageProps) {
  return (
    <div className="py-2">
      <CompanySettingsContent
        companyId={companyId}
        showPicker={showPicker}
        showModulesTab={showModulesTab}
        onSaved={onSaved}
        onCancel={onCancel}
        variant="page"
      />
    </div>
  );
}
