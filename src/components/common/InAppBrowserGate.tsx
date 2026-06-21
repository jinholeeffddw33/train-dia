'use client';

import { useState, useCallback } from 'react';
import { Compass, ExternalLink } from 'lucide-react';
import { useInAppBrowser, openInChrome } from '@/hooks/useInAppBrowser';
import styles from './InAppBrowserGate.module.css';

const DISMISS_KEY = 'dia-inapp-dismiss';

/**
 * 카톡/페북/네이버 등 인앱 브라우저로 진입했을 때
 * 외부 브라우저(Chrome/Safari)로 다시 열도록 유도하는 게이트.
 * - Android: 버튼 누르면 intent:// 로 Chrome 호출
 * - iOS: 버튼 누르면 googlechromes:// 시도 → 미설치 시 URL 복사 + 안내
 * - 사용자가 "그냥 계속 보기"를 누르면 세션 동안 닫힘
 */
export default function InAppBrowserGate() {
  const { ready, inApp, isIOS } = useInAppBrowser();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  });
  const [iosFallback, setIosFallback] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleOpenChrome = useCallback(() => {
    if (isIOS) {
      // iOS는 Chrome 스킴 호출 — 미설치면 아무 반응 없음. 호출 직후 폴백 안내 표시.
      openInChrome();
      // 1초 뒤 폴백 안내(URL 복사 + Safari 안내) 노출
      window.setTimeout(() => setIosFallback(true), 1000);
    } else {
      openInChrome();
    }
  }, [isIOS]);

  const handleDismiss = useCallback(() => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  }, []);

  const handleCopy = useCallback(async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // 폴백: textarea 선택 방식
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } catch {
        // 무시
      }
      document.body.removeChild(ta);
    }
  }, []);

  if (!ready || !inApp || dismissed) return null;

  const currentUrl =
    typeof window !== 'undefined'
      ? `${window.location.host}${window.location.pathname}${window.location.search}`
      : '';

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="inapp-gate-title"
    >
      <div className={styles.panel}>
        <div className={styles.iconBox} aria-hidden="true">
          <Compass size={44} strokeWidth={2.2} />
        </div>

        <h1 id="inapp-gate-title" className={styles.title}>
          여기서는 앱이 잘 안 열려요
        </h1>

        <p className={styles.desc}>
          지금 <span className={styles.descStrong}>카톡·네이버·페이스북 안</span>에서
          열려 있어서<br />
          기관사 DIA가 제대로 작동하지 않아요.
          <br />
          <span className={styles.descStrong}>
            {isIOS ? 'Safari 또는 Chrome' : 'Chrome'}
          </span>
          으로 열어주세요.
        </p>

        {!iosFallback && (
          <>
            <button
              type="button"
              className={`z-cta ${styles.cta}`}
              onClick={handleOpenChrome}
              data-press
            >
              <ExternalLink size={22} strokeWidth={2.4} />
              {isIOS ? 'Chrome 앱으로 열기' : 'Chrome으로 바로 열기'}
            </button>

            <div className={styles.helperRow}>
              <p className={styles.helperText}>
                {isIOS
                  ? '버튼을 눌러도 안 열리면 아래 방법을 따라주세요.'
                  : '버튼을 누르면 Chrome 앱이 자동으로 열려요.'}
              </p>
              <button
                type="button"
                className={styles.helperBtn}
                onClick={handleDismiss}
              >
                그냥 여기서 계속 볼게요
              </button>
            </div>
          </>
        )}

        {iosFallback && (
          <>
            <p className={styles.note}>
              <span className={styles.noteTitle}>Chrome 앱이 없으신가요?</span>
              아래 주소를 복사해서 <strong>Safari</strong> 주소창에 붙여넣으세요.
            </p>

            <div className={styles.urlBox}>
              <span className={styles.urlText}>{currentUrl}</span>
              <button type="button" className={`z-glass-pill ${styles.copyBtn}`} onClick={handleCopy} data-press>
                {copied ? '복사됨' : '복사'}
              </button>
            </div>

            <ol className={styles.steps}>
              <li className={styles.step}>
                <span className={styles.stepNum}>1</span>
                <div className={styles.stepText}>
                  <strong>오른쪽 위 메뉴(···)</strong>를 눌러주세요
                  <span className={styles.sub}>화면 오른쪽 위 점 세 개 아이콘</span>
                </div>
              </li>
              <li className={styles.step}>
                <span className={styles.stepNum}>2</span>
                <div className={styles.stepText}>
                  <strong>&quot;Safari로 열기&quot;</strong>를 선택하세요
                  <span className={styles.sub}>또는 &quot;다른 브라우저로 열기&quot;</span>
                </div>
              </li>
            </ol>

            <div className={styles.helperRow}>
              <button
                type="button"
                className={styles.helperBtn}
                onClick={handleDismiss}
              >
                그냥 여기서 계속 볼게요
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
