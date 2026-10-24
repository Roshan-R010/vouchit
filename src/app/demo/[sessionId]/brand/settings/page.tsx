import { requireBrand } from "@/lib/brand";
import { BrandIdentityForm as BrandSettingsForm } from "@/components/brand-identity-form";

export default async function SettingsPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const brand = await requireBrand(sessionId);
  return <div className="business-form-page"><div className="business-page-header"><div><div className="business-eyebrow">Workspace preferences</div><h1>Brand settings</h1><p>Make your brand recognizable throughout the customer experience.</p></div></div><section className="business-panel"><div className="business-panel-header"><div><h2>Brand profile</h2><p>Your product catalog and registration links belong to this workspace.</p></div></div><BrandSettingsForm sessionId={sessionId} brand={brand}/></section></div>;
}
