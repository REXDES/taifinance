import { ModuleKey, useModuleBranding } from '@/contexts/ModuleBrandingContext';
import { cn } from '@/lib/utils';

interface Props {
  module: ModuleKey;
  fallbackIcon?: React.ReactNode;
  showName?: boolean;
  className?: string;
  size?: number;
}

/** Logo + nome configurados do módulo (Configuração de Módulos). */
export function ModuleBrandMark({ module, fallbackIcon, showName = true, className, size = 16 }: Props) {
  const b = useModuleBranding().brand(module);
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)} style={b.color ? { color: b.color } : undefined}>
      {b.logo
        ? <img src={b.logo} alt="" style={{ width: size, height: size }} className="object-contain rounded-sm shrink-0" />
        : fallbackIcon}
      {showName && <span className="truncate">{b.name}</span>}
    </span>
  );
}
