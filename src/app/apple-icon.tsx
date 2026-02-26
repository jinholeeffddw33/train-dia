import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0F172A',
          borderRadius: 36,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <div style={{ fontSize: 72, lineHeight: 1 }}>🚇</div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 900,
              color: '#3B82F6',
              letterSpacing: -1,
            }}
          >
            DIA
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
