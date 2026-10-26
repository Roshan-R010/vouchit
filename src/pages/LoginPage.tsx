import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { VouchLogo } from "@/components/vouch-logo";
import { apiFetch } from "@/lib/api-fetch";
import { useAuth, type Account } from "@/lib/auth-context";
import "@/app/auth.css";

export default function LoginPage() {
  const { role } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [creating, setCreating] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isBrand = role === "brand";
  const next = params.get("next");

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const response = await apiFetch(`/api/auth/${creating ? "signup" : "login"}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: isBrand ? "BRAND" : "CUSTOMER", username, password, ...(creating ? { displayName, email } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not sign in.");
      await refresh();
      const account = data.account as Account;
      if (account.demoSessionId) localStorage.setItem("vouch-demo-session", account.demoSessionId);
      const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : null;
      navigate(isBrand ? `/demo/${account.demoSessionId}/${creating || !data.hasBrand ? "setup" : "brand"}` : safeNext || "/customer", { replace: true });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not sign in."); }
    finally { setBusy(false); }
  }

  if (role !== "brand" && role !== "customer") return null;
  return <main className="auth-page"><section className="auth-box"><Link to="/"><VouchLogo/></Link><span className="auth-eyebrow">{isBrand ? "Brand account" : "Customer account"}</span><h1>{creating ? "Create an account" : "Sign in"}</h1><p>{creating ? "Set up a username and password to continue." : "Enter your username and password."}</p><form onSubmit={submit}>
    {creating && <><label>Full name<input value={displayName} onChange={e => setDisplayName(e.target.value)} autoComplete="name" required/></label>{!isBrand && <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required/></label>}</>}
    <label>Username<input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" minLength={3} maxLength={32} required/></label>
    <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={creating ? "new-password" : "current-password"} minLength={8} required/></label>
    {error && <p className="auth-error" role="alert">{error}</p>}
    <button type="submit" disabled={busy}>{busy ? "Please wait…" : creating ? "Create account" : "Sign in"}</button>
  </form><div className="auth-foot"><button type="button" onClick={() => { setCreating(!creating); setError(""); }}>{creating ? "Already have an account? Sign in" : "New here? Create an account"}</button><Link to="/">Back</Link></div></section></main>;
}
