import { useId, type CSSProperties } from "react";

/** Display a selected viewport of an uploaded reference sheet without changing it. */
export function ProductPhoto({ src, alt, style }: { src: string; alt: string; style?: CSSProperties }) {
  const clipId = useId().replace(/:/g, "");
  const [url, fragment] = src.split("#");
  const viewport = /^xywh=(\d+),(\d+),(\d+),(\d+)$/.exec(fragment || "");
  if (viewport) {
    return <svg role="img" aria-label={alt} viewBox={viewport.slice(1).join(" ")} style={{ width: "100%", height: "100%", ...style }}>
      <title>{alt}</title><defs><clipPath id={clipId}><rect x={viewport[1]} y={viewport[2]} width={viewport[3]} height={viewport[4]}/></clipPath></defs><image href={url} width="417" height="447" clipPath={`url(#${clipId})`} />
    </svg>;
  }
  return <img src={src} alt={alt} style={{ width: "100%", height: "100%", objectFit: "contain", ...style }} />;
}
