import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
const EntryPage = lazy(() => import("./pages/EntryPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const BrandSetup = lazy(() => import("./pages/BrandSetup"));

// Brand Layout & Pages
const BrandLayout = lazy(() => import("./layouts/BrandLayout"));
const BrandDashboard = lazy(() => import("./pages/brand/BrandDashboard"));
const BrandClaims = lazy(() => import("./pages/brand/BrandClaims"));
const BrandClaimDetail = lazy(() => import("./pages/brand/BrandClaimDetail"));
const BrandProducts = lazy(() => import("./pages/brand/BrandProducts"));
const BrandProductDetail = lazy(() => import("./pages/brand/BrandProductDetail"));
const BrandNewProduct = lazy(() => import("./pages/brand/BrandNewProduct"));
const BrandUnitImport = lazy(() => import("./pages/brand/BrandUnitImport"));
const BrandCustomers = lazy(() => import("./pages/brand/BrandCustomers"));
const BrandRegistrations = lazy(() => import("./pages/brand/BrandRegistrations"));
const BrandAnalytics = lazy(() => import("./pages/brand/BrandAnalytics"));
const BrandSettings = lazy(() => import("./pages/brand/BrandSettings"));

// Customer Layout & Pages
const CustomerLayout = lazy(() => import("./layouts/CustomerLayout"));
const CustomerDashboard = lazy(() => import("./pages/customer/CustomerDashboard"));
const CustomerProductDetail = lazy(() => import("./pages/customer/CustomerProductDetail"));
const CustomerNewClaim = lazy(() => import("./pages/customer/CustomerNewClaim"));
const CustomerClaimDetail = lazy(() => import("./pages/customer/CustomerClaimDetail"));
const CustomerRegister = lazy(() => import("./pages/customer/CustomerRegisterPortal"));
const CustomerSupport = lazy(() => import("./pages/customer/CustomerSupport"));
const CustomerSettings = lazy(() => import("./pages/customer/CustomerSettings"));

function RequireRole({ role, children }: { role: "BRAND" | "CUSTOMER"; children: React.ReactNode }) {
  const { account, loading } = useAuth();
  const location = useLocation();
  if (loading) return <main className="auth-page"><p>Opening your account…</p></main>;
  if (!account || account.role !== role) return <Navigate to={`/login/${role.toLowerCase()}?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (role === "BRAND" && account.demoSessionId !== location.pathname.split("/")[2]) return <Navigate to={`/demo/${account.demoSessionId}/brand`} replace />;
  return <>{children}</>;
}

function RegistrationRequestsRedirect() {
  const { sessionId } = useParams<{ sessionId: string }>();
  return <Navigate to={`/demo/${sessionId}/brand/registrations?view=requests`} replace />;
}

export function App() {
  return (
    <Suspense fallback={<main className="auth-page"><p>Loading…</p></main>}><Routes>
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
        <Route path="registration-requests" element={<RegistrationRequestsRedirect />} />
        <Route path="analytics" element={<BrandAnalytics />} />
        <Route path="settings" element={<BrandSettings />} />
      </Route>

      {/* Customer Portal Routes */}
      <Route path="/customer" element={<RequireRole role="CUSTOMER"><CustomerLayout /></RequireRole>}>
        <Route index element={<CustomerDashboard />} />
        <Route path="claims" element={<CustomerSupport />} />
        <Route path="settings" element={<CustomerSettings />} />
      </Route>
      <Route path="/demo/:sessionId/customer" element={<RequireRole role="CUSTOMER"><CustomerLayout /></RequireRole>}>
        <Route index element={<CustomerDashboard />} />
        <Route path="settings" element={<CustomerSettings />} />
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
    </Routes></Suspense>
  );
}
export default App;
