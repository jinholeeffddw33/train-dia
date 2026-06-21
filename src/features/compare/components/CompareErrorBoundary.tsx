'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  message: string;
}

/** 교번비교 전용 Error Boundary — 손상된 데이터·예외로 화이트 화면 방지 */
export default class CompareErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(err: unknown): State {
    return { hasError: true, message: err instanceof Error ? err.message : '알 수 없는 오류' };
  }

  componentDidCatch(err: unknown) {
    // 로그만 남김 (생성)
    if (typeof console !== 'undefined') {
      console.error('[CompareErrorBoundary]', err);
    }
  }

  handleReset = () => {
    // 손상된 persist 데이터 초기화 후 다시 시도
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('dia-compare');
      }
    } catch { /* ignore */ }
    this.setState({ hasError: false, message: '' });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px 20px',
          textAlign: 'center',
          color: 'var(--dia-text-primary)',
        }}>
          <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            교번 비교를 불러올 수 없어요
          </p>
          <p style={{ fontSize: 14, color: 'var(--dia-text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
            저장된 비교 데이터가 손상된 것 같아요.<br />
            아래 버튼을 눌러 초기화하면 정상 동작합니다.
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            style={{
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 700,
              background: 'var(--dia-blue)',
              color: '#fff',
              border: 'none',
              borderRadius: 999,
              cursor: 'pointer',
              minHeight: 40,
            }}
          >
            비교 데이터 초기화
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
