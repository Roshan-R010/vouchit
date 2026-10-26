import { apiFetch } from "@/lib/api-fetch";
import { ProductPhoto } from "@/components/product-photo";
import { ImagePlus, RotateCcw, RotateCw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import styles from "./product-image-editor.module.css";

type Props = { sessionId: string; productId: string; productName: string; imageUrl: string | null; onSaved: (url: string) => void; onClose: () => void };

export function ProductImageEditor({ sessionId, productId, productName, imageUrl, onSaved, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!source) return;
    const image = new Image();
    image.onload = () => { imageRef.current = image; draw(); };
    image.src = source;
    return () => { imageRef.current = null; };
  }, [source]);

  useEffect(() => { draw(); }, [zoom, rotation, offset, source]);

  function draw() {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const size = canvas.width;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "#f2f6fb";
    ctx.fillRect(0, 0, size, size);
    const turned = rotation % 180 !== 0;
    const fit = Math.min(size / (turned ? image.height : image.width), size / (turned ? image.width : image.height));
    ctx.save();
    ctx.translate(size / 2 + offset.x, size / 2 + offset.y);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.scale(fit * zoom, fit * zoom);
    ctx.drawImage(image, -image.width / 2, -image.height / 2);
    ctx.restore();
  }

  function chooseFile(file?: File) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError("Choose a PNG, JPEG, or WebP image up to 5 MB.");
      return;
    }
    setError("");
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
    const reader = new FileReader();
    reader.onload = () => setSource(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function save() {
    if (!source || !canvasRef.current) return;
    setSaving(true);
    setError("");
    try {
      const response = await apiFetch(`/api/demo/${sessionId}/brand/products/${productId}/image`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: canvasRef.current.toDataURL("image/jpeg", 0.9) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save the image.");
      onSaved(data.imageUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the image.");
    } finally {
      setSaving(false);
    }
  }

  return <div className={styles.backdrop} role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={styles.dialog} role="dialog" aria-modal="true" aria-label={`Change image for ${productName}`}>
      <header><div><h2>Product image</h2><p>Choose a photo, position it, then save.</p></div><button type="button" onClick={onClose} aria-label="Close image editor"><X size={20}/></button></header>
      <div className={styles.stage}>
        {source ? <canvas ref={canvasRef} width={500} height={500} aria-label="Product image crop preview" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); dragRef.current = { x: event.clientX, y: event.clientY }; }} onPointerMove={(event) => { const previous = dragRef.current; if (!previous) return; const rect = event.currentTarget.getBoundingClientRect(); const factor = 500 / rect.width; setOffset((value) => ({ x: value.x + (event.clientX - previous.x) * factor, y: value.y + (event.clientY - previous.y) * factor })); dragRef.current = { x: event.clientX, y: event.clientY }; }} onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }}/>
          : <div className={styles.current}>{imageUrl ? <ProductPhoto src={imageUrl} alt={productName}/> : <ImagePlus size={48}/>}<span>Current image</span></div>}
      </div>
      <div className={styles.controls}>
        <label className={styles.fileButton}><ImagePlus size={17}/> {source ? "Choose another photo" : "Choose photo"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => chooseFile(event.target.files?.[0])}/></label>
        {source && <><label className={styles.zoom}>Zoom <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))}/></label><button type="button" onClick={() => setRotation((value) => (value + 270) % 360)} aria-label="Rotate left"><RotateCcw size={19}/></button><button type="button" onClick={() => setRotation((value) => (value + 90) % 360)} aria-label="Rotate right"><RotateCw size={19}/></button></>}
      </div>
      {source && <p className={styles.hint}>Drag the photo to reposition it. The square preview is what customers will see.</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <footer><button type="button" onClick={onClose}>Cancel</button><button type="button" onClick={save} disabled={!source || saving}>{saving ? "Saving…" : "Save image"}</button></footer>
    </section>
  </div>;
}
