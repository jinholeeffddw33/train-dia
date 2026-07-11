'use client';

import { useState, useCallback, useEffect } from 'react';
import { Star } from 'lucide-react';
import { useCommuteStore } from '@/stores/commute';
import Modal from '@/components/common/Modal';
import { showToast } from '@/components/common/Toast';
import StationArrivals from './StationArrivals';
import styles from '../styles/Commute.module.css';

const POPULAR_STATIONS = [
  '답십리', '왕십리', '광화문', '여의도', '공덕',
  '종로3가', '천호', '강동', '마천', '하남검단산',
];

export default function CommuteOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { favorites, addFavorite, removeFavorite } = useCommuteStore();
  const [search, setSearch] = useState('');
  const [selectedStation, setSelectedStation] = useState<string | null>(null);
  // 전체 지하철 역 자동완성 결과 (ODsay searchStation)
  const [results, setResults] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);

  // 역 이름 검색 — 인기역 10개만이 아니라 전체 지하철 역을 ODsay 로 조회(디바운스)
  useEffect(() => {
    const q = search.trim();
    if (!q) { setResults([]); setSearching(false); return; }
    let active = true;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/odsay/search-station?name=${encodeURIComponent(q)}`,
          { signal: AbortSignal.timeout(8000) },
        );
        if (!active) return;
        const data = res.ok ? await res.json() : null;
        // 같은 이름(노선/출구별 중복) 제거 — 도착정보는 이름 기준
        const names: string[] = data
          ? Array.from(new Set((data.stations ?? []).map((s: { name: string }) => s.name)))
          : [];
        setResults(names.slice(0, 15));
      } catch {
        if (active) setResults([]);
      } finally {
        if (active) setSearching(false);
      }
    }, 300);
    return () => { active = false; clearTimeout(t); };
  }, [search]);

  const handleSelectStation = useCallback((station: string) => {
    setSelectedStation(station);
    setSearch('');
    setResults([]);
  }, []);

  return (
    <Modal open={open} onClose={onClose} title="출퇴근 도착 정보">
      <div className={styles.container}>
        {/* 검색 */}
        <input
          type="search"
          className={styles.searchInput}
          placeholder="역 이름으로 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          enterKeyHint="search"
          aria-label="역 이름 검색"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />

        {/* 선택된 역 도착 정보 */}
        {selectedStation && (
          <StationArrivals
            station={selectedStation}
            onClose={() => setSelectedStation(null)}
            isFavorite={favorites.includes(selectedStation)}
            onToggleFavorite={() => {
              if (favorites.includes(selectedStation)) {
                removeFavorite(selectedStation);
                showToast('즐겨찾기에서 뺐어요', 'info');
              } else {
                addFavorite(selectedStation);
                showToast('즐겨찾기에 추가했어요', 'success');
              }
            }}
          />
        )}

        {/* 즐겨찾기 — 검색 중이 아닐 때만 */}
        {!selectedStation && !search && favorites.length > 0 && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>즐겨찾기</h3>
            <div className={styles.stationList}>
              {favorites.map((station) => (
                <button
                  key={station}
                  type="button"
                  className={styles.stationBtn}
                  onClick={() => handleSelectStation(station)}
                >
                  <Star size={16} fill="currentColor" className={styles.starIcon} />
                  <span>{station}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* 주요 역 / 검색 결과 */}
        {!selectedStation && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>
              {search ? '검색 결과' : '주요 역'}
            </h3>

            {!search ? (
              <div className={styles.stationList}>
                {POPULAR_STATIONS.map((station) => (
                  <button
                    key={station}
                    type="button"
                    className={styles.stationBtn}
                    onClick={() => handleSelectStation(station)}
                  >
                    <span>{station}</span>
                  </button>
                ))}
              </div>
            ) : searching && results.length === 0 ? (
              <p className={styles.searchHint}>역을 찾고 있어요...</p>
            ) : results.length > 0 ? (
              <div className={styles.stationList}>
                {results.map((station) => (
                  <button
                    key={station}
                    type="button"
                    className={styles.stationBtn}
                    onClick={() => handleSelectStation(station)}
                  >
                    <span>{station}</span>
                  </button>
                ))}
              </div>
            ) : (
              // 자동완성 결과가 없어도 입력한 이름 그대로 도착정보 조회(막다른 길 방지)
              <button
                type="button"
                className={styles.stationBtn}
                onClick={() => handleSelectStation(search.trim())}
              >
                <span>「{search.trim()}」 도착정보 보기</span>
              </button>
            )}
          </section>
        )}
      </div>
    </Modal>
  );
}
