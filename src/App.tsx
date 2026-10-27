import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import EntryPage from "./pages/EntryPage";
import LoginPage from "./pages/LoginPage";
import BrandSetup from "./pages/BrandSetup";

// Brand Layout & Pages
import BrandLayout from "./layouts/BrandLayout";
import BrandDashboard from "./pages/brand/BrandDashboard";
import BrandClaims from "./pages/brand/BrandClaims";
import BrandClaimDetail from "./pages/brand/BrandClaimDetail";
import BrandProducts from "./pages/brand/BrandProducts";
import BrandProductDetail from "./pages/brand/BrandProductDetail";
import BrandNewProduct from "./pages/brand/BrandNewProduct";
import BrandUnitImport from "./pages/brand/BrandUnitImport";
import BrandCustomers from "./pages/brand/BrandCustomers";
import BrandRegistrations from "./pages/brand/BrandRegistrations";
import BrandAnalytics from "./pages/brand/BrandAnalytics";
import BrandSettings from "./pages/brand/BrandSettings";

// Customer Layout & Pages
import CustomerLayout from "./layouts/CustomerLayout";
import CustomerDashboard from "./pages/customer/CustomerDashboard";
import CustomerProductDetail from "./pages/customer/CustomerProductDetail";
import CustomerNewClaim from "./pages/customer/CustomerNewClaim";
import CustomerClaimDetail from "./pages/customer/CustomerClaimDetail";
import CustomerRegister from "./pages/customer/CustomerRegisterPortal";
import CustomerSupport from "./pages/customer/CustomerSupport";

function RequireRole({ role, children }: { role: "BRAND" | "CUSTOMER"; children: React.ReactNode }) {
  const { account, loading } = useAuth();
  const location = useLocation();
  if (loading) return <main className="auth-page"><p>Opening your account…</p></main>;
  if (!account || account.role !== role) return <Navigate to={`/login/${role.toLowerCase()}?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (role === "BRAND" && account.demoSessionId !== location.pathname.split("/")[2]) return <Navigate to={`/demo/${account.demoSessionId}/brand`} replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      {/* Landing page */}
      <Route path="/" element={<EntryPage />} />
      <Route path="/login/:role" element={<LoginPage />} />

      {/* Demo launcher / session resolver */}
      <Route path="/demo" element={<Navigate to="/" replace />} />
      <Route path="/demo/:sessionId/setup" element={<RequireRole role="BRAND"><BrandSetup /></RequireRole>} />

      {/* Brand Workspace Routes */}
      <Route path="/demo/:sessionId/brand" element={<RequireRole role="BRAND"><BrandLayout /></RequireRole>}>
        <Route index element={<BrandDashboard />} />
        <Route path="claims" element={<BrandClaims />} />
        <Route path="claims/:claimId" element={<BrandClaimDetail />} />
        <Route path="products" element={<BrandProducts />} />
        <Route path="products/new" element={<BrandNewProduct />} />
        <Route path="products/import" element={<BrandUnitImport />} />
        <Route path="products/:productId" element={<BrandProductDetail />} />
        <Route path="customers" element={<BrandCustomers />} />
        <Route path="registrations" element={<BrandRegistrations />} />
        <Route path="analytics" element={<BrandAnalytics />} />
        <Route path="settings" element={<BrandSettings />} />
      </Route>

      {/* Customer Portal Routes */}
      <Route path="/customer" element={<RequireRole role="CUSTOMER"><CustomerLayout /></RequireRole>}>
        <Route index element={<CustomerDashboard />} />
        <Route path="claims" element={<CustomerSupport />} />
      </Route>
      <Route path="/demo/:sessionId/customer" element={<RequireRole role="CUSTOMER"><CustomerLayout /></RequireRole>}>
        <Route index element={<CustomerDashboard />} />
        <Route path="products/:unitId" element={<CustomerProductDetail />} />
        <Route path="claims" element={<CustomerSupport />} />
        <Route path="claims/new" element={<CustomerNewClaim />} />
        <Route path="claims/:claimId" element={<CustomerClaimDetail />} />
      </Route>

      {/* Direct unit registration route */}
      <Route path="/demo/:sessionId/register/:brandSlug/:productSlug" element={<CustomerLayout />}>
        <Route index element={<CustomerRegister />} />
      </Route>

      {/* Default fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
export default App;
