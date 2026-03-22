import { useSwapStore } from '@/stores/swap';
import { getDia } from '@/lib/schedule';
import type { Person } from '@/lib/types';

/**
 * getDia를 호출하되, 해당 날짜에 교번변경이 있으면 swap 값을 반환
 */
export function useGetSwappedDia() {
  const swaps = useSwapStore((s) => s.swaps);

  return (person: Person, date: Date): string => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const swap = swaps[dateStr];
    if (swap) return swap.dia;
    return getDia(person, date);
  };
}
