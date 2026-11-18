import { useState } from 'react';
import type { TypingSessionRecord } from '../types';

interface ProgressChartProps {
  sessions: TypingSessionRecord[];
}

export function ProgressChart({ sessions }: ProgressChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (sessions.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '32px 12px' }}>
        Belum ada data sesi untuk ditampilkan pada grafik. Selesaikan latihan pertama Anda!
      </div>
    );
  }

  const width = 760;
  const height = 230;
  const padLeft = 42;
  const padRight = 42;
  const padTop = 20;
  const padBottom = 34;

  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxWpm = Math.max(40, Math.ceil(Math.max(...sessions.map((s) => s.wpm)) / 10) * 10 + 10);

  const wpmPoints = sessions.map((s, idx) => {
    const x =
      sessions.length === 1
        ? padLeft + plotW / 2
        : padLeft + (idx / (sessions.length - 1)) * plotW;
    const y = padTop + plotH - (s.wpm / maxWpm) * plotH;
    return { x, y, session: s };
  });

  const accPoints = sessions.map((s, idx) => {
    const x =
      sessions.length === 1
        ? padLeft + plotW / 2
        : padLeft + (idx / (sessions.length - 1)) * plotW;
    const y = padTop + plotH - (s.accuracy / 100) * plotH;
    return { x, y, session: s };
  });

  const wpmPath = wpmPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const accPath = accPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const wpmArea =
    wpmPoints.length >= 2
      ? `${wpmPoints[0].x.toFixed(1)},${padTop + plotH} ${wpmPath} ${wpmPoints[wpmPoints.length - 1].x.toFixed(1)},${padTop + plotH}`
      : '';

  const hovered = hoveredIdx !== null ? sessions[hoveredIdx] : null;

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 10 }}>
        <div className="row" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 99, background: '#f59e0b' }} />
            Kecepatan (WPM)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 99, background: '#10b981' }} />
            Akurasi (%)
          </span>
        </div>
        {hovered ? (
          <div className="mono" style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
            <span style={{ color: '#f59e0b', fontWeight: 700 }}>{hovered.wpm} WPM</span> •{' '}
            <span style={{ color: '#10b981', fontWeight: 700 }}>{hovered.accuracy}%</span> •{' '}
            <span style={{ color: 'var(--text-secondary)' }}>{hovered.language_native_name}</span>
          </div>
        ) : (
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Arahkan kursor ke titik untuk melihat detail sesi
          </span>
        )}
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <defs>
          <linearGradient id="progressWpmFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padTop + plotH * (1 - ratio);
          const wpmTick = Math.round(maxWpm * ratio);
          const accTick = Math.round(100 * ratio);
          return (
            <g key={ratio}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="rgba(148, 163, 184, 0.12)"
                strokeDasharray="4 4"
              />
              <text x={padLeft - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
                {wpmTick}
              </text>
              <text x={width - padRight + 8} y={y + 4} textAnchor="start" fontSize="10" fill="#6ee7b7">
                {accTick}%
              </text>
            </g>
          );
        })}

        {/* Area + Lines */}
        {wpmArea && <polygon points={wpmArea} fill="url(#progressWpmFill)" />}
        {accPoints.length >= 2 && (
          <polyline
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
            strokeDasharray="5 3"
            points={accPath}
          />
        )}
        {wpmPoints.length >= 2 && (
          <polyline
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={wpmPath}
          />
        )}

        {/* Interactive points */}
        {wpmPoints.map((pt, idx) => {
          const isHover = hoveredIdx === idx;
          return (
            <g
              key={pt.session.id}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ cursor: 'pointer' }}
            >
              {isHover && (
                <line
                  x1={pt.x}
                  y1={padTop}
                  x2={pt.x}
                  y2={padTop + plotH}
                  stroke="rgba(245, 158, 11, 0.35)"
                  strokeWidth="1.5"
                />
              )}
              <circle
                cx={accPoints[idx].x}
                cy={accPoints[idx].y}
                r={isHover ? 5 : 3.2}
                fill="#10b981"
              />
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isHover ? 6 : 4}
                fill="#f59e0b"
                stroke="#090d16"
                strokeWidth="1.5"
              />
              <circle cx={pt.x} cy={pt.y} r="14" fill="transparent" />
              <text
                x={pt.x}
                y={height - 10}
                textAnchor="middle"
                fontSize="10"
                fill="#64748b"
              >
                #{idx + 1}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
