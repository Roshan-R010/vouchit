"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, ArrowUpRight } from "lucide-react";

export function BrandCopyLink({ path, compact = false }: { path: string; compact?: boolean }) {
  const [url, setUrl] = useState(path);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => { setUrl(new URL(path, window.location.origin).href); }, [path]);
  useEffect(() => { if (!copied) return; const timer = setTimeout(() => setCopied(false), 2400); return () => clearTimeout(timer); }, [copied]);
  async function copy() { try { await navigator.clipboard.writeText(url); setCopied(true); setError(false); } catch { setError(true); } }
  return <div className={`business-share ${compact ? "compact" : ""}`}>
    {!compact && <input aria-label="Registration link" value={url} readOnly onFocus={(event) => event.currentTarget.select()}/>}
    <button className="business-button small" type="button" onClick={copy}>{copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? "Copied" : "Copy link"}</button>
    {!compact && <Link className="business-button small" href={path} target="_blank" rel="noreferrer">Open <ArrowUpRight size={14}/></Link>}
    {error && <span role="status" className="business-muted">Select and copy the link: {url}</span>}
  </div>;
}
