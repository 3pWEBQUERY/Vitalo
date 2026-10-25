/**
 * Daily weigh-ins scatter while the trend stays calm, followed by a forecast drawn as a range.
 * Animated on reveal: points appear, then the trend draws itself, then the forecast band.
 */
const DAYS = 42;
const AHEAD = 14;
const W = 640;
const H = 280;
const P = { l: 8, r: 8, t: 20, b: 20 };
const MIN = 71.2;
const MAX = 75.6;

const trendAt = (i: number) => 74.4 - i * 0.05;
const days = Array.from({ length: DAYS }, (_, i) => ({
  i,
  w: trendAt(i) + Math.sin(i * 1.7) * 0.45 + Math.cos(i * 0.9) * 0.3 + ((i * 37) % 11) / 22 - 0.25,
}));
const ahead = Array.from({ length: AHEAD }, (_, k) => DAYS - 1 + k);

const x = (i: number) => P.l + (i / (DAYS + AHEAD - 2)) * (W - P.l - P.r);
const y = (v: number) => P.t + (1 - (v - MIN) / (MAX - MIN)) * (H - P.t - P.b);
const line = (points: [number, number][]) => points.map(([px, py], k) => `${k ? "L" : "M"}${px.toFixed(1)} ${py.toFixed(1)}`).join(" ");

const trend = line(days.map((d) => [x(d.i), y(trendAt(d.i))]));
const forecast = line(ahead.map((i) => [x(i), y(trendAt(i))]));
const spread = (i: number) => 0.12 + (i - DAYS + 1) * 0.05;
const band = `${line(ahead.map((i) => [x(i), y(trendAt(i) + spread(i))]))} ${ahead
  .slice()
  .reverse()
  .map((i) => `L${x(i).toFixed(1)} ${y(trendAt(i) - spread(i)).toFixed(1)}`)
  .join(" ")} Z`;

export function TrendChart() {
  return (
    <figure className="trend-chart" data-reveal>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Beispiel: tägliche Messungen schwanken, der Trend sinkt gleichmässig und die Prognose zeigt einen Bereich">
        {[72, 73, 74, 75].map((v) => (
          <g key={v}>
            <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} className="grid" />
            <text x={W - P.r} y={y(v) - 6} className="axis" textAnchor="end">{v} kg</text>
          </g>
        ))}
        <path d={band} className="band" />
        {days.map((d) => (
          <circle key={d.i} cx={x(d.i)} cy={y(d.w)} r={3.2} className="dot" style={{ "--i": d.i } as React.CSSProperties} />
        ))}
        <path d={trend} className="trend" pathLength={1} />
        <path d={forecast} className="forecast" />
      </svg>
      <figcaption>
        <span><i className="key key-dot" />Tägliche Messung</span>
        <span><i className="key key-line" />Trend</span>
        <span><i className="key key-band" />Prognose als Bereich</span>
      </figcaption>
    </figure>
  );
}
