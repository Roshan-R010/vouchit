export function VouchLogo({ compact = false }: { compact?: boolean }) {
  return <span className="vouch-wordmark" aria-label="vouch">{compact ? "v" : "vouch"}<span className="vouch-wordmark-dot">.</span></span>;
}
