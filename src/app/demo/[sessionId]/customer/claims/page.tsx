import Link from "next/link";
import { ArrowRight, Box, Clock, FileText, Headphones, Plus, Search, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { CustomerNav } from "@/components/customer-nav";
import { db } from "@/lib/db";
import { isUuid } from "@/lib/brand";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ q?: string }>;
};

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  SUBMITTED: { bg: "#fef3cd", text: "#856404", label: "Submitted" },
  UNDER_REVIEW: { bg: "#fbf2df", text: "#917036", label: "In review" },
  INFO_REQUESTED: { bg: "#f1ecf9", text: "#7d669c", label: "Needs info" },
  APPROVED: { bg: "#eaf4e9", text: "#28613a", label: "Approved" },
  REJECTED: { bg: "#faece9", text: "#a5655d", label: "Rejected" },
  RESOLVED: { bg: "#eaf4e9", text: "#28613a", label: "Resolved" },
};

export default async function CustomerClaimsPage({ params, searchParams }: Props) {
  const { sessionId } = await params;
  if (!isUuid(sessionId)) notFound();
  const { q } = await searchParams;
  const customer = await db.customer.findFirst({ where: { demoSessionId: sessionId } });
  if (!customer) notFound();

  const searchQuery = (q || "").trim().toLowerCase();

  const [claims, registrations] = await Promise.all([
    db.warrantyClaim.findMany({
      where: {
        registration: {
          customerId: customer.id,
          unit: { brand: { demoSessionId: sessionId } },
        },
      },
      include: {
        registration: {
          include: {
            unit: { include: { productModel: true, brand: true } },
          },
        },
      },
      orderBy: { submittedAt: "desc" },
    }),
    db.warrantyRegistration.findMany({
      where: { customerId: customer.id, unit: { brand: { demoSessionId: sessionId } } },
      include: { unit: { include: { brand: true, productModel: true } } },
    }),
  ]);

  const brand = registrations[0]?.unit.brand || { name: "Kestrel Audio" };

  const filteredClaims = searchQuery
    ? claims.filter(
        (c) =>
          c.reference.toLowerCase().includes(searchQuery) ||
          c.issueTitle.toLowerCase().includes(searchQuery) ||
          c.registration.unit.productModel.name.toLowerCase().includes(searchQuery)
      )
    : claims;

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
            marginBottom: 24,
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
              SUPPORT CENTER
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
              We’re here to help.
            </h1>
            <p style={{ margin: 0, color: "#777b78", fontSize: 15 }}>
              Find answers, contact your brand or track an existing warranty claim.
            </p>
          </div>
          <Link
            className="action"
            href={`/demo/${sessionId}/customer/claims/new`}
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
            <Plus size={15} /> Raise a warranty claim
          </Link>
        </div>

        {/* Search Bar */}
        <form
          action={`/demo/${sessionId}/customer/claims`}
          method="get"
          style={{
            background: "#fff",
            border: "1px solid #eae8e3",
            borderRadius: 8,
            padding: "11px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            maxWidth: 580,
            marginBottom: 28,
          }}
        >
          <Search size={16} color="#8a8984" />
          <input
            name="q"
            defaultValue={q || ""}
            placeholder="Search support topics or claims..."
            style={{
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: 13,
              color: "#171918",
              width: "100%",
            }}
          />
        </form>

        {/* 3 Action Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 18,
            marginBottom: 32,
          }}
        >
          {/* Card 1 */}
          <Link
            href={`/demo/${sessionId}/customer/claims/new`}
            style={{
              background: "#fff",
              border: "1px solid #eae8e3",
              borderRadius: 12,
              padding: "22px 20px",
              textDecoration: "none",
              display: "flex",
              flexDirection: "column",
              transition: "transform 0.2s, box-shadow 0.2s",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: "#edf6ef",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#28613a",
                }}
              >
                <ShieldCheck size={18} strokeWidth={1.6} />
              </div>
              <ArrowRight size={16} color="#8a8984" />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#171918", margin: "16px 0 4px" }}>
              Start a claim
            </div>
            <div style={{ fontSize: 12, color: "#777b78" }}>
              Report an issue with a registered product.
            </div>
          </Link>

          {/* Card 2 */}
          <a
            href="#support-requests"
            style={{
              background: "#fff",
              border: "1px solid #eae8e3",
              borderRadius: 12,
              padding: "22px 20px",
              textDecoration: "none",
              display: "flex",
              flexDirection: "column",
              transition: "transform 0.2s, box-shadow 0.2s",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: "#edf6ef",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#28613a",
                }}
              >
                <Clock size={18} strokeWidth={1.6} />
              </div>
              <ArrowRight size={16} color="#8a8984" />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#171918", margin: "16px 0 4px" }}>
              Track my claim
            </div>
            <div style={{ fontSize: 12, color: "#777b78" }}>
              Follow updates from your brand in one place.
            </div>
          </a>

          {/* Card 3 */}
          <Link
            href={`/demo/${sessionId}/customer`}
            style={{
              background: "#fff",
              border: "1px solid #eae8e3",
              borderRadius: 12,
              padding: "22px 20px",
              textDecoration: "none",
              display: "flex",
              flexDirection: "column",
              transition: "transform 0.2s, box-shadow 0.2s",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: "#edf6ef",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#28613a",
                }}
              >
                <FileText size={18} strokeWidth={1.6} />
              </div>
              <ArrowRight size={16} color="#8a8984" />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#171918", margin: "16px 0 4px" }}>
              Warranty information
            </div>
            <div style={{ fontSize: 12, color: "#777b78" }}>
              Check what’s covered and for how long.
            </div>
          </Link>
        </div>

        {/* Your Support Requests Panel */}
        <section
          id="support-requests"
          style={{
            background: "#fff",
            border: "1px solid #eae8e3",
            borderRadius: 12,
            overflow: "hidden",
            marginBottom: 32,
          }}
        >
          <div
            style={{
              padding: "20px 24px",
              borderBottom: "1px solid #f0efed",
            }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#171918", margin: "0 0 4px" }}>
              Your support requests
            </h2>
            <p style={{ margin: 0, fontSize: 12, color: "#777b78" }}>
              Updates from the brands you purchased from
            </p>
          </div>

          <div>
            {filteredClaims.length > 0 ? (
              filteredClaims.map((claim) => {
                const isHeadphones = !claim.registration.unit.productModel.slug.includes("charge");
                const badge = statusStyles[claim.status] || {
                  bg: "#fef3cd",
                  text: "#856404",
                  label: claim.status,
                };

                return (
                  <Link
                    key={claim.id}
                    href={`/demo/${sessionId}/customer/claims/${claim.id}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "38px minmax(180px, 1.2fr) minmax(200px, 2fr) auto auto",
                      alignItems: "center",
                      gap: 18,
                      padding: "18px 24px",
                      borderBottom: "1px solid #f0efed",
                      textDecoration: "none",
                      transition: "background 0.15s",
                    }}
                  >
                    {/* Icon */}
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 8,
                        background: "#f4f2ed",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#28613a",
                        flexShrink: 0,
                      }}
                    >
                      {isHeadphones ? (
                        <Headphones size={18} strokeWidth={1.4} />
                      ) : (
                        <Box size={18} strokeWidth={1.4} />
                      )}
                    </div>

                    {/* Reference & Model */}
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#777b78",
                          fontFamily: "monospace",
                          marginBottom: 3,
                        }}
                      >
                        {claim.reference}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#171918" }}>
                        {claim.registration.unit.productModel.name}
                      </div>
                    </div>

                    {/* Issue Description */}
                    <div
                      style={{
                        fontSize: 13,
                        color: "#555e50",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {claim.issueTitle}
                    </div>

                    {/* Status badge */}
                    <div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "4px 10px",
                          borderRadius: 6,
                          background: badge.bg,
                          color: badge.text,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {badge.label}
                      </span>
                    </div>

                    {/* Arrow */}
                    <div>
                      <ArrowRight size={16} color="#171918" />
                    </div>
                  </Link>
                );
              })
            ) : (
              <div
                style={{
                  padding: "42px 24px",
                  textAlign: "center",
                  color: "#777b78",
                  fontSize: 13,
                }}
              >
                {searchQuery
                  ? "No support requests matching your search."
                  : "No support requests found. Raise a claim if you ever need help with your registered products."}
              </div>
            )}
          </div>
        </section>

        <p className="footer-note">
          Demo workspace · Products and coverage records from your brand
        </p>
      </main>
    </>
  );
}
