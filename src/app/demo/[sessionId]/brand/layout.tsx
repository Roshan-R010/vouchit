import { BrandNav } from "@/components/brand-nav";
import { requireBrand } from "@/lib/brand";
import { RouteTransition } from "@/components/route-transition";
import "@/app/brand.css";

export const dynamic = "force-dynamic";

export default async function BrandLayout({ children, params }: { children: React.ReactNode; params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const brand = await requireBrand(sessionId);
  return <div className="business-shell"><BrandNav sessionId={sessionId} brandName={brand.name}/><div className="business-main"><header className="business-topbar"><span>{brand.name} <span className="business-muted">/ Workspace</span></span><span className="business-demo-label">Interactive demo</span></header><main className="business-content"><RouteTransition>{children}</RouteTransition></main></div></div>;
}
