/usr/bin/bash: warning: setlocale: LC_ALL: cannot change locale (ko_KR.UTF-8): No such file or directory
export const CATEGORIES = [
  { id: 'food',          label: '맛집',  icon: '🍴', color: '#EF4444' },
  { id: 'cafe',          label: '카페',  icon: '☕', color: '#F59E0B' },
  { id: 'camping',       label: '캠핑',  icon: '⛺',  color: '#10B981' },
  { id: 'fishing',       label: '낚시',  icon: '🎣', color: '#2563EB' },
  { id: 'travel',        label: '여행',  icon: '✈️', color: '#8B5CF6' },
  { id: 'accommodation', label: '숙소',  icon: '🏨', color: '#EC4899' },
  // 히든 카테고리 (향후 활성화 예정)
  // { id: 'popup',         label: '팝업',  icon: '🎪', color: '#F97316' },
  // { id: 'exhibition',    label: '전시',  icon: '🖼️', color: '#A855F7' },
  // { id: 'activity',      label: '액티비티', icon: '🎯', color: '#06B6D4' },
  // { id: 'drive',         label: '드라이브', icon: '🚗', color: '#14B8A6' },
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