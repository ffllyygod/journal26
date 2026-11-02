'use client';

import { useState, type PointerEvent } from 'react';
import type { EquityPoint } from '@/lib/analytics';
import { formatDate, money } from '@/lib/domain';

const WIDTH = 640;
const HEIGHT = 200;

/** Single-series cumulative P&L. The panel title names it, so there is no legend. */
export function EquityCurve({ points, currency }: { points: EquityPoint[]; currency: string }) {
  const [active, setActive] = useState<number | null>(null);
  if (points.length < 2)
    return <p className="muted chart-empty">The curve appears after two closed trades.</p>;
  const series = [{ index: 0, value: 0 }, ...points];
  const values = series.map(point => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;
  const x = (index: number) => (index / (series.length - 1)) * WIDTH;
  const y = (value: number) => HEIGHT - 8 - ((value - low) / span) * (HEIGHT - 16);
  const path = series
    .map((point, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)} ${y(point.value).toFixed(1)}`)
    .join(' ');
  const shown = active === null ? null : points[active];

  function onMove(event: PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    setActive(Math.max(0, Math.round(ratio * (series.length - 1)) - 1));
  }

  return (
    <figure className="equity">
      <div className="equity-axis" aria-hidden="true">
        <span>{money(high, currency)}</span>
        <span>{money(low, currency)}</span>
      </div>
      <div
        className="equity-plot"
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setActive(null)}
        role="img"
        aria-label={`Cumulative result over ${points.length} closed trades, ending at ${money(points[points.length - 1].value, currency)}. Each trade is listed in the trade log below.`}
      >
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
          <line
            className="equity-zero"
            x1="0"
            x2={WIDTH}
            y1={y(0)}
            y2={y(0)}
            vectorEffect="non-scaling-stroke"
          />
          <path className="equity-line" d={path} vectorEffect="non-scaling-stroke" />
          {active !== null && (
            <line
              className="equity-cross"
              x1={x(active + 1)}
              x2={x(active + 1)}
              y1="0"
              y2={HEIGHT}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {shown && active !== null && (
          <div
            className="equity-tip"
            style={{
              left: `${(x(active + 1) / WIDTH) * 100}%`,
              transform: `translateX(${active + 1 > series.length / 2 ? '-105%' : '5%'})`,
            }}
          >
            <strong>{money(shown.value, currency)}</strong>
            <span>
              Trade {shown.index}, {shown.label}
            </span>
            <span>{formatDate(shown.date, { month: 'short', day: 'numeric' })}</span>
          </div>
        )}
      </div>
    </figure>
  );
}
