import Link from "next/link";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { ArrowLeft, CircleCheck, Headphones } from "lucide-react";
import { CustomerNav } from "@/components/customer-nav";
import { ClaimForm } from "@/components/claim-form";
import { db } from "@/lib/db";
import { daysRemaining, formatDate, isCoverageActive } from "@/lib/dates";

type Props = {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ unitId?: string; error?: string }>;
};

export default async function NewClaimPage({ params, searchParams }: Props) {
  const { sessionId } = await params;
  const query = await searchParams;
  const unitId = query.unitId || "";

  const registration = unitId
    ? await db.warrantyRegistration.findFirst({
        where: { unitId, customer: { demoSessionId: sessionId } },
        include: {
          claim: { select: { id: true } },
          unit: { include: { productModel: true, purchaseOrder: true } },
        },
      })
    : null;

  if (!registration) {
    const allRegistrations = await db.warrantyRegistration.findMany({
      where: { customer: { demoSessionId: sessionId } },
      include: {
        claim: { select: { id: true } },
        unit: { include: { productModel: true, purchaseOrder: true } },
      },
      orderBy: { registeredAt: "desc" },
    });

    return (
      <>
        <CustomerNav sessionId={sessionId} />
        <main className="page-wrap content" style={{ paddingTop: 32 }}>
          <div className="form-shell">
            <header className="form-header">
              <Link href={`/demo/${sessionId}/customer`} className="muted" style={{ fontSize: 12 }}>
                <ArrowLeft size={13} style={{ verticalAlign: "middle" }} /> Back to products
              </Link>
              <div className="eyebrow" style={{ marginTop: 18 }}>Raise a claim</div>
              <h1>Select a product</h1>
              <p>Choose which of your registered products you need assistance with.</p>
            </header>
            <div className="form-body">
              {allRegistrations.length > 0 ? (
                <div style={{ display: "grid", gap: 12 }}>
                  {allRegistrations.map((reg) => {
                    const days = daysRemaining(reg.coverageEndsOn);
                    const active = isCoverageActive(reg.coverageEndsOn);
                    const hasClaim = !!reg.claim;
                    return (
                      <Link
                        key={reg.id}
                        href={
                          hasClaim
                            ? `/demo/${sessionId}/customer/claims/${reg.claim!.id}`
                            : `/demo/${sessionId}/customer/claims/new?unitId=${reg.unitId}`
                        }
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "16px 20px",
                          borderRadius: 10,
                          border: "1px solid #eae8e3",
                          background: "#fff",
                          textDecoration: "none",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: "#171918" }}>
                            {reg.unit.productModel.name}
                          </div>
                          <div style={{ fontSize: 11, color: "#777b78", marginTop: 4 }}>
                            Unit {reg.unit.serialNumber} · {days} days remaining
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: hasClaim ? "#856404" : "#28613a",
                            background: hasClaim ? "#fef3cd" : "#eaf4e9",
                            padding: "4px 10px",
                            borderRadius: 6,
                          }}
                        >
                          {hasClaim ? "Claim exists →" : "Select product →"}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div>
                  <p style={{ color: "#777b78", fontSize: 13, marginBottom: 16 }}>
                    You don't have any registered products yet.
                  </p>
                  <Link className="action" href={`/demo/${sessionId}/register`}>
                    Register a product
                  </Link>
                </div>
              )}
            </div>
          </div>
        </main>
      </>
    );
  }

  if (registration.claim) redirect(`/demo/${sessionId}/customer/claims/${registration.claim.id}`);
  const remaining = daysRemaining(registration.coverageEndsOn);

  return (
    <>
      <CustomerNav sessionId={sessionId} />
      <main className="page-wrap content" style={{ paddingTop: 32 }}>
        <div className="form-shell">
          <header className="form-header">
            <Link href={`/demo/${sessionId}/customer`} className="muted" style={{ fontSize: 12 }}>
              <ArrowLeft size={13} style={{ verticalAlign: "middle" }} /> Back to products
            </Link>
            <div className="eyebrow" style={{ marginTop: 18 }}>Warranty claim · Demo</div>
            <h1>Tell us what is going on.</h1>
            <p>We will share the details with {registration.unit.productModel.name} support.</p>
          </header>
          <div className="form-body">
            <div className="match-panel">
              <strong>
                <Headphones size={15} style={{ verticalAlign: "middle", marginRight: 7 }} />
                {registration.unit.productModel.name}
              </strong>
              <p>
                Unit {registration.unit.serialNumber} · Delivered{" "}
                {registration.unit.purchaseOrder.deliveredOn
                  ? formatDate(registration.unit.purchaseOrder.deliveredOn)
                  : "—"}{" "}
                · Covered through {formatDate(registration.coverageEndsOn)}
              </p>
              <p>
                <CircleCheck
                  size={13}
                  style={{
                    verticalAlign: "middle",
                    marginRight: 5,
                    color: remaining ? "#428c56" : "#a44",
                  }}
                />
                {remaining > 0
                  ? `${remaining} days of warranty remaining`
                  : "Warranty coverage has ended"}
              </p>
            </div>
            {remaining === 0 ? (
              <div className="notice error">
                This unit is outside its warranty coverage and cannot start a warranty claim in this
                demo.
              </div>
            ) : (
              <ClaimForm sessionId={sessionId} unitId={unitId} submissionId={randomUUID()}/>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
