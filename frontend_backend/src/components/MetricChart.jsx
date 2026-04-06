import { useMemo } from 'react';

function MetricChart({
  title,
  data = [],
  timestamps = [],
  color = 'blue',
  height = 220,
  minValue,
  maxValue,
  unit,
}) {
  const margin = { top: 22, right: 18, bottom: 38, left: 46 };

  const stats = useMemo(() => {
    if (data.length === 0) {
      const min = minValue ?? 0;
      const max = maxValue ?? 100;
      return { min, max, range: max - min || 100 };
    }

    const rawMin = Math.min(...data);
    const rawMax = Math.max(...data);
    const range = rawMax - rawMin || 10;
    const min = minValue ?? Math.max(0, rawMin - range * 0.1);
    const max = maxValue ?? rawMax + range * 0.1;

    return { min, max, range: max - min };
  }, [data, maxValue, minValue]);

  const viewWidth = 520;
  const viewHeight = height;
  const graphWidth = viewWidth - margin.left - margin.right;
  const graphHeight = viewHeight - margin.top - margin.bottom;

  const points = useMemo(() => {
    if (data.length < 2) return [];

    const reversed = [...data].reverse();

    return reversed.map((val, i) => {
      const x = margin.left + (i / (reversed.length - 1)) * graphWidth;
      const y = margin.top + graphHeight - ((val - stats.min) / stats.range) * graphHeight;
      return { x, y, value: val };
    });
  }, [data, stats, graphWidth, graphHeight]);

  const bezierPath = useMemo(() => {
    if (points.length < 2) return '';

    let path = `M ${points[0].x},${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2 === points.length ? i + 1 : i + 2];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }

    return path;
  }, [points]);

  const yTicks = useMemo(() => {
    const ticks = [];
    const step = stats.range / 4;
    for (let i = 0; i <= 4; i++) {
      ticks.push(stats.min + step * i);
    }
    return ticks;
  }, [stats]);

  const xTicks = useMemo(() => {
    if (timestamps.length < 2) return [];
    const reversed = [...timestamps].reverse();
    const indices = [
      0,
      Math.floor(reversed.length / 3),
      Math.floor((reversed.length * 2) / 3),
      reversed.length - 1,
    ];

    return indices.map((idx) => ({
      label: reversed[idx]?.split('T')[1]?.slice(0, 8) || '--:--:--',
      x: margin.left + (idx / (reversed.length - 1)) * graphWidth,
    }));
  }, [timestamps, graphWidth]);

  const lastValue = data.length ? data[0] : '--';

  const palette = {
    blue: {
      stroke: 'var(--chart-blue-stroke)',
      area: 'var(--chart-blue-area)',
      text: 'text-theme-chart-blue',
      badge: 'border-sky-400/20 bg-sky-500/10 text-sky-100',
    },
    rose: {
      stroke: 'var(--chart-pink-stroke)',
      area: 'var(--chart-pink-area)',
      text: 'text-theme-chart-pink',
      badge: 'border-pink-400/20 bg-pink-500/10 text-pink-100',
    },
    amber: {
      stroke: 'var(--chart-yellow-stroke)',
      area: 'var(--chart-yellow-area)',
      text: 'text-theme-chart-yellow',
      badge: 'border-amber-400/20 bg-amber-500/10 text-amber-100',
    },
    emerald: {
      stroke: 'var(--chart-emerald-stroke)',
      area: 'var(--chart-emerald-area)',
      text: 'text-theme-chart-emerald',
      badge: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100',
    },
  }[color] || {
    stroke: '#94a3b8',
    area: 'rgba(148,163,184,0.10)',
    text: 'text-theme-muted',
    badge: 'border-white/10 bg-white/[0.04] text-white',
  };

  return (
    <div className="rounded-[30px] border border-white/10 bg-theme-panel/75 p-5 shadow-glow backdrop-blur-xl transition hover:border-white/15 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-theme-subtle">
            Signal trend
          </p>
          <h3 className={`mt-2 text-2xl font-semibold tracking-tight ${palette.text}`}>
            {title}
          </h3>
        </div>

        <div className={`inline-flex rounded-full border px-4 py-2 text-[10px] font-bold uppercase tracking-[0.22em] ${palette.badge}`}>
          Current: {lastValue} {unit || ''}
        </div>
      </div>

      <div className="mt-5 rounded-[24px] border border-white/8 bg-white/[0.025] p-3 sm:p-4">
        <svg width="100%" height={height} viewBox={`0 0 ${viewWidth} ${viewHeight}`} className="overflow-visible">
          <g stroke="rgba(255,255,255,0.08)" strokeDasharray="4 6">
            {yTicks.map((tick, i) => {
              const y = margin.top + graphHeight - (i / 4) * graphHeight;
              return <line key={i} x1={margin.left} y1={y} x2={margin.left + graphWidth} y2={y} />;
            })}

            {xTicks.map((tick, i) => (
              <line key={i} x1={tick.x} y1={margin.top} x2={tick.x} y2={margin.top + graphHeight} />
            ))}
          </g>

          <g className="fill-theme-subtle text-[10px]" fontFamily="monospace">
            {yTicks.map((tick, i) => {
              const y = margin.top + graphHeight - (i / 4) * graphHeight;
              return (
                <text key={i} x={margin.left - 8} y={y + 4} textAnchor="end">
                  {Math.round(tick)}
                </text>
              );
            })}
          </g>

          <g className="fill-theme-subtle text-[9px]" fontFamily="monospace">
            {xTicks.map((tick, i) => (
              <text key={i} x={tick.x} y={viewHeight - 6} textAnchor="middle">
                {tick.label}
              </text>
            ))}
          </g>

          {bezierPath ? (
            <>
              <path
                d={`${bezierPath} L ${margin.left + graphWidth},${margin.top + graphHeight} L ${margin.left},${margin.top + graphHeight} Z`}
                fill={palette.area}
              />
              <path
                d={bezierPath}
                fill="none"
                stroke={palette.stroke}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ filter: `drop-shadow(0 0 8px ${palette.stroke}44)` }}
              />
            </>
          ) : null}

          {points.length > 0 ? (
            <g>
              <circle
                cx={points[points.length - 1].x}
                cy={points[points.length - 1].y}
                r="4.5"
                fill={palette.stroke}
              />
              <circle
                cx={points[points.length - 1].x}
                cy={points[points.length - 1].y}
                r="10"
                fill="none"
                stroke={palette.stroke}
                opacity="0.32"
              />
            </g>
          ) : null}
        </svg>
      </div>
    </div>
  );
}

export default MetricChart;