import Link from "next/link";
import { Filter, FileText, Image, ArrowUpRight } from "lucide-react";
import { db } from "@/lib/db";
import { requireBrand } from "@/lib/brand";
import { daysRemaining, formatDate, isCoverageActive } from "@/lib/dates";
import { claimStatusLabels, claimStatusOptions, isClaimStatus } from "@/lib/claim-status";
import styles from "@/components/brand-claims.module.css";

const tabLabels: Record<string, string> = {
  SUBMITTED: "New",
  UNDER_REVIEW: "In review",
  INFO_REQUESTED: "Awaiting customer",
  RESOLVED: "Resolved",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

const statusBadgeStyle: Record<string, React.CSSProperties> = {
  SUBMITTED: { background: "#e8f0fe", color: "#3d5a99" },
  UNDER_REVIEW: { background: "#fef3cd", color: "#856404" },
  INFO_REQUESTED: { background: "#fff3e0", color: "#b45309" },
  APPROVED: { background: "#eaf4e9", color: "#4e8050" },
  REJECTED: { background: "#faece9", color: "#a5655d" },
  RESOLVED: { background: "#eaf4e9", color: "#4e8050" },
};

const statusBadgeText: Record<string, string> = {
  SUBMITTED: "New",
  UNDER_REVIEW: "In review",
  INFO_REQUESTED: "Awaiting",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  RESOLVED: "Resolved",
};

export default async function BrandClaimsPage({ params, searchParams }: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ status?: string; q?: string; id?: string }>;
}) {
  const { sessionId } = await params;
  const query = await searchParams;
  const brand = await requireBrand(sessionId);
  const status = query.status && isClaimStatus(query.status) ? query.status : undefined;
  const scope = { registration: { customer: { demoSessionId: sessionId }, unit: { brandId: brand.id } } };

  const [claims, grouped] = await Promise.all([
    db.warrantyClaim.findMany({
      where: { ...scope, ...(status ? { status } : {}) },
      include: { registration: { include: { customer: true, unit: { include: { productModel: true } } } } },
      orderBy: { submittedAt: "desc" },
    }),
    db.warrantyClaim.groupBy({ by: ["status"], where: scope, _count: { _all: true } }),
  ]);

  const total = grouped.reduce((sum, row) => sum + row._count._all, 0);
  const root = `/demo/${sessionId}/brand/claims`;

  const selectedId = query.id || claims[0]?.id;
  let selectedClaim = null;
  if (selectedId) {
    selectedClaim = await db.warrantyClaim.findFirst({
      where: { id: selectedId, ...scope },
      include: {
        registration: { include: { customer: true, unit: { include: { productModel: true } } } },
        events: { orderBy: { createdAt: "asc" } },
        attachments: { orderBy: { createdAt: "asc" } },
      },
    });
  }

  const filterHref = (filter?: string, id?: string) => {
    const values = new URLSearchParams();
    if (filter) values.set("status", filter);
    if (id) values.set("id", id);
    return values.size ? `${root}?${values}` : root;
  };

  const tabsToShow = [undefined, "SUBMITTED", "UNDER_REVIEW", "INFO_REQUESTED", "RESOLVED"] as const;
  const tabLabelsDisplay: Record<string, string> = {
    SUBMITTED: "New",
    UNDER_REVIEW: "In review",
    INFO_REQUESTED: "Awaiting customer",
    RESOLVED: "Resolved",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0", minWidth: 0 }}>
      {/* Header */}
      <div className="business-page-header" style={{ marginBottom: "16px" }}>
        <div>
          <h1 style={{ fontSize: "27px", fontWeight: 700, letterSpacing: "-0.8px", margin: "4px 0 6px" }}>Claims</h1>
          <p style={{ fontSize: "12px", color: "#7a807b", margin: 0 }}>Every customer issue, all its details, one workspace.</p>
        </div>
        <button style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "10px 16px", borderRadius: "6px", border: "none", background: "#ef6b5e", color: "#fff", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>Export claims</button>
      </div>

      {/* Status tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "16px", borderBottom: "1px solid #e8e9e6", paddingBottom: "0" }}>
        {tabsToShow.map((tabStatus) => {
          const isActive = tabStatus === status;
          const count = tabStatus ? (grouped.find((r) => r.status === tabStatus)?._count._all || 0) : total;
          const label = tabStatus ? tabLabelsDisplay[tabStatus] : "All";
          return (
            <Link
              key={tabStatus ?? "all"}
              href={filterHref(tabStatus)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "10px 12px",
                fontSize: "11px",
                fontWeight: isActive ? 700 : 500,
                color: isActive ? "#252b26" : "#7a8073",
                borderBottom: isActive ? "2px solid #ef6b5e" : "2px solid transparent",
                textDecoration: "none",
                whiteSpace: "nowrap",
                marginBottom: "-1px",
              }}
            >
              {label} <span style={{ fontSize: "10px", background: "#f0f2ed", borderRadius: "4px", padding: "1px 5px", color: "#7b8273" }}>{count}</span>
            </Link>
          );
        })}
      </div>

      {/* Split pane */}
      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: "0", background: "#fff", border: "1px solid #e8e9e6", borderRadius: "9px", overflow: "hidden", minHeight: "500px" }}>
        {/* Left: Inbox */}
        <div style={{ borderRight: "1px solid #e8e9e6", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 18px", borderBottom: "1px solid #eef0eb" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#252b26" }}>Claim inbox</span>
            <Filter size={16} style={{ color: "#8b9180" }} />
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {claims.length === 0 && (
              <div style={{ padding: "32px 18px", textAlign: "center", color: "#8b9180", fontSize: "12px" }}>No claims found.</div>
            )}
            {claims.map((claim) => {
              const isSelected = claim.id === selectedClaim?.id;
              return (
                <Link
                  key={claim.id}
                  href={filterHref(status, claim.id)}
                  style={{
                    display: "block",
                    padding: "14px 18px",
                    borderBottom: "1px solid #eef0eb",
                    background: isSelected ? "#f4f6f0" : "transparent",
                    textDecoration: "none",
                    transition: "background 0.15s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <span style={{ fontSize: "10px", color: "#8b9180", fontFamily: "monospace" }}>{claim.reference}</span>
                    <span style={{ fontSize: "9px", fontWeight: 600, padding: "3px 7px", borderRadius: "4px", ...statusBadgeStyle[claim.status] }}>
                      {statusBadgeText[claim.status]}
                    </span>
                  </div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#252b26", marginBottom: "4px", lineHeight: "1.4" }}>{claim.issueTitle}</div>
                  <div style={{ fontSize: "10px", color: "#8b9180" }}>{claim.registration.customer.name} · {claim.registration.unit.productModel.name}</div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right: Claim detail */}
        {selectedClaim ? (
          <div style={{ padding: "24px", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ fontSize: "11px", color: "#8b9180", fontFamily: "monospace" }}>{selectedClaim.reference}</span>
              <span style={{ fontSize: "10px", fontWeight: 600, padding: "4px 10px", borderRadius: "5px", ...statusBadgeStyle[selectedClaim.status] }}>
                {statusBadgeText[selectedClaim.status]}
              </span>
            </div>
            <h2 style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "-0.5px", margin: "0 0 8px", color: "#1a2118" }}>{selectedClaim.issueTitle}</h2>
            <p style={{ fontSize: "12px", color: "#7a8073", marginBottom: "20px", lineHeight: "1.6" }}>{selectedClaim.description}</p>

            {/* Customer + Product row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
              <div>
                <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "1px", color: "#8b9180", fontWeight: 600, marginBottom: "8px" }}>Customer</div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#252b26" }}>{selectedClaim.registration.customer.name}</div>
                <div style={{ fontSize: "11px", color: "#8b9180" }}>{selectedClaim.registration.customer.email}</div>
              </div>
              <div>
                <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "1px", color: "#8b9180", fontWeight: 600, marginBottom: "8px" }}>Product &amp; Coverage</div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#252b26" }}>{selectedClaim.registration.unit.productModel.name}</div>
                <div style={{ fontSize: "11px", color: "#8b9180" }}>{selectedClaim.registration.unit.serialNumber} · {daysRemaining(selectedClaim.registration.coverageEndsOn)} days remaining</div>
              </div>
            </div>

            {/* Evidence */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#252b26", marginBottom: "12px" }}>Evidence</div>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                {selectedClaim.attachments.length > 0 ? selectedClaim.attachments.map((att, i) => (
                  <div key={att.id} style={{ border: "1px solid #e8e9e6", borderRadius: "8px", padding: "14px 16px", display: "flex", alignItems: "center", gap: "10px", minWidth: "160px", background: "#fafbf9" }}>
                    <FileText size={18} style={{ color: "#8b9180" }} />
                    <div>
                      <div style={{ fontSize: "11px", fontWeight: 600, color: "#252b26" }}>attachment_{i + 1}</div>
                      <div style={{ fontSize: "10px", color: "#8b9180" }}>Customer-uploaded file</div>
                    </div>
                  </div>
                )) : (
                  <>
                    <div style={{ border: "1px solid #e8e9e6", borderRadius: "8px", padding: "14px 16px", display: "flex", alignItems: "center", gap: "10px", minWidth: "160px", background: "#fafbf9" }}>
                      <FileText size={18} style={{ color: "#8b9180" }} />
                      <div>
                        <div style={{ fontSize: "11px", fontWeight: 600, color: "#252b26" }}>invoice_1024.pdf</div>
                        <div style={{ fontSize: "10px", color: "#8b9180" }}>Attached by customer · 208 KB</div>
                      </div>
                    </div>
                    <div style={{ border: "1px solid #e8e9e6", borderRadius: "8px", padding: "14px 16px", display: "flex", alignItems: "center", gap: "10px", minWidth: "160px", background: "#fafbf9" }}>
                      <Image size={18} style={{ color: "#8b9180" }} />
                      <div>
                        <div style={{ fontSize: "11px", fontWeight: 600, color: "#252b26" }}>fault_photo.jpg</div>
                        <div style={{ fontSize: "10px", color: "#8b9180" }}>Customer-uploaded image</div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Activity */}
            <div style={{ borderTop: "1px solid #eef0eb", paddingTop: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#252b26" }}>Activity</div>
                <Link href={`/demo/${sessionId}/brand/claims/${selectedClaim.id}`} style={{ fontSize: "11px", fontWeight: 600, border: "1px solid #e8e9e6", borderRadius: "6px", padding: "6px 12px", color: "#252b26", textDecoration: "none" }}>Update status</Link>
              </div>
              <ol style={{ listStyle: "none", padding: 0, margin: "0 0 14px", display: "grid", gap: "12px" }}>
                {selectedClaim.events.map((event) => (
                  <li key={event.id} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#3d7a3d", flexShrink: 0, marginTop: "4px" }} />
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "#252b26" }}>{event.toStatus === "SUBMITTED" ? "Claim submitted" : claimStatusLabels[event.toStatus]}</div>
                      <div style={{ fontSize: "10px", color: "#8b9180" }}>{formatDate(event.createdAt)}</div>
                    </div>
                  </li>
                ))}
                {selectedClaim.events.length === 0 && (
                  <li style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#3d7a3d", flexShrink: 0, marginTop: "4px" }} />
                    <div style={{ fontSize: "12px", color: "#8b9180" }}>No activity yet.</div>
                  </li>
                )}
              </ol>
              <textarea
                readOnly
                placeholder="Write an update to your customer..."
                style={{ width: "100%", border: "1px solid #e8e9e6", borderRadius: "7px", padding: "10px 12px", fontSize: "12px", color: "#6a7460", background: "#fafbf9", outline: "none", resize: "vertical", minHeight: "70px", fontFamily: "inherit", boxSizing: "border-box" }}
              />
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "#8b9180", fontSize: "13px" }}>Select a claim to view details</div>
        )}
      </div>
    </div>
  );
}
