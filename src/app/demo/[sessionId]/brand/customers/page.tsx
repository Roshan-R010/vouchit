import Link from "next/link";
import { Users, Package, Headphones } from "lucide-react";
import { db } from "@/lib/db";
import { requireBrand } from "@/lib/brand";
import { formatDate, isCoverageActive } from "@/lib/dates";

export default async function CustomersPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ tab?: string; id?: string }>;
}) {
  const { sessionId } = await params;
  const { tab, id } = await searchParams;
  const brand = await requireBrand(sessionId);

  const customers = await db.customer.findMany({
    where: { demoSessionId: sessionId },
    include: {
      registrations: {
        where: { unit: { brandId: brand.id } },
        include: {
          claim: { select: { id: true, status: true, reference: true, issueTitle: true } },
          unit: { include: { productModel: true } },
        },
        orderBy: { registeredAt: "desc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const openStatuses = ["SUBMITTED", "UNDER_REVIEW", "INFO_REQUESTED"];

  const withActiveWarranty = customers.filter((c) =>
    c.registrations.some((r) => isCoverageActive(r.coverageEndsOn))
  );
  const withOpenClaims = customers.filter((c) =>
    c.registrations.some((r) => r.claim && openStatuses.includes(r.claim.status))
  );

  const displayCustomers =
    tab === "warranty" ? withActiveWarranty : tab === "claims" ? withOpenClaims : customers;

  const selectedId = id || displayCustomers[0]?.id;
  const selectedCustomer = customers.find((c) => c.id === selectedId) || customers[0];

  const selectedOpenClaims = selectedCustomer
    ? selectedCustomer.registrations.filter((r) => r.claim && openStatuses.includes(r.claim.status)).length
    : 0;
  const latestClaim = selectedCustomer?.registrations
    .map((r) => r.claim)
    .filter(Boolean)
    .sort()
    [0];

  const root = `/demo/${sessionId}/brand/customers`;
  const hrefWithId = (customerId: string) => {
    const p = new URLSearchParams();
    if (tab) p.set("tab", tab);
    p.set("id", customerId);
    return `${root}?${p}`;
  };

  const claimStatusStyle: Record<string, React.CSSProperties> = {
    SUBMITTED: { background: "#e8f0fe", color: "#3d5a99" },
    UNDER_REVIEW: { background: "#fef3cd", color: "#856404" },
    INFO_REQUESTED: { background: "#fff3e0", color: "#b45309" },
    APPROVED: { background: "#eaf4e9", color: "#4e8050" },
    REJECTED: { background: "#faece9", color: "#a5655d" },
    RESOLVED: { background: "#eaf4e9", color: "#4e8050" },
  };
  const claimStatusText: Record<string, string> = {
    SUBMITTED: "New", UNDER_REVIEW: "In review", INFO_REQUESTED: "Awaiting",
    APPROVED: "Approved", REJECTED: "Rejected", RESOLVED: "Resolved",
  };

  return (
    <>
      {/* Header */}
      <div className="business-page-header">
        <div>
          <h1 style={{ fontSize: "27px", fontWeight: 700, letterSpacing: "-0.8px", margin: "4px 0 6px" }}>Customers</h1>
          <p style={{ fontSize: "12px", color: "#7a807b", margin: 0 }}>Know what each customer owns and where they need help.</p>
        </div>
        <button style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "10px 16px", borderRadius: "6px", border: "none", background: "#ef6b5e", color: "#fff", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>+ Add customer</button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "16px" }}>
        {([
          { label: `All customers`, count: customers.length, value: undefined },
          { label: "With active warranty", count: withActiveWarranty.length, value: "warranty" },
          { label: "With open claims", count: withOpenClaims.length, value: "claims" },
        ] as { label: string; count: number; value: string | undefined }[]).map(({ label, count, value }) => {
          const isActive = (tab || undefined) === value;
          return (
            <Link
              key={label}
              href={`${root}${value ? `?tab=${value}` : ""}`}
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

      {/* Split layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "20px" }}>
        {/* Customers table */}
        <div className="business-panel">
          <div style={{ padding: "18px 20px", borderBottom: "1px solid #eef0eb", display: "flex", justifyContent: "space-between" }}>
            <div>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#252b26" }}>Customers</span>
              <span style={{ fontSize: "11px", color: "#8b9180", marginLeft: "8px" }}>{displayCustomers.length} customers</span>
            </div>
          </div>
          <div className="business-table-wrap">
            <table className="business-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Registered units</th>
                  <th>Open claims</th>
                  <th>Last activity</th>
                </tr>
              </thead>
              <tbody>
                {displayCustomers.map((customer) => {
                  const openClaimsCount = customer.registrations.filter(
                    (r) => r.claim && openStatuses.includes(r.claim.status)
                  ).length;
                  const lastActivity = customer.registrations[0]?.registeredAt;
                  const isSelected = customer.id === selectedCustomer?.id;
                  return (
                    <tr key={customer.id} style={{ background: isSelected ? "#f7f8f5" : undefined }}>
                      <td>
                        <Link href={hrefWithId(customer.id)} style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" }}>
                          <span style={{ width: "30px", height: "30px", borderRadius: "50%", background: "#f0f4e9", display: "flex", alignItems: "center", justifyContent: "center", color: "#7c896b", fontSize: "12px", fontWeight: 700, flexShrink: 0 }}>
                            {customer.name.slice(0, 1)}
                          </span>
                          <div>
                            <div style={{ fontSize: "12px", fontWeight: 600, color: "#252b26" }}>{customer.name}</div>
                            <div style={{ fontSize: "10px", color: "#8b9180" }}>{customer.email}</div>
                          </div>
                        </Link>
                      </td>
                      <td style={{ color: "#555e50" }}>{customer.registrations.length}</td>
                      <td style={{ color: openClaimsCount > 0 ? "#c0623a" : "#555e50", fontWeight: openClaimsCount > 0 ? 600 : 400 }}>{openClaimsCount}</td>
                      <td style={{ color: "#848b7b", fontSize: "11px" }}>{lastActivity ? formatDate(lastActivity) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {displayCustomers.length === 0 && (
              <div className="business-empty">
                <Users size={28} />
                <p>No customers found.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right detail panel */}
        {selectedCustomer ? (
          <div style={{ background: "#fff", border: "1px solid #e8e9e6", borderRadius: "9px", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Avatar + name */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ width: "40px", height: "40px", borderRadius: "50%", background: "#f0f4e9", display: "flex", alignItems: "center", justifyContent: "center", color: "#7c896b", fontSize: "16px", fontWeight: 700, flexShrink: 0 }}>
                {selectedCustomer.name.slice(0, 1)}
              </span>
              <div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#1f2620" }}>{selectedCustomer.name}</div>
                <div style={{ fontSize: "11px", color: "#8b9180" }}>{selectedCustomer.email}</div>
              </div>
            </div>

            {/* Summary */}
            <div>
              <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "1px", color: "#8b9180", fontWeight: 600, marginBottom: "10px" }}>Customer summary</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <div style={{ fontSize: "22px", fontWeight: 700, color: "#1f2620" }}>{selectedCustomer.registrations.length}</div>
                  <div style={{ fontSize: "10px", color: "#8b9180" }}>Registered units</div>
                </div>
                <div>
                  <div style={{ fontSize: "22px", fontWeight: 700, color: "#1f2620" }}>{selectedOpenClaims}</div>
                  <div style={{ fontSize: "10px", color: "#8b9180" }}>Open claim{selectedOpenClaims !== 1 ? "s" : ""}</div>
                </div>
              </div>
            </div>

            {/* Registered products */}
            <div>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#252b26", marginBottom: "10px" }}>Registered products</div>
              <div style={{ display: "grid", gap: "10px" }}>
                {selectedCustomer.registrations.slice(0, 3).map((reg) => (
                  <div key={reg.id} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ width: "32px", height: "32px", borderRadius: "7px", background: "#f0f3ec", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Headphones size={16} style={{ color: "#8fa882", strokeWidth: 1.3 }} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "11px", fontWeight: 600, color: "#252b26", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{reg.unit.productModel.name}</div>
                      <div style={{ fontSize: "10px", color: "#8b9180" }}>{reg.unit.serialNumber}</div>
                      <span style={{ fontSize: "9px", fontWeight: 600, padding: "2px 6px", borderRadius: "4px", background: isCoverageActive(reg.coverageEndsOn) ? "#eaf4e9" : "#f0f2ed", color: isCoverageActive(reg.coverageEndsOn) ? "#4e8050" : "#737d69" }}>
                        {isCoverageActive(reg.coverageEndsOn) ? "Covered" : "Expired"}
                      </span>
                    </div>
                  </div>
                ))}
                {selectedCustomer.registrations.length === 0 && <p style={{ fontSize: "12px", color: "#8b9180" }}>No products registered.</p>}
              </div>
            </div>

            {/* Latest claim */}
            {latestClaim && (
              <div style={{ borderTop: "1px solid #eef0eb", paddingTop: "14px" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#252b26", marginBottom: "8px" }}>Latest claim</div>
                <div style={{ fontSize: "11px", color: "#8b9180", marginBottom: "6px" }}>{latestClaim.reference} · {latestClaim.issueTitle}</div>
                <span style={{ fontSize: "9px", fontWeight: 600, padding: "3px 8px", borderRadius: "4px", ...claimStatusStyle[latestClaim.status] }}>
                  {claimStatusText[latestClaim.status]}
                </span>
              </div>
            )}

            {/* View profile button */}
            <button style={{ width: "100%", padding: "9px", border: "1px solid #e8e9e6", borderRadius: "6px", background: "#fff", fontSize: "11px", fontWeight: 600, color: "#252b26", cursor: "pointer", marginTop: "auto" }}>View customer profile</button>
          </div>
        ) : (
          <div style={{ background: "#fff", border: "1px solid #e8e9e6", borderRadius: "9px", display: "flex", alignItems: "center", justifyContent: "center", color: "#8b9180", fontSize: "12px", padding: "40px" }}>Select a customer</div>
        )}
      </div>
    </>
  );
}
