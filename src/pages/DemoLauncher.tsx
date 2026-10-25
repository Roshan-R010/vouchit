import { apiFetch } from "@/lib/api-fetch";
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export function DemoLauncher() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function initSession() {
      try {
        const view = searchParams.get("view") === "brand" ? "brand" : "customer";
        const savedSession = localStorage.getItem("vouch-demo-session");

        // A saved workspace already has its route. Do not make the visitor wait for
        // a database lookup just to navigate to it.
        if (savedSession && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(savedSession)) {
          const destination = localStorage.getItem("vouch-demo-has-brand") === "false" ? "setup" : view;
          navigate(`/demo/${savedSession}/${destination}`, { replace: true });
          return;
        }
        if (savedSession) localStorage.removeItem("vouch-demo-session");

        const response = await apiFetch("/api/demo/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });

        if (!response.ok) {
          throw new Error("Could not initialize workspace");
        }

        const data = await response.json();
        if (data.sessionId && active) {
          localStorage.setItem("vouch-demo-session", data.sessionId);
          localStorage.setItem("vouch-demo-has-brand", String(Boolean(data.hasBrand)));
          navigate(`/demo/${data.sessionId}/${data.hasBrand ? view : "setup"}`, { replace: true });
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || "Failed to start workspace");
        }
      }
    }

    initSession();

    return () => {
      active = false;
    };
  }, [searchParams, navigate]);

  if (error) {
    return (
      <main className="page-wrap" style={{ display: "grid", placeItems: "center", minHeight: "80vh" }}>
        <div className="blank-state">
          <p>{error}</p>
          <button
            className="action"
            onClick={() => {
              localStorage.removeItem("vouch-demo-session");
              window.location.reload();
            }}
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "80vh", fontFamily: "DM Sans, sans-serif" }}>
      <div style={{ textAlign: "center", color: "#555" }}>
        <div
          style={{
            width: "36px",
            height: "36px",
            border: "3px solid #e0dfdb",
            borderTopColor: "#ef6b5e",
            borderRadius: "50%",
            animation: "business-spin 0.8s linear infinite",
            margin: "0 auto 16px",
          }}
        />
        <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#222", margin: "0 0 6px" }}>Opening Vouch</h2>
        <p style={{ fontSize: "15px", color: "#777", margin: 0 }}>Opening your workspace...</p>
      </div>
    </div>
  );
}
export default DemoLauncher;
