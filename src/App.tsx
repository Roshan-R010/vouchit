import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import DemoLauncher from "./pages/DemoLauncher";
import BrandSetup from "./pages/BrandSetup";

// Brand Layout & Pages
import BrandLayout from "./layouts/BrandLayout";
import BrandDashboard from "./pages/brand/BrandDashboard";
import BrandClaims from "./pages/brand/BrandClaims";
import BrandClaimDetail from "./pages/brand/BrandClaimDetail";
import BrandProducts from "./pages/brand/BrandProducts";
import BrandProductDetail from "./pages/brand/BrandProductDetail";
import BrandNewProduct from "./pages/brand/BrandNewProduct";
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
import CustomerRegister from "./pages/customer/CustomerRegister";
import CustomerProductPicker from "./pages/customer/CustomerProductPicker";
import CustomerSupport from "./pages/customer/CustomerSupport";

export function App() {
  return (
    <Routes>
      {/* Landing page */}
      <Route path="/" element={<LandingPage />} />

      {/* Demo launcher / session resolver */}
      <Route path="/demo" element={<DemoLauncher />} />
      <Route path="/demo/:sessionId/setup" element={<BrandSetup />} />

      {/* Brand Workspace Routes */}
      <Route path="/demo/:sessionId/brand" element={<BrandLayout />}>
        <Route index element={<BrandDashboard />} />
        <Route path="claims" element={<BrandClaims />} />
        <Route path="claims/:claimId" element={<BrandClaimDetail />} />
        <Route path="products" element={<BrandProducts />} />
        <Route path="products/new" element={<BrandNewProduct />} />
        <Route path="products/:productId" element={<BrandProductDetail />} />
        <Route path="customers" element={<BrandCustomers />} />
        <Route path="registrations" element={<BrandRegistrations />} />
        <Route path="analytics" element={<BrandAnalytics />} />
        <Route path="settings" element={<BrandSettings />} />
      </Route>

      {/* Customer Portal Routes */}
      <Route path="/demo/:sessionId/customer" element={<CustomerLayout />}>
        <Route index element={<CustomerDashboard />} />
        <Route path="register" element={<CustomerProductPicker />} />
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
