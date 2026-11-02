"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import styles from "./claim-photo-gallery.module.css";

export type ClaimPhoto = { id: string; url: string };

export function ClaimPhotoGallery({ photos, compact = false }: { photos: ClaimPhoto[]; compact?: boolean }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchStartX = useRef<number | null>(null);
  const isOpen = activeIndex !== null && photos.length > 0;
  const currentIndex = activeIndex === null ? 0 : Math.min(activeIndex, photos.length - 1);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => { document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setActiveIndex(null); }
      else if (event.key === "ArrowRight" && photos.length > 1) { event.preventDefault(); setActiveIndex(index => index === null ? null : (index + 1) % photos.length); }
      else if (event.key === "ArrowLeft" && photos.length > 1) { event.preventDefault(); setActiveIndex(index => index === null ? null : (index - 1 + photos.length) % photos.length); }
      else if (event.key === "Tab") {
        const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") || []);
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, photos.length]);

  if (!photos.length) return null;
  const move = (direction: -1 | 1) => setActiveIndex(index => index === null ? null : (index + direction + photos.length) % photos.length);

  return <>
    <div className={compact ? styles.compact : styles.grid}>
      {photos.map((photo, index) => <button key={photo.id} type="button" className={styles.thumbnail} onClick={() => setActiveIndex(index)} aria-label={`View claim photo ${index + 1} of ${photos.length}`}>
        <img src={photo.url} alt={`Claim evidence ${index + 1}`} loading="lazy"/><span>Photo {index + 1}</span>
      </button>)}
    </div>
    {isOpen && createPortal(<div className={styles.backdrop} onMouseDown={event => { if (event.target === event.currentTarget) setActiveIndex(null); }}>
      <div ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true" aria-label="Claim photo viewer" data-claim-photo-viewer>
        <div className={styles.toolbar}><span aria-live="polite">Photo {currentIndex + 1} of {photos.length}</span><button ref={closeRef} type="button" onClick={() => setActiveIndex(null)} aria-label="Close photo viewer"><X size={22}/></button></div>
        <div className={styles.stage} onTouchStart={event => { touchStartX.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={event => { const start = touchStartX.current; touchStartX.current = null; if (start === null || photos.length < 2) return; const distance = event.changedTouches[0]?.clientX - start; if (Math.abs(distance) > 45) move(distance < 0 ? 1 : -1); }}>
          {photos.length > 1 && <button type="button" className={styles.previous} onClick={() => move(-1)} aria-label="Previous photo"><ChevronLeft size={26}/></button>}
          <img key={photos[currentIndex].id} src={photos[currentIndex].url} alt={`Claim evidence ${currentIndex + 1} of ${photos.length}`}/>
          {photos.length > 1 && <button type="button" className={styles.next} onClick={() => move(1)} aria-label="Next photo"><ChevronRight size={26}/></button>}
        </div>
      </div>
    </div>, document.body)}
  </>;
}
