"use client";

import { useEffect, useState } from "react";

export function ImagePicker({ id, name, label, files, onChange, initialUrl, maxFiles = 1 }: { id: string; name: string; label: string; files: File[]; onChange: (files: File[]) => void; initialUrl?: string | null; maxFiles?: number }) {
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);
  const images = previews.length ? previews : initialUrl ? [initialUrl] : [];
  return <div className="upload-field">
    <label htmlFor={id}>{label}</label>
    <input id={id} name={name} type="file" accept="image/png,image/jpeg,image/webp" multiple={maxFiles > 1} onChange={(event) => {
      const selected = Array.from(event.target.files || []);
      const message = selected.length > maxFiles ? `Choose up to ${maxFiles} photos.` : selected.some((file) => !["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) ? "Choose JPG, PNG or WebP images, up to 5 MB each." : "";
      setError(message);
      if (message) { event.target.value = ""; onChange([]); return; }
      onChange(selected);
    }}/>
    <small>JPG, PNG or WebP. Up to 5 MB{maxFiles > 1 ? ` each, ${maxFiles} photos maximum` : ""}.</small>
    {error && <p role="alert" className="upload-error">{error}</p>}
    {!!images.length && <div className="upload-previews">{images.map((url, index) => <figure key={url}><img src={url} alt={`${label} preview ${index + 1}`}/>{files[index] && <figcaption>{files[index].name}</figcaption>}</figure>)}</div>}
  </div>;
}
