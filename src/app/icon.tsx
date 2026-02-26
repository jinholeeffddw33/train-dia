import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
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
          borderRadius: 96,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              fontSize: 200,
              lineHeight: 1,
            }}
          >
            🚇
          </div>
          <div
            style={{
              fontSize: 80,
              fontWeight: 900,
              color: '#3B82F6',
              letterSpacing: -2,
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
