import { apiFetch } from "@/lib/api-fetch";
import { readApiResponse } from "@/lib/api-response";
import { ProductPhoto } from "@/components/product-photo";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, Headphones, LockKeyhole, ShieldCheck, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";

type RegistrationProduct = { id: string; name: string; slug: string; imageUrl: string | null; warrantyMonths: number };
type RegistrationData = { brand: { name: string; slug: string; logoUrl?: string | null }; product: RegistrationProduct };

export default function CustomerRegisterPortal() {
  const { sessionId, brandSlug, productSlug } = useParams<{ sessionId: string; brandSlug: string; productSlug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const reducedMotion = useReducedMotion();
  const { account } = useAuth();
  const preview = location.state?.registration as RegistrationData | undefined;
  const [data, setData] = useState<RegistrationData | null>(preview && preview.brand.slug === brandSlug && preview.product.slug === productSlug ? preview : null);
  const [panelOpen, setPanelOpen] = useState(searchParams.has("open") || Boolean(searchParams.get("serialNumber")));
  const [serialNumber, setSerialNumber] = useState(searchParams.get("serialNumber") || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId || !brandSlug || !productSlug) return;
    let active = true;
    apiFetch(`/api/demo/${sessionId}/register/${encodeURIComponent(brandSlug)}/${encodeURIComponent(productSlug)}`).then(readApiResponse).then((result: RegistrationData) => {
      if (!active) return;
      setData(result);
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Could not load this product."); });
    return () => { active = false; };
  }, [sessionId, brandSlug, productSlug]);

  const product = data?.product;
  const brand = data?.brand;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!sessionId || !brandSlug || !productSlug) return;
    if (!account || account.role !== "CUSTOMER") {
      const returnTo = `${location.pathname}?open=1&serialNumber=${encodeURIComponent(serialNumber)}`;
      navigate(`/login/customer?next=${encodeURIComponent(returnTo)}`);
      return;
    }
    setError(null); setSubmitting(true);
    try {
      const response = await apiFetch(`/api/demo/${sessionId}/register`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandSlug, productSlug, serialNumber: serialNumber.trim().toUpperCase() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Registration failed. Check your serial number.");
      navigate("/customer", { replace: true });
    } catch (cause: any) { setError(cause.message || "Failed to register this product."); }
    finally { setSubmitting(false); }
  }

  if (!data && !error) return <main className="registration-portal registration-loading" role="status"><div className="registration-loading-copy"><span className="registration-eyebrow">Product registration</span><h1>Register your product.</h1><p>Loading product details…</p></div></main>;
  if (!product) return <main className="page-wrap content"><section className="support-empty"><h1>Product unavailable</h1><p>{error || "This registration link does not match an active product."}</p><Link className="action" to={`/demo/${sessionId}/customer`}>Go to warranties</Link></section></main>;

  return <main className={`registration-portal ${panelOpen ? "panel-is-open" : ""}`}>
    <div className="registration-intro">
      <Link to="/customer" className="registration-back"><ArrowLeft size={17}/> My warranties</Link>
      <span className="registration-eyebrow">{brand?.name || "Official"} customer care</span>
      <h1>Register your<br/>product.</h1>
      <p>Select your product to activate its warranty and get official support.</p>
      <motion.button className="registration-product-card" type="button" onClick={() => setPanelOpen(true)} whileHover={reducedMotion ? undefined : { y: -5 }} whileTap={reducedMotion ? undefined : { scale: .985 }}>
        <span className="registration-product-image">{product.imageUrl ? <ProductPhoto src={product.imageUrl} alt={product.name}/> : <ShieldCheck size={70} aria-hidden="true"/>}</span>
        <span className="registration-product-card-copy"><strong>{product.name}</strong><span>{product.warrantyMonths} months of warranty</span></span>
        <span className="registration-card-arrow"><ArrowRight size={20}/></span>
      </motion.button>
    </div>

    <AnimatePresence>
      {panelOpen && <motion.section className="registration-drawer" initial={reducedMotion ? false : { opacity: 0, x: 56 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }} transition={{ duration: reducedMotion ? 0 : .52, ease: [.22, 1, .36, 1] }}>
        <div className="registration-showcase">
          <div className="registration-showcase-image">{product.imageUrl ? <ProductPhoto src={product.imageUrl} alt={product.name}/> : <ShieldCheck size={80} aria-hidden="true"/>}</div>
          <div className="registration-showcase-copy"><h2>{product.name}</h2><p>{brand?.name} product warranty</p>
            <ul><li><ShieldCheck/><span><strong>{product.warrantyMonths} months</strong>Manufacturer warranty</span></li><li><CheckCircle2/><span><strong>Official registration</strong>Secure, verified coverage</span></li><li><Headphones/><span><strong>Direct support</strong>Help from {brand?.name}</span></li></ul>
          </div>
        </div>
        <div className="registration-form-panel">
          <button className="registration-close" type="button" onClick={() => setPanelOpen(false)} aria-label="Close registration panel"><X/></button>
          <div><span className="registration-step">Warranty activation</span><h2>Register your product</h2><p>Enter the details printed on your product or retail box.</p></div>
          {error && <div className="notice error" role="alert">{error}</div>}
          <form onSubmit={handleSubmit}>
            <label>Serial number<input autoFocus type="text" placeholder="Enter the serial number" value={serialNumber} onChange={e => setSerialNumber(e.target.value.toUpperCase())} required={account?.role === "CUSTOMER"}/><small>Usually printed beside the barcode on the product or box.</small></label>
            <button className="registration-submit" type="submit" disabled={submitting}>{submitting ? "Checking your product…" : <>{account?.role === "CUSTOMER" ? "Register warranty" : "Sign in to register"} <ArrowRight size={18}/></>}</button>
          </form>
          <p className="registration-secure"><LockKeyhole size={14}/> Your details are used only to manage this warranty.</p>
        </div>
      </motion.section>}
    </AnimatePresence>
  </main>;
}
