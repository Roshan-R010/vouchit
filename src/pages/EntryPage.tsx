import { Link } from "react-router-dom";
import { VouchLogo } from "@/components/vouch-logo";
import "@/app/auth.css";

export default function EntryPage() {
  return <main className="auth-page"><div className="auth-box"><VouchLogo/><h1>Welcome to Vouch.</h1><p>Choose how you want to continue.</p><div className="auth-choice"><Link to="/login/customer">Customer</Link><Link to="/login/brand">Brand</Link></div></div></main>;
}
