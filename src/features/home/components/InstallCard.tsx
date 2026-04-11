'use client';

import { useState, useEffect, useCallback } from 'react';
import { Smartphone, X, Share, Plus } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import styles from '../styles/Home.module.css';

const DISMISS_KEY = 'dia-install-dismiss';
const DISMISS_DAYS = 3;

export default function InstallCard() {
  const { canInstall, isInstalled, isIOS, isAndroid, install } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(true); // 초기 true로 깜빡임 방지
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    if (isInstalled) return;
    const raw = localStorage.getItem(DISMISS_KEY);
    if (raw) {
      const until = parseInt(raw, 10);
      if (Date.now() < until) return; // 아직 숨기는 기간
    }
    setDismissed(false);
  }, [isInstalled]);

  const handleDismiss = useCallback(() => {
    const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISS_KEY, String(until));
    setDismissed(true);
  }, []);

  const handleInstall = useCallback(() => {
    if (canInstall) {
      install();
    } else {
      setGuideOpen(true);
    }
  }, [canInstall, install]);

  // 설치됨 or 숨김 기간 or 지원 안 함
  if (isInstalled || dismissed) return null;
  if (!canInstall && !isIOS && !isAndroid) return null;

  return (
    <>
      <div className={styles.installCard}>
        <button
          type="button"
          className={styles.installCardClose}
          onClick={handleDismiss}
          aria-label="닫기"
        >
          <X size={18} />
        </button>
        <div className={styles.installCardIcon}>
          <Smartphone size={28} />
        </div>
        <div className={styles.installCardBody}>
          <h3 className={styles.installCardTitle}>앱처럼 바로 열기</h3>
          <p className={styles.installCardDesc}>
            홈 화면에 추가하면 매번 주소를 입력하지 않아도 돼요
          </p>
          <button
            type="button"
            className={styles.installCardBtn}
            onClick={handleInstall}
          >
            홈 화면에 추가하기
          </button>
        </div>
      </div>

      {/* iOS/Android 설치 안내 모달 */}
      {guideOpen && (
        <div
          className={styles.installGuideOverlay}
          onClick={() => setGuideOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="홈 화면에 추가 안내"
        >
          <div className={styles.installGuidePanel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.installGuideHeader}>
              <h3 className={styles.installGuideTitle}>홈 화면에 추가</h3>
              <button
                type="button"
                className={styles.installGuideClose}
                onClick={() => setGuideOpen(false)}
                aria-label="닫기"
              >
                <X size={22} />
              </button>
            </div>

            {isIOS ? (
              <div className={styles.installGuideBody}>
                <p className={styles.installGuideDesc}>
                  Safari에서 홈 화면에 추가하면 앱처럼 바로 열 수 있어요.
                </p>
                <ol className={styles.installSteps}>
                  <li className={styles.installStep}>
                    <span className={styles.installStepNum}>1</span>
                    <div>
                      <strong>Safari 하단 공유 버튼</strong> 탭
                      <span className={styles.installStepSub}>
                        <Share size={14} /> 화면 아래 가운데 아이콘
                      </span>
                    </div>
                  </li>
                  <li className={styles.installStep}>
                    <span className={styles.installStepNum}>2</span>
                    <div>
                      <strong>홈 화면에 추가</strong> 선택
                      <span className={styles.installStepSub}>
                        <Plus size={14} /> 목록을 아래로 스크롤하면 보여요
                      </span>
                    </div>
                  </li>
                  <li className={styles.installStep}>
                    <span className={styles.installStepNum}>3</span>
                    <div>
                      <strong>오른쪽 상단 추가</strong> 탭
                      <span className={styles.installStepSub}>이름은 그대로 두면 돼요</span>
                    </div>
                  </li>
                </ol>
                <p className={styles.installGuideTip}>
                  설치 후에는 주소창 없이 앱처럼 실행돼요
                </p>
              </div>
            ) : (
              <div className={styles.installGuideBody}>
                <p className={styles.installGuideDesc}>
                  네이버 앱 등에서는 설치가 안 돼요.
                  <br />
                  크롬(Chrome) 앱에서 열면 설치할 수 있어요.
                </p>
                <ol className={styles.installSteps}>
                  <li className={styles.installStep}>
                    <span className={styles.installStepNum}>1</span>
                    <div>
                      <strong>아래 버튼</strong>으로 크롬에서 열기
                      <span className={styles.installStepSub}>크롬이 없으면 Play 스토어에서 설치</span>
                    </div>
                  </li>
                  <li className={styles.installStep}>
                    <span className={styles.installStepNum}>2</span>
                    <div>
                      <strong>하단 설치 배너</strong> 탭
                      <span className={styles.installStepSub}>&quot;홈 화면에 추가&quot; 또는 &quot;앱 설치&quot; 버튼</span>
                    </div>
                  </li>
                </ol>
                <button
                  type="button"
                  className={styles.installChromeBtn}
                  onClick={() => {
                    const { host, pathname, search } = window.location;
                    window.location.href = `intent://${host}${pathname}${search}#Intent;scheme=https;package=com.android.chrome;end`;
                  }}
                >
                  크롬으로 열기
                </button>
                <p className={styles.installGuideTip}>
                  크롬에서 설치하면 앱처럼 바로 실행돼요
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
