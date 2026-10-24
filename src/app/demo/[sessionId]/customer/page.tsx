import Link from "next/link";
import { ArrowRight, Box, Headphones, Plus } from "lucide-react";
import { notFound } from "next/navigation";
import { CustomerNav } from "@/components/customer-nav";
import { db } from "@/lib/db";
import { daysRemaining, isCoverageActive } from "@/lib/dates";
import { isUuid } from "@/lib/brand";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ notice?: string; error?: string; filter?: string }>;
};

function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export default async function CustomerDashboard({ params, searchParams }: Props) {
  const { sessionId } = await params;
  if (!isUuid(sessionId)) notFound();
  const query = await searchParams;
  const customer = await db.customer.findFirst({ where: { demoSessionId: sessionId } });
  if (!customer) {
    return (
      <main className="page-wrap">
        <div className="blank-state" style={{ marginTop: 60 }}>
          This demo session was not found. <Link href="/demo">Start a new demo →</Link>
        </div>
      </main>
    );
  }

  const registrations = await db.warrantyRegistration.findMany({
    where: { customerId: customer.id, unit: { brand: { demoSessionId: sessionId } } },
    include: {
      unit: { include: { productModel: true, purchaseOrder: true, brand: true } },
      claim: true,
    },
    orderBy: { registeredAt: "desc" },
  });

  const brand = registrations[0]?.unit.brand || { name: "Kestrel Audio" };

  const claims = registrations
    .flatMap((registration) =>
      registration.claim
        ? [{ claim: registration.claim, product: registration.unit.productModel.name }]
        : []
    )
    .sort((a, b) => b.claim.submittedAt.getTime() - a.claim.submittedAt.getTime());

  const activeClaims = claims.filter(
    (c) => c.claim.status !== "RESOLVED" && c.claim.status !== "REJECTED"
  );
  const latestClaimItem = activeClaims[0] || claims[0];

  const active = registrations.filter((r) => isCoverageActive(r.coverageEndsOn));
  const expiring = active.filter((r) => daysRemaining(r.coverageEndsOn) <= 90);
  const expired = registrations.length - active.length;

  const filters = [
    { label: "All products", value: "all", count: registrations.length },
    { label: "Under warranty", value: "covered", count: active.length },
    { label: "Expiring soon", value: "expiring", count: expiring.length },
    { label: "Expired", value: "expired", count: expired },
  ];

  const selectedFilter = query.filter || "all";
  const visibleRegistrations = registrations.filter((registration) => {
    const days = daysRemaining(registration.coverageEndsOn);
    const covered = isCoverageActive(registration.coverageEndsOn);
    return selectedFilter === "expired"
      ? !covered
      : selectedFilter === "expiring"
      ? covered && days <= 90
      : selectedFilter === "covered"
      ? covered
      : true;
  });

  return (
    <>
      <CustomerNav sessionId={sessionId} customerName={customer.name} brandName={brand.name} />
      <main className="page-wrap content" style={{ paddingTop: 32 }}>
        {/* Header Section */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 28,
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "1.3px",
                textTransform: "uppercase",
                color: "#8a8984",
                marginBottom: 10,
              }}
            >
              YOUR VOUCH CUSTOMER SPACE
            </div>
            <h1
              style={{
                fontFamily: "var(--font-manrope, 'Manrope', 'DM Sans', sans-serif)",
                fontSize: "clamp(28px, 3.2vw, 42px)",
                fontWeight: 800,
                letterSpacing: "-1.5px",
                margin: "0 0 8px",
                color: "#171918",
              }}
            >
              Your products, all in one place.
            </h1>
            <p style={{ margin: 0, color: "#777b78", fontSize: 15 }}>
              Track coverage, access your receipts and get support when you need it.
            </p>
          </div>
          <Link
            className="action"
            href={`/demo/${sessionId}/register`}
            style={{
              background: "#f26054",
              color: "#fff",
              borderRadius: 8,
              padding: "11px 20px",
              fontSize: 13,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              boxShadow: "none",
            }}
          >
            <Plus size={15} /> Register a product
          </Link>
        </div>

        {/* Notices */}
        {query.notice && (
          <div className="notice" style={{ marginBottom: 20 }}>
            {query.notice === "registered"
              ? "Your product is registered. Warranty coverage follows the original delivery date."
              : "This unit is already registered. Your existing warranty card is below."}
          </div>
        )}
        {query.error && (
          <div className="notice error" style={{ marginBottom: 20 }}>
            We couldn’t complete that action. Check the unit details and try again.
          </div>
        )}

        {/* Summary Stat Card */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #eae8e3",
            borderRadius: 14,
            padding: "24px 36px",
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            alignItems: "center",
            gap: 24,
            marginBottom: 28,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <span style={{ fontSize: 32, fontWeight: 800, color: "#171918", letterSpacing: "-1px" }}>
              {registrations.length}
            </span>
            <span style={{ fontSize: 13, color: "#777b78", fontWeight: 500 }}>
              Registered products
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              borderLeft: "1px solid #f0efed",
              paddingLeft: 36,
            }}
          >
            <span style={{ fontSize: 32, fontWeight: 800, color: "#171918", letterSpacing: "-1px" }}>
              {active.length}
            </span>
            <span style={{ fontSize: 13, color: "#777b78", fontWeight: 500 }}>
              Covered by warranty
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              borderLeft: "1px solid #f0efed",
              paddingLeft: 36,
            }}
          >
            <span style={{ fontSize: 32, fontWeight: 800, color: "#171918", letterSpacing: "-1px" }}>
              {activeClaims.length || claims.length}
            </span>
            <span style={{ fontSize: 13, color: "#777b78", fontWeight: 500 }}>
              Active support claim{(activeClaims.length || claims.length) === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {/* Filter Tabs */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            borderBottom: "1px solid #eae8e3",
            marginBottom: 24,
            overflowX: "auto",
          }}
        >
          {filters.map(({ label, value, count }) => {
            const isActive = selectedFilter === value;
            return (
              <Link
                key={value}
                href={
                  value === "all"
                    ? `/demo/${sessionId}/customer`
                    : `/demo/${sessionId}/customer?filter=${value}`
                }
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 4px 14px",
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? "#171918" : "#777b78",
                  borderBottom: isActive ? "2px solid #f26054" : "2px solid transparent",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  marginBottom: -1,
                }}
              >
                <span>{label}</span>
                <span>{count}</span>
              </Link>
            );
          })}
        </div>

        {/* Product Grid */}
        {registrations.length ? (
          visibleRegistrations.length ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))",
                gap: 20,
                marginBottom: 24,
              }}
            >
              {visibleRegistrations.map((registration) => {
                const remaining = daysRemaining(registration.coverageEndsOn);
                const total = Math.max(
                  1,
                  (registration.coverageEndsOn.getTime() -
                    registration.coverageStartsOn.getTime()) /
                    86_400_000
                );
                const percent =
                  remaining === 0
                    ? 0
                    : Math.max(3, Math.min(100, Math.round((remaining / total) * 100)));
                const covered = isCoverageActive(registration.coverageEndsOn);
                const isHeadphones = !registration.unit.productModel.slug.includes("charge");

                return (
                  <article
                    key={registration.id}
                    id={`product-${registration.id}`}
                    style={{
                      background: "#fff",
                      border: "1px solid #eae8e3",
                      borderRadius: 14,
                      padding: 24,
                      display: "grid",
                      gridTemplateColumns: "130px 1fr",
                      gap: 22,
                    }}
                  >
                    {/* Visual Art */}
                    <div
                      style={{
                        background: "#f4f2ed",
                        borderRadius: 12,
                        height: 130,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                      }}
                    >
                      {registration.unit.productModel.imageUrl &&
                      !registration.unit.productModel.imageUrl.endsWith(".png") ? (
                        <img
                          src={registration.unit.productModel.imageUrl}
                          alt={registration.unit.productModel.name}
                          style={{ maxHeight: 90, objectFit: "contain" }}
                        />
                      ) : isHeadphones ? (
                        <Headphones size={42} strokeWidth={1.3} color="#28613a" />
                      ) : (
                        <Box size={42} strokeWidth={1.3} color="#28613a" />
                      )}
                    </div>

                    {/* Copy & Meta */}
                    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                      <span style={{ fontSize: 11, color: "#777b78", marginBottom: 2 }}>
                        {registration.unit.brand.name}
                      </span>
                      <h2
                        style={{
                          fontSize: 18,
                          fontWeight: 700,
                          color: "#171918",
                          margin: "0 0 8px",
                          letterSpacing: "-0.4px",
                        }}
                      >
                        {registration.unit.productModel.name}
                      </h2>

                      <div>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: "3px 9px",
                            borderRadius: 6,
                            background: covered ? "#eaf4e9" : "#efefee",
                            color: covered ? "#28613a" : "#777b78",
                            display: "inline-block",
                          }}
                        >
                          {covered ? "Under warranty" : "Expired"}
                        </span>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          gap: 6,
                          margin: "12px 0 6px",
                        }}
                      >
                        <strong
                          style={{
                            fontSize: 26,
                            fontWeight: 800,
                            color: "#171918",
                            letterSpacing: "-1px",
                          }}
                        >
                          {remaining.toLocaleString()}
                        </strong>
                        <span style={{ fontSize: 11, color: "#777b78" }}>days remaining</span>
                      </div>

                      <div
                        style={{
                          height: 4,
                          background: "#eeedea",
                          borderRadius: 4,
                          overflow: "hidden",
                          margin: "0 0 16px",
                        }}
                      >
                        <span
                          style={{
                            display: "block",
                            height: "100%",
                            borderRadius: 4,
                            background: "#28613a",
                            width: `${percent}%`,
                          }}
                        />
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gap: 5,
                          fontSize: 11,
                          color: "#777b78",
                          marginBottom: 18,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>Unit ID</span>
                          <b style={{ color: "#171918", fontWeight: 600 }}>
                            {registration.unit.serialNumber}
                          </b>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>Coverage ends</span>
                          <b style={{ color: "#171918", fontWeight: 600 }}>
                            {formatLongDate(registration.coverageEndsOn)}
                          </b>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 10, marginTop: "auto" }}>
                        <Link
                          href={`/demo/${sessionId}/customer/products/${registration.unitId}`}
                          style={{
                            background: "#fff",
                            border: "1px solid #e1dfdb",
                            borderRadius: 8,
                            padding: "8px 18px",
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#171918",
                            textDecoration: "none",
                            textAlign: "center",
                          }}
                        >
                          Details
                        </Link>
                        {registration.claim ? (
                          <Link
                            href={`/demo/${sessionId}/customer/claims/${registration.claim.id}`}
                            style={{
                              background: "#f26054",
                              border: "none",
                              borderRadius: 8,
                              padding: "8px 18px",
                              fontSize: 12,
                              fontWeight: 600,
                              color: "#fff",
                              textDecoration: "none",
                              textAlign: "center",
                            }}
                          >
                            View claim
                          </Link>
                        ) : (
                          covered && (
                            <Link
                              href={`/demo/${sessionId}/customer/claims/new?unitId=${registration.unitId}`}
                              style={{
                                background: "#f26054",
                                border: "none",
                                borderRadius: 8,
                                padding: "8px 18px",
                                fontSize: 12,
                                fontWeight: 600,
                                color: "#fff",
                                textDecoration: "none",
                                textAlign: "center",
                              }}
                            >
                              Raise a claim
                            </Link>
                          )
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="blank-state" style={{ marginTop: 18 }}>
              No products in this warranty filter.
            </div>
          )
        ) : (
          <div className="blank-state" style={{ marginTop: 18 }}>
            No products registered yet. Choose a product and enter its unit ID to create your warranty
            card.
          </div>
        )}

        {/* Current Support Request Banner (Screenshot 1 Bottom) */}
        {latestClaimItem && (
          <div style={{ marginTop: 28 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#171918", marginBottom: 12 }}>
              Your current support request
            </div>
            <div
              style={{
                background: "#fff",
                border: "1px solid #eae8e3",
                borderRadius: 12,
                padding: "16px 22px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Headphones size={20} color="#28613a" strokeWidth={1.5} />
                <span style={{ fontSize: 13, color: "#171918", fontWeight: 500 }}>
                  <b style={{ fontWeight: 600 }}>{latestClaimItem.claim.reference}</b> ·{" "}
                  {latestClaimItem.claim.issueTitle}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "4px 12px",
                    borderRadius: 6,
                    background:
                      latestClaimItem.claim.status === "RESOLVED" ||
                      latestClaimItem.claim.status === "APPROVED"
                        ? "#eaf4e9"
                        : "#fef3cd",
                    color:
                      latestClaimItem.claim.status === "RESOLVED" ||
                      latestClaimItem.claim.status === "APPROVED"
                        ? "#28613a"
                        : "#856404",
                  }}
                >
                  {latestClaimItem.claim.status === "SUBMITTED"
                    ? "Submitted"
                    : latestClaimItem.claim.status === "UNDER_REVIEW"
                    ? "In review"
                    : latestClaimItem.claim.status === "INFO_REQUESTED"
                    ? "Awaiting details"
                    : latestClaimItem.claim.status === "RESOLVED"
                    ? "Resolved"
                    : "Approved"}
                </span>
                <Link
                  href={`/demo/${sessionId}/customer/claims/${latestClaimItem.claim.id}`}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#28613a",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  View updates <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          </div>
        )}

        <p className="footer-note" style={{ marginTop: 32 }}>
          Demo workspace · Products and coverage records from your brand
        </p>
      </main>
    </>
  );
}
