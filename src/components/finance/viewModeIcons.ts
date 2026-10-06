import { BarChart3, LayoutGrid, LayoutList, type LucideIcon } from 'lucide-react';
import type { ViewMode } from '@/lib/viewMode';

export const VIEW_MODE_ICON: Record<ViewMode, LucideIcon> = {
  visual: LayoutGrid,
  balanced: LayoutList,
  detailed: BarChart3,
};
