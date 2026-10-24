import Link from "next/link";
import { db } from "@/lib/db";
import { requireBrand } from "@/lib/brand";
import { daysRemaining, formatDate, isCoverageActive } from "@/lib/dates";

export default async function RegistrationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { sessionId } = await params;
  const { tab } = await searchParams;
  const brand = await requireBrand(sessionId);

  const registrations = await db.warrantyRegistration.findMany({
    where: { unit: { brandId: brand.id }, customer: { demoSessionId: sessionId } },
    include: {
      customer: true,
      unit: { include: { productModel: true } },
    },
    orderBy: { registeredAt: "desc" },
  });

  const now = new Date();
  const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const verified = registrations.filter((r) => isCoverageActive(r.coverageEndsOn));
  const pending = registrations.filter((r) => !isCoverageActive(r.coverageEndsOn));
  const flagged: typeof registrations = [];
  const expiringSoon = registrations.filter(
    (r) => r.coverageEndsOn <= ninetyDaysFromNow && isCoverageActive(r.coverageEndsOn)
  );

  const displayRegs =
    tab === "verified"
      ? verified
      : tab === "pending"
      ? pending
      : tab === "flagged"
      ? flagged
      : registrations;

  const root = `/demo/${sessionId}/brand/registrations`;

  const tabsConfig = [
    { label: "All", value: undefined, count: registrations.length },
    { label: "Verified", value: "verified", count: verified.length },
    { label: "Pending", value: "pending", count: pending.length },
    { label: "Flagged", value: "flagged", count: flagged.length },
  ] as { label: string; value: string | undefined; count: number }[];

  const statusStyle = (reg: (typeof registrations)[0]): React.CSSProperties => {
    if (isCoverageActive(reg.coverageEndsOn)) return { background: "#eaf4e9", color: "#4e8050" };
    return { background: "#fef3cd", color: "#856404" };
  };
  const statusText = (reg: (typeof registrations)[0]) =>
    isCoverageActive(reg.coverageEndsOn) ? "Verified" : "Pending";

  return (
    <>
      {/* Header */}
      <div className="business-page-header">
        <div>
          <h1 style={{ fontSize: "27px", fontWeight: 700, letterSpacing: "-0.8px", margin: "4px 0 6px" }}>
            Registrations
          </h1>
          <p style={{ fontSize: "12px", color: "#7a807b", margin: 0 }}>
            Every activated warranty, tied to a real customer and product.
          </p>
        </div>
        <button
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            padding: "10px 16px",
            borderRadius: "6px",
            border: "none",
            background: "#ef6b5e",
            color: "#fff",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Import CSV
        </button>
      </div>

      {/* Stat cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            background: "#fff",
            border: "1px solid #e8e9e6",
            borderRadius: "9px",
            padding: "20px 22px",
          }}
        >
          <div style={{ fontSize: "11px", color: "#8b9180", marginBottom: "8px" }}>
            Registered warranties
          </div>
          <div
            style={{
              fontSize: "28px",
              fontWeight: 700,
              letterSpacing: "-1px",
              color: "#1f2620",
              marginBottom: "6px",
            }}
          >
            {registrations.length.toLocaleString()}
          </div>
          <div style={{ fontSize: "11px", color: "#5d9148" }}>● +12.5% this month</div>
        </div>
        <div
          style={{
            background: "#fff",
            border: "1px solid #e8e9e6",
            borderRadius: "9px",
            padding: "20px 22px",
          }}
        >
          <div style={{ fontSize: "11px", color: "#8b9180", marginBottom: "8px" }}>
            Pending verification
          </div>
          <div
            style={{
              fontSize: "28px",
              fontWeight: 700,
              letterSpacing: "-1px",
              color: "#1f2620",
              marginBottom: "6px",
            }}
          >
            {pending.length}
          </div>
          {pending.length > 0 ? (
            <div style={{ fontSize: "11px", color: "#c0623a" }}>● Review required</div>
          ) : (
            <div style={{ fontSize: "11px", color: "#5d9148" }}>● All verified</div>
          )}
        </div>
        <div
          style={{
            background: "#fff",
            border: "1px solid #e8e9e6",
            borderRadius: "9px",
            padding: "20px 22px",
          }}
        >
          <div style={{ fontSize: "11px", color: "#8b9180", marginBottom: "8px" }}>
            Expiring within 90 days
          </div>
          <div
            style={{
              fontSize: "28px",
              fontWeight: 700,
              letterSpacing: "-1px",
              color: "#1f2620",
              marginBottom: "6px",
            }}
          >
            {expiringSoon.length}
          </div>
          <div style={{ fontSize: "11px", color: "#8b9180" }}>● Upcoming coverage ends</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "16px" }}>
        {tabsConfig.map(({ label, value, count }) => {
          const isActive = (tab || undefined) === value;
          return (
            <Link
              key={label}
              href={value ? `${root}?tab=${value}` : root}
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

      {/* Table panel */}
      <div className="business-panel">
        <div style={{ padding: "18px 20px", borderBottom: "1px solid #eef0eb" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "#252b26" }}>
            All registrations
          </div>
          <div style={{ fontSize: "11px", color: "#8b9180", marginTop: "3px" }}>
            Search by customer, unit ID or product
          </div>
        </div>
        <div className="business-table-wrap">
          <table className="business-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Product</th>
                <th>Unit ID</th>
                <th>Activated</th>
                <th>Warranty</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {displayRegs.map((reg) => (
                <tr key={reg.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: "#252b26", fontSize: "12px" }}>
                      {reg.customer.name}
                    </div>
                  </td>
                  <td style={{ color: "#555e50" }}>{reg.unit.productModel.name}</td>
                  <td style={{ fontFamily: "monospace", fontSize: "11px", color: "#555e50" }}>
                    {reg.unit.serialNumber}
                  </td>
                  <td style={{ color: "#848b7b", fontSize: "11px" }}>
                    {formatDate(reg.registeredAt)}
                  </td>
                  <td style={{ color: "#555e50" }}>{daysRemaining(reg.coverageEndsOn)} days</td>
                  <td>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 600,
                        padding: "4px 9px",
                        borderRadius: "5px",
                        ...statusStyle(reg),
                      }}
                    >
                      {statusText(reg)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {displayRegs.length === 0 && (
            <div className="business-empty">
              <p>No registrations found.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
