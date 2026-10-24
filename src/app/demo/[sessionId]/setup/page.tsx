import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { isUuid } from "@/lib/brand";
import { BrandIdentityForm } from "@/components/brand-identity-form";
import "@/app/brand.css";

export const dynamic = "force-dynamic";

export default async function BrandSetup({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  if (!isUuid(sessionId)) notFound();
  const session = await db.demoSession.findUnique({ where: { id: sessionId }, include: { brands: { select: { id: true } } } });
  if (!session) redirect("/demo?view=brand");
  if (session.brands.length) redirect(`/demo/${sessionId}/brand`);
  return <main className="page-wrap"><div className="form-shell"><header className="form-header"><div className="brandmark"><span className="brandmark-symbol">V</span>vouch</div><h1>Create your brand</h1><p>Add your name and logo, then create products and share their registration links.</p></header><BrandIdentityForm sessionId={sessionId}/></div></main>;
}
