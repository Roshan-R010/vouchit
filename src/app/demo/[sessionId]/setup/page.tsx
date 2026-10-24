import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { isUuid } from "@/lib/brand";
import { BrandSetupForm } from "@/components/brand-product-form";
import "@/app/brand.css";

export const dynamic = "force-dynamic";

export default async function BrandSetupPage({ params, searchParams }: { params: Promise<{ sessionId: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { sessionId } = await params;
  const query = await searchParams;
  if (!isUuid(sessionId)) notFound();
  const session = await db.demoSession.findUnique({ where: { id: sessionId }, select: { id: true, brands: { select: { id: true } } } });
  if (!session) notFound();
  if (session.brands[0]) redirect(`/demo/${sessionId}/brand`);
  return <main className="business-setup"><div className="business-form-page"><div className="business-logo"><span>v</span>vouch<span className="business-logo-label">Business</span></div><div className="business-page-header"><div><div className="business-eyebrow">New workspace</div><h1>Build your warranty experience.</h1><p>There are no sample records here. Create your brand, then add products and units for customers to register.</p></div></div>{query.notice === "cleared" && <div className="business-notice" role="status">Your workspace was cleared. Create a new brand to continue.</div>}<BrandSetupForm sessionId={sessionId}/></div></main>;
}
