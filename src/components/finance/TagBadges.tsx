import { Badge } from '@/components/ui/badge';
import { FinanceTag } from '@/hooks/useFinanceTags';

interface Props { tags?: FinanceTag[]; className?: string }

export default function TagBadges({ tags, className }: Props) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-1 ${className || ''}`}>
      {tags.map(t => (
        <Badge
          key={t.id}
          variant="outline"
          className="text-[10px] px-1.5 py-0 border-0 font-medium"
          style={{ backgroundColor: `${t.color}22`, color: t.color }}
        >
          {t.name}
        </Badge>
      ))}
    </div>
  );
}
