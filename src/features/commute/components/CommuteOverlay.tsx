'use client';

import { useState, useCallback } from 'react';
import { Star } from 'lucide-react';
import { useCommuteStore } from '@/stores/commute';
import Modal from '@/components/common/Modal';
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

  const handleSelectStation = useCallback((station: string) => {
    setSelectedStation(station);
    setSearch('');
  }, []);

  return (
    <Modal open={open} onClose={onClose} title="출퇴근 도착 정보">
      <div className={styles.container}>
        {/* 검색 */}
        <input
          type="text"
          className={styles.searchInput}
          placeholder="역 이름으로 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="역 이름 검색"
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
              } else {
                addFavorite(selectedStation);
              }
            }}
          />
        )}

        {/* 즐겨찾기 */}
        {!selectedStation && favorites.length > 0 && (
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

        {/* 인기 역 / 검색 결과 */}
        {!selectedStation && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>
              {search ? '검색 결과' : '주요 역'}
            </h3>
            <div className={styles.stationList}>
              {(search
                ? POPULAR_STATIONS.filter((s) => s.includes(search))
                : POPULAR_STATIONS
              ).map((station) => (
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
          </section>
        )}
      </div>
    </Modal>
  );
}
