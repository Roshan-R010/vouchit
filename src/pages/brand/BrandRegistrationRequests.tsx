import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "@/lib/api-fetch";
import { readApiResponse } from "@/lib/api-response";
import { dateOnly, formatDate } from "@/lib/dates";

type Request = {
  id: string; status: "PENDING" | "APPROVED" | "REJECTED"; requestedAt: string; reviewedAt: string | null;
  deliveredOn: string; deadlineOn: string; windowDays: number; rejectionReason: string | null;
  customer: { name: string; email: string }; productModel: { name: string }; unit: { serialNumber: string };
  sale: { purchaseOrder: { orderNumber: string } };
};

export default function BrandRegistrationRequests({ embedded = false }: { embedded?: boolean }) {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [status, setStatus] = useState<Request["status"]>("PENDING");
  const [requests, setRequests] = useState<Request[]>([]);
  const [selected, setSelected] = useState<Request | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reason, setReason] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    setLoading(true); setError("");
    apiFetch(`/api/demo/${sessionId}/brand/registration-requests?status=${status}`, { cache: "no-store" }).then(readApiResponse)
      .then((data: { requests: Request[] }) => { if (active) { setRequests(data.requests); setSelected(current => data.requests.find(item => item.id === current?.id) || null); } })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Could not load requests."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [sessionId, status, revision]);

  async function review(action: "APPROVE" | "REJECT") {
    if (!sessionId || !selected || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await readApiResponse(await apiFetch(`/api/demo/${sessionId}/brand/registration-requests/${selected.id}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, reason }) }));
      setNotice(action === "APPROVE" ? "Registration approved." : "Request rejected.");
      setSelected(null); setReason(""); setRevision(value => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not review request."); }
    finally { setBusy(false); }
  }

  return <div>
    {!embedded && <div className="business-page-header"><div><div className="business-eyebrow">Warranty Registration</div><h1>Registration Requests</h1><p>Review verified registrations submitted after the brand deadline.</p></div></div>}
    <div className="filters" role="group" aria-label="Request status">{(["PENDING", "APPROVED", "REJECTED"] as const).map(value => <button key={value} type="button" className={`filter ${status === value ? "active" : ""}`} onClick={() => { setStatus(value); setSelected(null); }}>{value[0] + value.slice(1).toLowerCase()}</button>)}</div>
    {notice && <div className="business-notice" role="status">{notice}</div>}
    {error && <div className="notice error" role="alert">{error}</div>}
    {loading ? <p>Loading requests…</p> : requests.length === 0 ? <div className="blank-state"><h2>No {status.toLowerCase()} requests</h2><p>Requests will appear here when customers submit them.</p></div> : <div className="business-panel" style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 650 }}><thead><tr><th align="left">Customer</th><th align="left">Product / Unit ID</th><th align="left">Order ID</th><th align="left">Deadline</th><th align="left">Submitted</th><th align="left">Status</th><th /></tr></thead><tbody>{requests.map(item => <tr key={item.id}><td>{item.customer.name}<br /><small>{item.customer.email}</small></td><td>{item.productModel.name}<br /><small>{item.unit.serialNumber}</small></td><td>{item.sale.purchaseOrder.orderNumber}</td><td>{formatDate(item.deadlineOn)}</td><td>{formatDate(item.requestedAt)}</td><td>{item.status[0] + item.status.slice(1).toLowerCase()}</td><td><button type="button" className="business-button" onClick={() => setSelected(item)}>View</button></td></tr>)}</tbody></table></div>}
    {selected && <div className="business-panel" style={{ marginTop: 20 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}><h2>Request details</h2><button type="button" className="business-button" onClick={() => setSelected(null)}>Close</button></div>
      <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        <div><dt>Customer</dt><dd>{selected.customer.name}<br />{selected.customer.email}</dd></div><div><dt>Product</dt><dd>{selected.productModel.name}</dd></div><div><dt>Unit ID</dt><dd>{selected.unit.serialNumber}</dd></div><div><dt>Order ID</dt><dd>{selected.sale.purchaseOrder.orderNumber}</dd></div><div><dt>Delivery date</dt><dd>{formatDate(selected.deliveredOn)}</dd></div><div><dt>Registration window</dt><dd>{selected.windowDays} days</dd></div><div><dt>Original deadline</dt><dd>{formatDate(selected.deadlineOn)}</dd></div><div><dt>Submitted</dt><dd>{formatDate(selected.requestedAt)}</dd></div><div><dt>Days overdue</dt><dd>{Math.max(0, Math.round((dateOnly(selected.requestedAt).getTime() - dateOnly(selected.deadlineOn).getTime()) / 86400000))}</dd></div><div><dt>Status</dt><dd>{selected.status}</dd></div>
      </dl>
      {selected.status === "PENDING" && <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "end" }}><button type="button" disabled={busy} className="business-button primary" onClick={() => review("APPROVE")}>{busy ? "Processing…" : "Approve Registration"}</button><button type="button" disabled={busy} className="business-button" onClick={() => review("REJECT")}>Reject Registration</button><label style={{ display: "grid", gap: 4 }}>Internal reason (optional)<input value={reason} maxLength={500} onChange={event => setReason(event.target.value)} /></label></div>}
      {selected.rejectionReason && <p>Reason: {selected.rejectionReason}</p>}
    </div>}
  </div>;
}
