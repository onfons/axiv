export const CATEGORIES = [
  { id: 'food',          label: '맛집',  icon: '🍴', color: '#10B981' },
  { id: 'cafe',          label: '카페',  icon: '☕', color: '#F59E0B' },
  { id: 'camping',       label: '캠핑',  icon: '⛺',  color: '#059669' },
  { id: 'fishing',       label: '낚시',  icon: '🎣', color: '#2563EB' },
  { id: 'travel',        label: '여행',  icon: '✈️', color: '#8B5CF6' },
  { id: 'accommodation', label: '숙소',  icon: '🏨', color: '#EC4899' },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];

export function getCategory(id: string) {
  return CATEGORIES.find((c) => c.id === id);
}

export function getCategoryIcon(id: string) {
  return getCategory(id)?.icon ?? '📍';
}

export function getCategoryColor(id: string) {
  return getCategory(id)?.color ?? '#6B7280';
}

export function getCategoryLabel(id: string) {
  return getCategory(id)?.label ?? id;
}