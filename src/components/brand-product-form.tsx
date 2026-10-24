"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ImagePlus, Upload, Package, LoaderCircle } from "lucide-react";
import { createBrandAction, createProductAction, updateProductAction, addProductUnitAction, updateBrandAction, updateUnitDeliveryAction } from "@/app/brand-actions";

type ProductInput = { id: string; name: string; sku: string | null; warrantyMonths: number; imageUrl: string | null };
type FormState = { error?: string; success?: string };
const initialState: FormState = {};

export function BrandProductForm({ sessionId, product }: { sessionId: string; product?: ProductInput }) {
  const action = product ? updateProductAction.bind(null, sessionId, product.id) : createProductAction.bind(null, sessionId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState(product?.imageUrl || "");
  const [removeImage, setRemoveImage] = useState(false);
  const [name, setName] = useState(product?.name || "");
  const [sku, setSku] = useState(product?.sku || "");
  const [warrantyMonths, setWarrantyMonths] = useState(String(product?.warrantyMonths || 36));
  const [imageUrl, setImageUrl] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!imageFile) { setPreview(removeImage ? "" : product?.imageUrl || ""); return; } const objectUrl = URL.createObjectURL(imageFile); setPreview(objectUrl); return () => URL.revokeObjectURL(objectUrl); }, [imageFile, product?.imageUrl, removeImage]);
  useEffect(() => { if (state.error) { setImageFile(null); if (fileInput.current) fileInput.current.value = ""; } }, [state.error]);
  return <form action={formAction} className="business-form">
    <section className="business-panel"><div className="business-panel-header"><div><h2>Product details</h2><p>These details appear on the registration page and warranty card.</p></div></div><div className="business-form-section">
      <div className="business-image-editor"><div className="business-image-preview">{preview ? <img src={preview} alt="Product preview"/> : <ImagePlus size={35} strokeWidth={1.3}/>}</div><div><label className="business-button" htmlFor="product-image"><Upload size={15}/> {preview ? "Change photo" : "Upload photo"}</label><input ref={fileInput} className="business-file-input" type="file" id="product-image" name="image" accept="image/png,image/jpeg,image/webp" onChange={(event) => { setImageFile(event.target.files?.[0] || null); if (event.target.files?.[0]) setRemoveImage(false); }}/><p className="business-hint">JPG, PNG or WebP. Up to 5 MB.</p>{product?.imageUrl && <label className="business-check"><input type="checkbox" name="removeImage" checked={removeImage} onChange={(event) => { const checked = event.target.checked; setRemoveImage(checked); if (checked) { setImageFile(null); if (fileInput.current) fileInput.current.value = ""; } }}/>Remove current image</label>}</div></div>
      <div className="business-field"><label htmlFor="product-name">Product name</label><input id="product-name" name="name" placeholder="e.g. Studio Headphones" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)}/></div>
      <div className="business-form-grid"><div className="business-field"><label htmlFor="product-sku">SKU <span>Optional</span></label><input id="product-sku" name="sku" placeholder="e.g. STUDIO-01" maxLength={80} value={sku} onChange={(event) => setSku(event.target.value)}/></div><div className="business-field"><label htmlFor="product-warranty">Warranty duration</label><div className="business-input-suffix"><input id="product-warranty" name="warrantyMonths" type="number" min={1} max={120} required value={warrantyMonths} onChange={(event) => setWarrantyMonths(event.target.value)}/><span>months</span></div></div></div>
      <details className="business-details"><summary>Use an image link instead</summary><div className="business-field"><label htmlFor="product-image-url">Image URL</label><input id="product-image-url" type="url" name="imageUrl" placeholder="https://example.com/product.jpg" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)}/><p className="business-hint">A new upload takes priority over this URL.</p></div></details>
      {product && <p className="business-hint">Warranty changes apply to future registrations. Existing warranty dates stay attached to the original registration.</p>}
    </div></section>
    {!product && <section className="business-panel"><div className="business-panel-header"><div><h2>First unit and delivery <span className="business-optional">Optional</span></h2><p>Add a delivered unit so a customer can register it as soon as you share the link.</p></div><Package size={19}/></div><div className="business-form-section"><UnitFields required={false}/><p className="business-hint">The stamped unit ID connects this physical product to its order. Coverage starts on the delivery date recorded here.</p></div></section>}
    {state.error && <div className="business-notice error" role="alert">{state.error}</div>}
    <div className="business-form-footer"><Link className="business-button" href={`/demo/${sessionId}/brand/products${product ? `/${product.id}` : ""}`}>Cancel</Link><button className="business-button primary" type="submit" disabled={pending}>{pending && <LoaderCircle size={15} className="business-spin"/>}{pending ? "Saving…" : product ? "Save changes" : "Create product & link"}</button></div>
  </form>;
}

function UnitFields({ required }: { required: boolean }) {
  return <><div className="business-form-grid"><div className="business-field"><label htmlFor="unit-serial">Stamped unit ID</label><input id="unit-serial" name="serialNumber" required={required} placeholder="e.g. STUDIO-1001" maxLength={100}/></div><div className="business-field"><label htmlFor="unit-order">Order reference</label><input id="unit-order" name="orderNumber" required={required} placeholder="e.g. ORD-1001" maxLength={100}/></div></div><div className="business-field"><label htmlFor="unit-delivered">Delivery date</label><input id="unit-delivered" name="deliveredOn" type="date"/><p className="business-hint">Leave blank for an undelivered unit. Customers can register after delivery is recorded.</p></div></>;
}

export function BrandUnitForm({ sessionId, productId }: { sessionId: string; productId: string }) {
  const [state, action, pending] = useActionState(addProductUnitAction.bind(null, sessionId, productId), initialState);
  return <form action={action} className="business-form-section"><UnitFields required/>{state.error && <div className="business-notice error" role="alert">{state.error}</div>}{state.success && <div className="business-notice" role="status">{state.success}</div>}<button className="business-button primary" disabled={pending}>{pending ? "Saving…" : "Save unit"}</button></form>;
}

export function BrandSettingsForm({ sessionId, brand }: { sessionId: string; brand: { name: string; supportEmail: string | null; logoUrl: string | null } }) {
  const [state, action, pending] = useActionState(updateBrandAction.bind(null, sessionId), initialState);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState(brand.logoUrl || "");
  const logoInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!logoFile) { setLogoPreview(removeLogo ? "" : brand.logoUrl || ""); return; } const objectUrl = URL.createObjectURL(logoFile); setLogoPreview(objectUrl); return () => URL.revokeObjectURL(objectUrl); }, [brand.logoUrl, logoFile, removeLogo]);
  return <form action={action} className="business-form-section"><div className="business-image-editor"><div className="business-image-preview">{logoPreview ? <img src={logoPreview} alt="Brand logo preview"/> : <ImagePlus size={35} strokeWidth={1.3}/>}</div><div><label className="business-button" htmlFor="brand-logo"><Upload size={15}/> {logoPreview ? "Change logo" : "Upload logo"}</label><input ref={logoInput} className="business-file-input" type="file" id="brand-logo" name="logo" accept="image/png,image/jpeg,image/webp" onChange={(event) => { setLogoFile(event.target.files?.[0] || null); if (event.target.files?.[0]) setRemoveLogo(false); }}/><p className="business-hint">PNG, JPG or WebP. Up to 5 MB.</p>{brand.logoUrl && <label className="business-check"><input type="checkbox" name="removeLogo" checked={removeLogo} onChange={(event) => { const checked = event.target.checked; setRemoveLogo(checked); if (checked) { setLogoFile(null); if (logoInput.current) logoInput.current.value = ""; } }}/>Remove current logo</label>}</div></div><div className="business-field"><label htmlFor="brand-name">Brand name</label><input id="brand-name" name="name" defaultValue={brand.name} required maxLength={120}/></div><div className="business-field"><label htmlFor="support-email">Support email</label><input id="support-email" name="supportEmail" type="email" defaultValue={brand.supportEmail || ""} placeholder="support@example.com"/></div><p className="business-hint">Your brand name and logo appear throughout the customer experience. Existing registration links stay the same.</p>{state.error && <div className="business-notice error" role="alert">{state.error}</div>}{state.success && <div className="business-notice" role="status">{state.success}</div>}<button className="business-button primary" disabled={pending}>{pending ? "Saving…" : "Save brand details"}</button></form>;
}

export function BrandSetupForm({ sessionId }: { sessionId: string }) {
  const [state, action, pending] = useActionState(createBrandAction.bind(null, sessionId), initialState);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!logoFile) { setPreview(""); return; } const objectUrl = URL.createObjectURL(logoFile); setPreview(objectUrl); return () => URL.revokeObjectURL(objectUrl); }, [logoFile]);
  return <form action={action} className="business-form"><section className="business-panel"><div className="business-panel-header"><div><h2>Create your brand</h2><p>Start with the details customers will see when they register a product.</p></div></div><div className="business-form-section"><div className="business-image-editor"><div className="business-image-preview">{preview ? <img src={preview} alt="Brand logo preview"/> : <ImagePlus size={35} strokeWidth={1.3}/>}</div><div><label className="business-button" htmlFor="setup-logo"><Upload size={15}/> {preview ? "Change logo" : "Upload logo"}</label><input ref={input} className="business-file-input" type="file" id="setup-logo" name="logo" accept="image/png,image/jpeg,image/webp" onChange={(event) => setLogoFile(event.target.files?.[0] || null)}/><p className="business-hint">Optional. PNG, JPG or WebP, up to 5 MB.</p></div></div><div className="business-field"><label htmlFor="setup-brand-name">Brand name</label><input id="setup-brand-name" name="name" placeholder="e.g. Acme Goods" required maxLength={120}/></div><div className="business-field"><label htmlFor="setup-support-email">Support email <span>Optional</span></label><input id="setup-support-email" name="supportEmail" type="email" placeholder="support@example.com" maxLength={200}/></div></div></section>{state.error && <div className="business-notice error" role="alert">{state.error}</div>}<div className="business-form-footer"><button className="business-button primary" type="submit" disabled={pending}>{pending && <LoaderCircle size={15} className="business-spin"/>}{pending ? "Creating…" : "Create brand"}</button></div></form>;
}

export function BrandUnitDeliveryForm({ sessionId, productId, unitId }: { sessionId: string; productId: string; unitId: string }) {
  const [state, action, pending] = useActionState(updateUnitDeliveryAction.bind(null, sessionId, productId, unitId), initialState);
  return <details className="business-delivery-form"><summary>Record delivery</summary><form action={action}><input aria-label="Delivery date" name="deliveredOn" type="date" required/><button className="business-button small" disabled={pending}>{pending ? "Saving…" : "Save"}</button>{state.error && <p role="alert">{state.error}</p>}</form></details>;
}
