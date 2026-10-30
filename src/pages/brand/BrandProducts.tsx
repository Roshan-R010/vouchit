import { Select } from "@/components/select";
import { apiFetch } from "@/lib/api-fetch";
import { ProductPhoto } from "@/components/product-photo";
import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, ChevronRight, Copy, Grid2X2, List, Package, Search } from "lucide-react";
import styles from "./brand-products.module.css";

export function BrandProducts() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [products, setProducts] = useState<any[]>([]);
  const [brand, setBrand] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [copyNotice, setCopyNotice] = useState<{ message: string; success: boolean } | null>(null);

  useEffect(() => {
    if (!copyNotice) return;
    const timer = setTimeout(() => setCopyNotice(null), 2400);
    return () => clearTimeout(timer);
  }, [copyNotice]);

  async function copyRegistrationLink(product: any) {
    if (!sessionId || !brand?.slug) return;
    const path = `/demo/${sessionId}/register/${encodeURIComponent(brand.slug)}/${encodeURIComponent(product.slug)}`;
    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).href);
      setCopyNotice({ message: "Link copied", success: true });
    } catch {
      setCopyNotice({ message: "Could not copy link. Please allow clipboard access and try again.", success: false });
    }
  }

  const visible = useMemo(() => products.filter((product) => `${product.name} ${product.sku || ""}`.toLowerCase().includes(search.trim().toLowerCase()) && (filter === "all" || (filter === "registered" ? product.registeredCount > 0 : product.unitCount === 0))), [products, search, filter]);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    apiFetch(`/api/demo/${sessionId}/brand/products`)
      .then((res) => res.json())
      .then((data) => {
        setProducts(data.products || []);
        setBrand(data.brand);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load products:", err);
        setLoading(false);
      });
  }, [sessionId]);

  return <div className={styles.page}>
    <div className="business-page-header"><div><h1>Products</h1><p>Manage product models, warranty periods, and registration links.</p></div><div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}><Link to={`/demo/${sessionId}/brand/products/import`} className="business-button">Import units</Link><Link to={`/demo/${sessionId}/brand/products/new`} className="business-button add-product-button">Add product</Link></div></div>
    <div className={styles.toolbar}>
      <label className={styles.search}><Search size={17}/><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" aria-label="Search products"/></label>
      <label className={styles.filter}><span className="sr-only">Filter products</span><Select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All products</option><option value="registered">Registered units</option><option value="empty">No units yet</option></Select></label>
      <div className={styles.viewSwitch} role="group" aria-label="Catalog view"><button type="button" aria-label="Grid view" aria-pressed={view === "grid"} onClick={() => setView("grid")}><Grid2X2 size={17}/></button><button type="button" aria-label="List view" aria-pressed={view === "list"} onClick={() => setView("list")}><List size={18}/></button></div>
    </div>
    {loading ? <div className={styles.empty}>Loading products…</div> : visible.length === 0 ? <div className={styles.empty}>{products.length ? "No products match this search or filter." : "No products yet. Add your first product to get started."}</div> :
      <div className={view === "grid" ? styles.grid : styles.list}>
        {visible.map((product) => <article className={styles.card} key={product.id}>
          <div className={styles.photo}>{product.imageUrl ? <ProductPhoto src={product.imageUrl} alt={product.name}/> : <Package size={44} strokeWidth={1.4}/>}<button type="button" className={styles.copyLink} onClick={() => void copyRegistrationLink(product)} disabled={!brand?.slug} aria-label={`Copy registration link for ${product.name}`} title="Copy registration link"><Copy size={14}/></button></div>
          <div className={styles.details}><Link className={styles.name} to={`/demo/${sessionId}/brand/products/${product.id}`}>{product.name}</Link><span className={styles.sku}>SKU: {product.sku || "Not set"}</span><span className={styles.warranty}>{product.warrantyMonths}m warranty</span><div className={styles.footer}><span>{(product.unitCount || 0).toLocaleString()} {product.unitCount === 1 ? "unit" : "units"} · {product.registeredCount || 0} registered</span><Link to={`/demo/${sessionId}/brand/products/${product.id}`} aria-label={`Manage ${product.name}`}><ChevronRight size={21}/></Link></div></div>
        </article>)}
      </div>}
    <div className={styles.copyNotice} role="status" aria-live="polite" aria-atomic="true">{copyNotice && <span className={styles.toast}>{copyNotice.success && <Check size={15} aria-hidden="true"/>}{copyNotice.message}</span>}</div>
  </div>;
}
export default BrandProducts;
