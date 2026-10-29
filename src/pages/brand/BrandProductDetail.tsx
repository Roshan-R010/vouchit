import { AddProductUnit } from "@/components/add-product-unit";
import { ProductIssueTags } from "@/components/product-issue-tags";
import { ProductClaimPhotos } from "@/components/product-claim-photos";
import { apiFetch } from "@/lib/api-fetch";
import { ProductPhoto } from "@/components/product-photo";
import { ProductImageEditor } from "@/components/product-image-editor";
import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Package, ExternalLink, ImagePlus, ChevronDown } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { formatDate } from "@/lib/dates";
import styles from "./brand-product-detail.module.css";

const UNIT_PAGE_SIZE = 10;

export function BrandProductDetail() {
  const { sessionId, productId } = useParams<{ sessionId: string; productId: string }>();
  const [version, setVersion] = useState(0);
  const [product, setProduct] = useState<any>(null);
  const [brand, setBrand] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editingImage, setEditingImage] = useState(false);
  const [units, setUnits] = useState<any[]>([]);
  const [unitTotal, setUnitTotal] = useState(0);
  const [registeredCount, setRegisteredCount] = useState(0);
  const [unitPage, setUnitPage] = useState(1);
  const [displayPage, setDisplayPage] = useState(1);
  const [unitSearch, setUnitSearch] = useState("");
  const [displaySearch, setDisplaySearch] = useState("");
  const [unitsExpanded, setUnitsExpanded] = useState(false);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitError, setUnitError] = useState("");
  const reducedMotion = useReducedMotion();
  const [modeSaving, setModeSaving] = useState(false);
  const [modeError, setModeError] = useState("");
  const [verificationMode, setVerificationMode] = useState("UNIT_ONLY");

  useEffect(() => {
    if (!sessionId || !productId) return;
    setLoading(true);
    apiFetch(`/api/demo/${sessionId}/brand/products/${productId}`)
      .then((res) => res.json())
      .then((data) => {
        setProduct(data.product);
        setVerificationMode(data.product?.verificationMode ?? "UNIT_ONLY");
        setBrand(data.brand);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load product:", err);
        setLoading(false);
      });
  }, [sessionId, productId, version]);

  useEffect(() => {
    if (!sessionId || !productId) return;
    let active = true;
    setUnitsLoading(true);
    setUnitError("");
    const timer = window.setTimeout(() => {
      apiFetch(`/api/demo/${sessionId}/brand/products/${productId}/units?page=${unitPage}&size=${UNIT_PAGE_SIZE}&search=${encodeURIComponent(unitSearch)}`)
        .then(res => { if (!res.ok) throw new Error("Could not load units."); return res.json(); }).then(data => {
          if (!active) return;
          setUnits(data.units ?? []);
          setUnitTotal(data.total ?? 0);
          setRegisteredCount(data.registered ?? 0);
          setDisplayPage(unitPage);
          setDisplaySearch(unitSearch);
        }).catch(() => { if (active) setUnitError("Could not load units. Try another page or reload."); }).finally(() => { if (active) setUnitsLoading(false); });
    }, 200);
    return () => { active = false; window.clearTimeout(timer); };
  }, [sessionId, productId, version, unitPage, unitSearch]);

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#777" }}>
        <div
          style={{
            width: "30px",
            height: "30px",
            border: "3px solid #e2e6de",
            borderTopColor: "#4a5442",
            borderRadius: "50%",
            animation: "business-spin 0.8s linear infinite",
            margin: "0 auto 12px",
          }}
        />
        Loading product details...
      </div>
    );
  }

  if (!product) {
    return (
      <div>
        <Link to={`/demo/${sessionId}/brand/products`} className="business-back">
          <ArrowLeft size={14} /> Back to products
        </Link>
        <div className="business-notice error">Product could not be found.</div>
      </div>
    );
  }

  const regUrl = `${window.location.origin}/demo/${sessionId}/register/${brand?.slug || ""}/${product.slug}`;
  const totalPages = Math.max(1, Math.ceil(unitTotal / UNIT_PAGE_SIZE));
  const firstVisiblePage = Math.max(1, Math.min(unitPage - 3, totalPages - 7));
  const visiblePages = Array.from({ length: Math.min(8, totalPages) }, (_, index) => firstVisiblePage + index);

  return (
    <div>
      <Link to={`/demo/${sessionId}/brand/products`} className="business-back">
        <ArrowLeft size={14} /> Back to products
      </Link>

      <div className="business-product-overview">
        <div className="business-product-image">
          {product.imageUrl ? <ProductPhoto src={product.imageUrl} alt={product.name} /> : <Package size={44} />}
        </div>
        <div>
          <div className="business-eyebrow">Product Model</div>
          <h2>{product.name}</h2>
          <p>
            SKU: {product.sku || "N/A"} · {product.warrantyMonths} Months Warranty Coverage
          </p>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <span className="business-badge success">{product.unitCount || 0} Units Tracked</span>
            <a
              href={`/demo/${sessionId}/register/${brand?.slug || ""}/${product.slug}`}
              target="_blank"
              rel="noreferrer"
              className="business-text-link"
            >
              Open registration page <ExternalLink size={12} />
            </a>
          </div>
          <button type="button" className="business-button small" style={{ marginTop: 14 }} onClick={() => setEditingImage(true)}><ImagePlus size={16}/> Change image</button>
        </div>
      </div>

      {editingImage && sessionId && productId && <ProductImageEditor sessionId={sessionId} productId={productId} productName={product.name} imageUrl={product.imageUrl} onClose={() => setEditingImage(false)} onSaved={(url) => { setProduct((current: any) => ({ ...current, imageUrl: url })); setEditingImage(false); }}/ >}

      {sessionId && productId && <ProductIssueTags key={productId} sessionId={sessionId} productId={productId} initialTags={product.issueTags || []}/>}
      {sessionId && productId && <ProductClaimPhotos key={`${productId}-photos`} sessionId={sessionId} productId={productId} initialLimit={product.claimPhotoLimit}/>}
      <section className="business-panel"><div className="business-panel-header"><div><h2>Registration verification</h2><p>Choose the information customers must enter for this product.</p></div></div><div className="business-form-section" style={{ maxWidth: 520 }}>
        {modeError && <p className="business-notice error" role="alert">{modeError}</p>}
        <label className="business-field"><span>Verification method</span><select value={verificationMode} onChange={event => setVerificationMode(event.target.value)}><option value="UNIT_ONLY">Unit ID</option><option value="ORDER_ONLY">Order ID</option><option value="ORDER_AND_UNIT">Order ID and Unit ID</option></select></label>
        <button className="business-button primary" disabled={modeSaving || verificationMode === product.verificationMode} onClick={async () => { setModeSaving(true); setModeError(""); try { const response = await apiFetch(`/api/demo/${sessionId}/brand/products/${productId}/verification`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ verificationMode }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setProduct((current: any) => ({ ...current, verificationMode })); } catch (cause) { setModeError(cause instanceof Error ? cause.message : "Could not save."); } finally { setModeSaving(false); } }}>Save verification method</button>
      </div></section>
      {sessionId && productId && <AddProductUnit sessionId={sessionId} productId={productId} onSaved={() => setVersion(value => value + 1)}/>}
      {/* Units Table */}
      <div className={`business-panel ${styles.unitsPanel}`}>
        <div className="business-panel-header">
          <div>
            <h2>Stamped Units & Delivery Records</h2>
            <p>{product.unitCount || 0} units · {registeredCount} registered. Imported units are listed here.</p>
          </div>
          <button type="button" className={styles.expandButton} aria-label={unitsExpanded ? "Collapse stamped units" : "Expand stamped units"} aria-expanded={unitsExpanded} aria-controls="stamped-units-content" onClick={() => setUnitsExpanded(value => !value)}><ChevronDown size={20} className={unitsExpanded ? styles.chevronOpen : ""}/></button>
        </div>

        <AnimatePresence initial={false}>
        {unitsExpanded && <motion.div id="stamped-units-content" className={styles.collapsible} initial={reducedMotion ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={reducedMotion ? undefined : { height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: "easeInOut" }}>
        <div className={styles.searchRow}><label className="business-field" style={{ margin: 0, maxWidth: 360 }}><span>Search Unit ID</span><input type="search" value={unitSearch} onChange={event => { setUnitSearch(event.target.value); setUnitPage(1); }} placeholder="Search serial number"/></label>{unitsLoading && <span className={styles.loading} role="status" aria-label="Updating units"><span/></span>}</div>

        {unitError && <p className="business-notice error" role="alert">{unitError}</p>}
        {!unitsLoading && !unitError && unitTotal === 0 ? (
          <div className="business-empty">
            <h2>{unitSearch ? "No matching units" : "No units stamped yet"}</h2>
            <p>{unitSearch ? "Try another unit ID." : "Add serial numbers and purchase orders to track individual warranties."}</p>
          </div>
        ) : !unitError && units.length > 0 && (
          <AnimatePresence mode="wait" initial={false}><motion.div key={`${displayPage}:${displaySearch}`} initial={reducedMotion ? false : { opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={reducedMotion ? undefined : { opacity: 0, x: -18 }} transition={{ duration: 0.24, ease: "easeOut" }} className="business-table-wrap">
            <table className="business-table">
              <thead>
                <tr>
                  <th>STAMPED UNIT ID</th>
                  <th>PURCHASE ORDER</th>
                  <th>DELIVERY DATE</th>
                  <th>REGISTRATION STATUS</th>
                </tr>
              </thead>
              <tbody>
                {units.map((u: any) => (
                  <tr key={u.id}>
                    <td className="business-mono" style={{ fontWeight: 600 }}>
                      {u.serialNumber}
                    </td>
                    <td className="business-mono">{u.purchaseOrder?.orderNumber || "—"}</td>
                    <td className="business-mono">
                      {u.purchaseOrder?.deliveredOn ? formatDate(u.purchaseOrder.deliveredOn) : "Pending"}
                    </td>
                    <td>
                      {u.registration ? (
                        <span className="business-badge success">Registered</span>
                      ) : (
                        <span className="business-badge">Unregistered</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div></AnimatePresence>
        )}
        {totalPages > 1 && <nav className={styles.pagination} aria-label="Stamped units pages"><div className={styles.pageCard}><strong>Page</strong><div className={styles.pageNumbers}>{unitPage > 1 && <button type="button" className={styles.pageTextButton} disabled={unitsLoading} onClick={() => setUnitPage(page => page - 1)}>Previous</button>}{visiblePages.map(page => <button type="button" key={page} className={styles.pageNumber} aria-label={`Page ${page}`} aria-current={unitPage === page ? "page" : undefined} disabled={unitsLoading} onClick={() => setUnitPage(page)}>{unitPage === page && <motion.span layoutId={`active-unit-page-${productId}`} className={styles.activePage} transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}/>}<span>{page}</span></button>)}{unitPage < totalPages && <button type="button" className={styles.pageTextButton} disabled={unitsLoading} onClick={() => setUnitPage(page => page + 1)}>Next</button>}</div></div></nav>}
        </motion.div>}
        </AnimatePresence>
      </div>
    </div>
  );
}
export default BrandProductDetail;
