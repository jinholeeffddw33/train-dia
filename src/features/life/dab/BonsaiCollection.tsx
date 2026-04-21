'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, Lock, Check, Sparkles } from 'lucide-react';
import { PLANTS, isUnlocked, unlockHint, currentSeason, type Plant } from './plants';
import { useBonsaiStore } from '@/stores/bonsai';
import styles from './dab.module.css';

interface BonsaiCollectionProps {
  onBack: () => void;
  onStartPlant: (id: Plant['id']) => void;
}

export default function BonsaiCollection({ onBack, onStartPlant }: BonsaiCollectionProps) {
  const { collection, currentPlantId, actionCounts } = useBonsaiStore();
  const season = currentSeason();

  return (
    <div className={styles.collectionWrap}>
      <div className={styles.bonsaiHeader}>
        <button type="button" className={styles.bonsaiBackBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <div className={styles.bonsaiHeaderCenter}>
          <span className={styles.bonsaiBrand}>COLLECTION</span>
          <span className={styles.bonsaiLevelText}>
            {collection.length}/{PLANTS.length} 완성
          </span>
        </div>
        <div style={{ width: 36 }} />
      </div>

      <div className={styles.collectionGrid}>
        {PLANTS.map((plant, i) => {
          const completed = collection.includes(plant.id);
          const unlocked = isUnlocked(plant, {
            collection: collection as string[],
            breathSessions: actionCounts.breath,
            season,
          });
          const isCurrent = currentPlantId === plant.id;

          return (
            <motion.button
              key={plant.id}
              type="button"
              className={`${styles.collectionCard} ${completed ? styles.completed : ''} ${!unlocked ? styles.locked : ''} ${isCurrent ? styles.current : ''}`}
              disabled={!unlocked}
              onClick={() => unlocked && onStartPlant(plant.id)}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.04 }}
            >
              <div
                className={styles.collectionIcon}
                style={{
                  background: unlocked
                    ? `linear-gradient(145deg, ${plant.leafColorAlt}, ${plant.leafColor})`
                    : 'linear-gradient(145deg, #94a3b8, #64748b)',
                }}
              >
                <span className={styles.collectionEmoji}>{plant.emoji}</span>
                {!unlocked && (
                  <span className={styles.collectionLock}>
                    <Lock size={14} />
                  </span>
                )}
                {completed && (
                  <span className={styles.collectionCheck}>
                    <Check size={14} />
                  </span>
                )}
              </div>
              <span className={styles.collectionName}>{unlocked ? plant.name : '???'}</span>
              <span className={styles.collectionTheme}>
                {unlocked ? plant.theme : unlockHint(plant)}
              </span>
              {isCurrent && (
                <span className={styles.collectionCurrent}>
                  <Sparkles size={10} /> 키우는 중
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
