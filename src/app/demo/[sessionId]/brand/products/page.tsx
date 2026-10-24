import Link from "next/link";
import { Package, Plus, Headphones, Zap } from "lucide-react";
import { db } from "@/lib/db";
import { requireBrand } from "@/lib/brand";

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ q?: string; tab?: string; id?: string }>;
}) {
  const { sessionId } = await params;
  const { q, tab, id } = await searchParams;
  const brand = await requireBrand(sessionId);

  const allProducts = await db.productModel.findMany({
    where: {
      brandId: brand.id,
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { sku: { contains: q, mode: "insensitive" as const } }] } : {}),
    },
    include: {
      units: {
        include: { registration: { select: { id: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  const activeProducts = allProducts.filter((p) => p.units.some((u) => u.registration));
  const archivedProducts = allProducts.filter((p) => !p.units.some((u) => u.registration));

  const displayProducts =
    tab === "active" ? activeProducts : tab === "archived" ? archivedProducts : allProducts;

  // Total registered units across all products
  const totalRegistrations = allProducts.reduce(
    (sum, p) => sum + p.units.filter((u) => u.registration).length,
    0
  );

  // Average warranty
  const avgWarranty =
    allProducts.length > 0
      ? Math.round(allProducts.reduce((s, p) => s + p.warrantyMonths, 0) / allProducts.length)
      : 0;

  const selectedId = id || displayProducts[0]?.id;
  const selectedProduct = allProducts.find((p) => p.id === selectedId) || allProducts[0];
  const selectedRegistrations = selectedProduct
    ? selectedProduct.units.filter((u) => u.registration).length
    : 0;

  const root = `/demo/${sessionId}/brand/products`;
  const tabHref = (t?: string, productId?: string) => {
    const p = new URLSearchParams();
    if (t) p.set("tab", t);
    if (productId) p.set("id", productId);
    return p.size ? `${root}?${p}` : root;
  };

  return (
    <>
      {/* Header */}
      <div className="business-page-header">
        <div>
          <h1 style={{ fontSize: "27px", fontWeight: 700, letterSpacing: "-0.8px", margin: "4px 0 6px" }}>Products</h1>
          <p style={{ fontSize: "12px", color: "#7a807b", margin: 0 }}>
            Manage your catalog and the warranties attached to each product.
          </p>
        </div>
        <Link className="business-button primary" href={`${root}/new`}>
          <Plus size={15} /> Add product
        </Link>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "24px" }}>
        <div style={{ background: "#fff", border: "1px solid #e8e9e6", borderRadius: "9px", padding: "20px 22px" }}>
          <div style={{ fontSize: "11px", color: "#8b9180", marginBottom: "8px" }}>Active products</div>
          <div style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "-1px", color: "#1f2620", marginBottom: "6px" }}>{activeProducts.length || allProducts.length}</div>
          <div style={{ fontSize: "11px", color: "#5d9148" }}>● Available for registration</div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #e8e9e6", borderRadius: "9px", padding: "20px 22px" }}>
          <div style={{ fontSize: "11px", color: "#8b9180", marginBottom: "8px" }}>Registered units</div>
          <div style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "-1px", color: "#1f2620", marginBottom: "6px" }}>{totalRegistrations.toLocaleString()}</div>
          <div style={{ fontSize: "11px", color: "#5d9148" }}>● +12.5% this month</div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #e8e9e6", borderRadius: "9px", padding: "20px 22px" }}>
          <div style={{ fontSize: "11px", color: "#8b9180", marginBottom: "8px" }}>Avg. warranty length</div>
          <div style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "-1px", color: "#1f2620", marginBottom: "6px" }}>{avgWarranty} months</div>
          <div style={{ fontSize: "11px", color: "#8b9180" }}>● Across active products</div>
        </div>
      </div>

      {/* Tabs + Import row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div style={{ display: "flex", gap: "4px" }}>
          {([
            { label: `All products`, value: undefined, count: allProducts.length },
            { label: `Active`, value: "active", count: activeProducts.length || allProducts.length },
            { label: `Archived`, value: "archived", count: archivedProducts.length },
          ] as { label: string; value: string | undefined; count: number }[]).map(({ label, value, count }) => {
            const isActive = (tab || undefined) === value;
            return (
              <Link
                key={label}
                href={tabHref(value)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 14px",
                  fontSize: "11px",
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? "#252b26" : "#7a8073",
                  border: isActive ? "1px solid #d0d5c8" : "1px solid transparent",
                  borderRadius: "6px",
                  background: isActive ? "#fff" : "transparent",
                  textDecoration: "none",
                }}
              >
                {label} {count}
              </Link>
            );
          })}
        </div>
        <button style={{ fontSize: "11px", padding: "7px 14px", border: "1px solid #e8e9e6", borderRadius: "6px", background: "#fff", color: "#384034", cursor: "pointer", fontWeight: 500 }}>Import products</button>
      </div>

      {/* Main: table + detail panel */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "20px" }}>
        {/* Product catalog table */}
        <div className="business-panel">
          <div style={{ padding: "18px 20px", borderBottom: "1px solid #eef0eb" }}>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#252b26" }}>Product catalog</span>
          </div>
          <div className="business-table-wrap">
            <table className="business-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Coverage</th>
                  <th>Registrations</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {displayProducts.map((product) => {
                  const regCount = product.units.filter((u) => u.registration).length;
                  const isArchived = regCount === 0 && product.units.length > 0 ? false : product.units.length === 0;
                  const isSelected = product.id === selectedProduct?.id;
                  return (
                    <tr key={product.id} style={{ background: isSelected ? "#f7f8f5" : undefined }}>
                      <td>
                        <Link href={tabHref(tab, product.id)} style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" }}>
                          <span style={{ width: "34px", height: "34px", borderRadius: "8px", background: "#f0f3ec", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {product.imageUrl ? <img src={product.imageUrl} alt={product.name} style={{ width: "24px", height: "24px", objectFit: "contain" }} /> : <Package size={16} style={{ color: "#7a8073" }} />}
                          </span>
                          <div>
                            <div style={{ fontSize: "12px", fontWeight: 600, color: "#252b26" }}>{product.name}</div>
                            <div style={{ fontSize: "10px", color: "#8b9180" }}>SKU: {product.sku || "—"}</div>
                          </div>
                        </Link>
                      </td>
                      <td style={{ color: "#555e50" }}>{product.warrantyMonths} months</td>
                      <td style={{ color: "#555e50" }}>{regCount}</td>
                      <td>
                        <span style={{ fontSize: "10px", fontWeight: 600, padding: "4px 9px", borderRadius: "5px", background: isArchived ? "#f0f2ed" : "#eaf4e9", color: isArchived ? "#737d69" : "#4e8050" }}>
                          {isArchived ? "Archived" : "Active"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {displayProducts.length === 0 && (
              <div className="business-empty">
                <Package size={28} />
                <p>No products found.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right detail panel */}
        {selectedProduct ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0", background: "#fff", border: "1px solid #e8e9e6", borderRadius: "9px", overflow: "hidden" }}>
            <div style={{ background: "#f3f5f0", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "130px", padding: "20px" }}>
              {selectedProduct.imageUrl ? (
                <img src={selectedProduct.imageUrl} alt={selectedProduct.name} style={{ maxHeight: "90px", objectFit: "contain" }} />
              ) : (
                <Headphones size={40} style={{ color: "#8fa882", strokeWidth: 1.3 }} />
              )}
            </div>
            <div style={{ padding: "18px 18px 20px" }}>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#1f2620", marginBottom: "8px" }}>{selectedProduct.name}</div>
              <span style={{ fontSize: "10px", fontWeight: 600, padding: "3px 8px", borderRadius: "4px", background: "#eaf4e9", color: "#4e8050" }}>Active</span>

              <div style={{ marginTop: "16px", display: "grid", gap: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                  <span style={{ color: "#8b9180" }}>Warranty duration</span>
                  <span style={{ fontWeight: 600, color: "#252b26" }}>{selectedProduct.warrantyMonths} months</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                  <span style={{ color: "#8b9180" }}>Registered warranties</span>
                  <span style={{ fontWeight: 600, color: "#252b26" }}>{selectedRegistrations}</span>
                </div>
                <div style={{ fontSize: "11px", color: "#8b9180", marginTop: "4px" }}>Registration link</div>
                <div style={{ fontSize: "11px", color: "#536148", wordBreak: "break-all" }}>vouch.app/{brand.slug}/{selectedProduct.slug}</div>
              </div>

              <Link
                href={`${root}/${selectedProduct.id}/edit`}
                style={{ display: "block", marginTop: "16px", textAlign: "center", padding: "8px 12px", border: "1px solid #e8e9e6", borderRadius: "6px", fontSize: "11px", fontWeight: 600, color: "#252b26", textDecoration: "none" }}
              >
                Edit product
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ background: "#fff", border: "1px solid #e8e9e6", borderRadius: "9px", display: "flex", alignItems: "center", justifyContent: "center", color: "#8b9180", fontSize: "12px", padding: "40px" }}>Select a product</div>
        )}
      </div>
    </>
  );
}
