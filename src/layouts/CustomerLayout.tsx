import { apiFetch } from "@/lib/api-fetch";
import React, { useEffect, useState } from "react";
import { Outlet, useParams } from "react-router-dom";
import { CustomerNav } from "@/components/customer-nav";
import { RouteTransition } from "@/components/route-transition";
import "@/app/globals.css";

export function CustomerLayout() {
  const { sessionId, brandSlug, productSlug } = useParams<{ sessionId: string; brandSlug: string; productSlug: string }>();
  const [customerName, setCustomerName] = useState<string>("Customer");
  const [brandName, setBrandName] = useState<string>("");
  const [brandLogoUrl, setBrandLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    const url = brandSlug && productSlug
      ? `/api/demo/${sessionId}/register/${encodeURIComponent(brandSlug)}/${encodeURIComponent(productSlug)}`
      : `/api/demo/${sessionId}/customer`;
    apiFetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data.customer?.name) setCustomerName(data.customer.name);
        if (data.brand?.name) setBrandName(data.brand.name);
        if (data.brand?.logoUrl) setBrandLogoUrl(data.brand.logoUrl);
      })
      .catch(() => {});
  }, [sessionId, brandSlug, productSlug]);

  return (
    <div>
      <CustomerNav sessionId={sessionId} customerName={customerName} brandName={brandName || undefined} brandLogoUrl={brandLogoUrl} />
      <RouteTransition>
        <Outlet />
      </RouteTransition>
    </div>
  );
}
export default CustomerLayout;
