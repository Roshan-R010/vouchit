import { Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireBrand } from "@/lib/brand";
import { isCoverageActive } from "@/lib/dates";

export default async function CustomersPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const brand = await requireBrand(sessionId);
  const customers = await db.customer.findMany({ where: { demoSessionId: sessionId }, include: { registrations: { where: { unit: { brandId: brand.id } }, include: { claim: { select: { id: true } } } } }, orderBy: { name: "asc" } });
  return <><div className="business-page-header"><div><div className="business-eyebrow">People & coverage</div><h1>Customers</h1><p>Customer details from product registrations in this workspace.</p></div></div><section className="business-panel"><div className="business-table-wrap"><table className="business-table"><thead><tr><th>Customer</th><th>Contact email</th><th>Registered products</th><th>Active warranties</th><th>Claims</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.id}><td><div className="business-person"><span>{customer.name.slice(0, 1)}</span><strong>{customer.name}</strong></div></td><td>{customer.email}</td><td>{customer.registrations.length}</td><td>{customer.registrations.filter((registration) => isCoverageActive(registration.coverageEndsOn)).length}</td><td>{customer.registrations.reduce((total, registration) => total + (registration.claim ? 1 : 0), 0)}</td></tr>)}</tbody></table>{!customers.length && <div className="business-empty"><Users size={28}/><p>Customers will appear here when they register a product.</p></div>}</div></section><p className="business-hint">This interactive demo uses one fictional customer per session.</p></>;
}
