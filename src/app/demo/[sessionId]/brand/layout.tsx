import { BrandNav } from "@/components/brand-nav";
import { requireBrand } from "@/lib/brand";
import { RouteTransition } from "@/components/route-transition";
import "@/app/brand.css";

export const dynamic = "force-dynamic";

export default async function BrandLayout({ children, params }: { children: React.ReactNode; params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const brand = await requireBrand(sessionId);
  return <div className="business-shell"><BrandNav sessionId={sessionId} brandName={brand.name}/><div className="business-main"><header className="business-topbar"><span style={{fontSize:"12px",color:"#555e50"}}>{brand.name} <span className="business-muted" style={{fontSize:"12px"}}>/</span> <span className="business-muted" style={{fontSize:"12px"}}>Workspace</span></span><div style={{display:"flex",alignItems:"center",gap:"12px"}}><div style={{display:"flex",alignItems:"center",gap:"8px",background:"#f7f8f5",border:"1px solid #e8e9e6",borderRadius:"6px",padding:"7px 12px",width:"200px"}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b9180" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg><span style={{fontSize:"12px",color:"#8b9180"}}>Search Vouch...</span></div><div style={{position:"relative"}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#555e50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg><span style={{position:"absolute",top:"-3px",right:"-3px",width:"6px",height:"6px",borderRadius:"50%",background:"#ef6b5e"}}></span></div><div style={{width:"30px",height:"30px",borderRadius:"50%",background:"#e8ebe4",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"12px",fontWeight:700,color:"#4a5442"}}>A</div><span style={{fontSize:"12px",color:"#555e50"}}>Aarav</span></div></header><main className="business-content"><RouteTransition>{children}</RouteTransition></main></div></div>;

}
