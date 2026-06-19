import { useEffect, useState } from 'react';
import { fetchTagsForRecords, FinanceTag, TagEntity } from './useFinanceTags';

/** Loads tag mappings for a list of records and refreshes when ids change. */
export function useRecordTags(entity: TagEntity, recordIds: string[], refreshKey?: any) {
  const [tagsMap, setTagsMap] = useState<Record<string, FinanceTag[]>>({});
  const key = recordIds.join(',');
  useEffect(() => {
    let cancelled = false;
    if (recordIds.length === 0) { setTagsMap({}); return; }
    fetchTagsForRecords(entity, recordIds)
      .then(m => { if (!cancelled) setTagsMap(m); })
      .catch(() => { if (!cancelled) setTagsMap({}); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, key, refreshKey]);
  return tagsMap;
}

/** Small inline badge list for table cells. */
export { default as TagBadges } from '@/components/finance/TagBadges';
