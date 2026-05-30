'use client';

import { useState, useRef } from 'react';
import { Siren, AlertTriangle, Info } from 'lucide-react';
import { useHazardStore } from '@/stores/hazard';
import { useDriverStore } from '@/stores/driver';
import { useAuthStore } from '@/stores/auth';
import styles from './Hazard.module.css';

async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1280;
      const scale = img.width > MAX ? MAX / img.width : 1;
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          resolve(new File([blob!], 'photo.jpg', { type: 'image/jpeg' }));
        },
        'image/jpeg',
        0.82,
      );
    };
    img.src = url;
  });
}

export type HazardFormCardKey = 'incident' | 'driving' | 'train' | 'hazard';
type DataCategory = 'hazard' | 'action' | 'inspect';

interface KindOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface FormVariant {
  title: string;
  kinds?: readonly KindOption[];
  /** 분류를 역 드롭다운으로 표시 */
  stationPicker?: boolean;
  /** 분류를 편성번호(501-580) 드롭다운으로 표시 */
  trainPicker?: boolean;
  /** 심각도(위험/주의/알림) 선택 노출 */
  severityPicker?: boolean;
  showLocation: boolean;
  dataCategory: DataCategory;
}

interface SeverityOption {
  value: '위험' | '주의' | '알림';
  label: string;
  tone: 'red' | 'amber' | 'blue';
  icon: React.ReactNode;
}

const SEVERITY_OPTIONS: readonly SeverityOption[] = [
  { value: '위험', label: '위험', tone: 'red',   icon: <Siren        size={18} strokeWidth={2.2} /> },
  { value: '주의', label: '주의', tone: 'amber', icon: <AlertTriangle size={18} strokeWidth={2.2} /> },
  { value: '알림', label: '알림', tone: 'blue',  icon: <Info          size={18} strokeWidth={2.2} /> },
];

const INCIDENT_KINDS: readonly KindOption[] = [
  { value: '시설물', label: '시설물' },
  { value: '열차', label: '열차' },
  { value: '신호', label: '신호' },
];

/** 5호선 편성번호 501 ~ 580 (80개) */
const TRAIN_NUMBERS: readonly string[] = Array.from({ length: 80 }, (_, i) => String(501 + i));

/** 5호선 전체 역 (방화 → 하남검단산/마천 분기 순) */
const STATIONS: readonly string[] = [
  '방화', '개화산', '김포공항', '송정', '마곡', '발산', '우장산', '화곡',
  '까치산', '신정', '목동', '오목교', '양평', '영등포구청', '영등포시장',
  '신길', '여의도', '여의나루', '마포', '공덕', '애오개', '충정로',
  '서대문', '광화문', '종로3가', '을지로4가', '동대문역사문화공원', '청구',
  '신금호', '행당', '왕십리', '마장', '답십리', '장한평', '군자',
  '아차산', '광나루', '천호', '강동',
  '길동', '굽은다리', '명일', '고덕', '상일동', '강일', '미사',
  '하남풍산', '하남시청', '하남검단산',
  '둔촌동', '올림픽공원', '방이', '오금', '개롱', '거여', '마천',
];

const FORM_VARIANT: Record<HazardFormCardKey, FormVariant> = {
  incident: { title: '사고 사례 등록', kinds: INCIDENT_KINDS, showLocation: false, dataCategory: 'action'  },
  driving:  { title: '운전 정보 등록', kinds: INCIDENT_KINDS, showLocation: false, dataCategory: 'inspect' },
  train:    { title: '열차 정보 등록', trainPicker: true,     showLocation: false, dataCategory: 'inspect' },
  hazard:   { title: '위험개소 등록', stationPicker: true, severityPicker: true, showLocation: false, dataCategory: 'hazard'  },
};

interface HazardFormProps {
  onClose: () => void;
  cardKey: HazardFormCardKey;
}

export default function HazardForm({ onClose, cardKey }: HazardFormProps) {
  const variant = FORM_VARIANT[cardKey];
  const defaultKind = variant.kinds?.[0]?.value ?? '';
  const defaultStation = variant.stationPicker ? STATIONS[0] : '';
  const defaultTrain = variant.trainPicker ? TRAIN_NUMBERS[0] : '';

  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [titleText, setTitleText] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [kind, setKind] = useState<string>(defaultKind);
  const [station, setStation] = useState<string>(defaultStation);
  const [trainNo, setTrainNo] = useState<string>(defaultTrain);
  const [severity, setSeverity] = useState<SeverityOption['value']>('주의');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const createReport = useHazardStore((s) => s.createReport);
  const driverName = useDriverStore((s) => (s.myDriver)?.n ?? '');
  const driverSabun = useDriverStore((s) => (s.myDriver)?.s ?? '');
  const authName = useAuthStore((s) => s.user?.name ?? '');
  const authSabun = useAuthStore((s) => s.user?.sabun ?? '');
  const name = authName || driverName;
  const sabun = authSabun || driverSabun;

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    const compressed = await compressImage(file);
    setPhoto(compressed);
    setPreview(URL.createObjectURL(compressed));
  };

  const handleSubmit = async () => {
    if (!titleText.trim()) { setError('제목을 입력해주세요'); return; }
    if (!description.trim()) { setError('설명을 입력해주세요'); return; }
    if (!name || !sabun) { setError('기관사 정보를 먼저 설정해주세요'); return; }

    if (variant.stationPicker && !station) { setError('역을 선택해주세요'); return; }
    if (variant.trainPicker && !trainNo) { setError('편성을 선택해주세요'); return; }

    setSubmitting(true);
    setError('');
    try {
      let tag = '';
      if (variant.stationPicker) tag = station ? `${station}역` : '';
      else if (variant.trainPicker) tag = trainNo ? `${trainNo}편성` : '';
      else if (variant.kinds && kind) tag = kind;
      // 위험개소: 역 + 심각도 함께 표기 → [강동역·위험] 형식
      if (variant.severityPicker && tag) tag = `${tag}·${severity}`;
      else if (variant.severityPicker) tag = severity;
      const headline = tag ? `[${tag}] ${titleText.trim()}` : titleText.trim();
      const finalDescription = `${headline}\n${description.trim()}`;
      await createReport({
        photo,
        description: finalDescription,
        location: variant.showLocation ? location.trim() : '',
        name,
        sabun,
        category: variant.dataCategory,
      });
      if (preview) URL.revokeObjectURL(preview);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '등록에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.formWrap}>
      <h2 className={styles.formTitle}>{variant.title}</h2>

      {/* 사진 선택 */}
      <div
        className={`${styles.photoPickerArea} ${preview ? styles.photoPickerAreaFilled : ''}`}
        onClick={() => fileRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
        aria-label="사진 선택"
      >
        {preview ? (
          <img src={preview} alt="선택된 사진" className={styles.photoPreview} />
        ) : (
          <>
            <span className={styles.photoPickerIcon}>📷</span>
            <span className={styles.photoPickerLabel}>사진 촬영 / 선택</span>
            <span className={styles.photoPickerHint}>탭하여 사진을 추가하세요</span>
          </>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className={styles.hiddenInput}
        onChange={handlePhotoChange}
        aria-label="사진 파일 선택"
      />

      {/* 제목 (필수) */}
      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel} htmlFor="hazard-title">
          제목 <span className={styles.required}>*</span>
        </label>
        <input
          id="hazard-title"
          type="text"
          className={styles.textInput}
          placeholder="제목을 입력해주세요"
          value={titleText}
          onChange={(e) => setTitleText(e.target.value)}
          maxLength={60}
        />
        {variant.severityPicker && (
          <div className={styles.severityRow} role="radiogroup" aria-label="위험 정도">
            {SEVERITY_OPTIONS.map((s) => (
              <button
                key={s.value}
                type="button"
                role="radio"
                aria-checked={severity === s.value}
                className={`${styles.severityBtn} ${styles[`severity_${s.tone}`]} ${severity === s.value ? styles.severityBtnActive : ''}`}
                onClick={() => setSeverity(s.value)}
              >
                <span className={styles.severityIcon}>{s.icon}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 분류 — variant.kinds (버튼 행) 또는 variant.stationPicker (역) / variant.trainPicker (편성) */}
      {variant.kinds && (
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>
            분류 <span className={styles.required}>*</span>
          </label>
          <div className={styles.kindRow}>
            {variant.kinds.map((k) => (
              <button
                key={k.value}
                type="button"
                className={`${styles.kindBtn} ${kind === k.value ? styles.kindBtnActive : ''}`}
                onClick={() => setKind(k.value)}
              >
                {k.icon && <span className={styles.kindBtnIcon}>{k.icon}</span>}
                {k.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {variant.stationPicker && (
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor="hazard-station">
            분류 (역) <span className={styles.required}>*</span>
          </label>
          <select
            id="hazard-station"
            className={styles.textInput}
            value={station}
            onChange={(e) => setStation(e.target.value)}
          >
            {STATIONS.map((s) => (
              <option key={s} value={s}>{s}역</option>
            ))}
          </select>
        </div>
      )}
      {variant.trainPicker && (
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor="hazard-train">
            편성 <span className={styles.required}>*</span>
          </label>
          <select
            id="hazard-train"
            className={styles.textInput}
            value={trainNo}
            onChange={(e) => setTrainNo(e.target.value)}
          >
            <option value="전">전편성</option>
            {TRAIN_NUMBERS.map((n) => (
              <option key={n} value={n}>{n}편성</option>
            ))}
          </select>
        </div>
      )}

      {/* 위치 (variant.showLocation일 때만) */}
      {variant.showLocation && (
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor="hazard-location">위치 (선택)</label>
          <input
            id="hazard-location"
            type="text"
            className={styles.textInput}
            placeholder="예: 신답 → 용두 구간, 4번 선로"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={100}
          />
        </div>
      )}

      {/* 설명 (필수) */}
      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel} htmlFor="hazard-desc">
          설명 <span className={styles.required}>*</span>
        </label>
        <textarea
          id="hazard-desc"
          className={styles.textArea}
          placeholder="내용을 입력해주세요"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={500}
        />
        <span className={styles.charCount}>{description.length}/500</span>
      </div>

      {error && <p className={styles.errorText}>{error}</p>}

      <button
        type="button"
        className={styles.submitBtn}
        onClick={handleSubmit}
        disabled={submitting}
      >
        {submitting ? '등록 중...' : '등록하기'}
      </button>
    </div>
  );
}
