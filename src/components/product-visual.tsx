import { BatteryCharging, Headphones, Watch } from "lucide-react";

export function ProductVisual({ kind = "headphones", imageUrl, name = "Product" }: { kind?: string; imageUrl?: string | null; name?: string }) {
  const Icon = kind === "charger" ? BatteryCharging : kind === "watch" ? Watch : Headphones;
  if (imageUrl) return <div className={`product-art ${kind}`}><img src={imageUrl} alt={name} style={{ width: "100%", height: "100%", minHeight: 128, maxHeight: 300, objectFit: "contain" }} /></div>;
  return <div className={`product-art ${kind}`} aria-hidden="true"><Icon strokeWidth={1.35} /></div>;
}
