import { useId } from "react";

export function RegistrationChart({ data, color = "#3d7a3d", height = 180, periodDays = data.length, labelCount = 2 }: { data: { label: string; count: number }[]; color?: string; height?: number; periodDays?: number; labelCount?: number }) {
  const gradient = useId().replace(/:/g, "");
  const width = 900, baseline = 150;
  const maximum = Math.max(1, ...data.map((day) => day.count));
  const points = data.map((day, index) => ({ x: 8 + index / Math.max(1, data.length - 1) * (width - 16), y: baseline - day.count / maximum * 130 }));
  // Horizontal tangents give a continuous curve without overshooting the counts.
  const curve = points.map((point, index) => {
    if (!index) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    const middle = (previous.x + point.x) / 2;
    return `C ${middle} ${previous.y}, ${middle} ${point.y}, ${point.x} ${point.y}`;
  }).join(" ");
  const labels = Array.from(new Set(Array.from({ length: Math.min(labelCount, data.length) }, (_, index) => Math.round(index * (data.length - 1) / Math.max(1, Math.min(labelCount, data.length) - 1)))));
  return <div>
    <svg role="img" aria-label={`Warranty registrations over the last ${periodDays} days`} viewBox={`0 0 ${width} 175`} style={{ display: "block", width: "100%", height }} preserveAspectRatio="none">
      <title>{data.map((day) => `${day.label}: ${day.count}`).join("; ")}</title>
      <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop stopColor={color} stopOpacity=".17"/><stop offset="1" stopColor={color} stopOpacity="0"/></linearGradient></defs>
      {[20, 85, 150].map((y) => <line key={y} x1="8" x2={width - 8} y1={y} y2={y} stroke="#edf0e9" strokeDasharray="4 6" />)}
      {points.length > 0 && <><path d={`${curve} L ${points.at(-1)!.x} ${baseline} L 8 ${baseline} Z`} fill={`url(#${gradient})`}/><path data-registration-line d={curve} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke"/></>}
    </svg>
    <div style={{ display: "flex", justifyContent: "space-between", color: "#59616a", fontSize: labelCount > 2 ? 12 : 14 }}>{labels.map(index => <span key={index}>{data[index].label}</span>)}</div>
    {!data.some((day) => day.count > 0) && <p className="business-muted" style={{ fontSize: 14 }}>No registrations yet. Your activity will appear here.</p>}
  </div>;
}
