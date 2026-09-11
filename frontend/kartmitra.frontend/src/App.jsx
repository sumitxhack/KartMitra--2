import { BrowserRouter, Routes, Route } from "react-router-dom";

import EntranceQR from "./pages/EntranceQR/EntranceQR";
import Home from "./pages/Home/Home";
import Login from "./pages/Login/Login";
import EntryScanner from "./pages/EntryScanner/EntryScanner";
import Shopping from "./pages/Shopping/Shopping";
import ScanProduct from "./pages/ScanProduct/ScanProduct";
import ProductDetails from "./pages/ProductDetails/ProductDetails";
import ProductSummary from "./pages/ProductSummary/ProductSummary";
import Payment from "./pages/Payment/Payment";
import Verification from "./pages/Verification/Verification";
import ThankYou from "./pages/ThankYou/ThankYou";
import ProtectedRoute from "./components/ProtectedRoute";

import AdminEntry from "./pages/Admin/AdminEntry";
import AdminLogin from "./pages/Admin/AdminLogin";
import AdminDashboard from "./pages/Admin/AdminDashboard";
import AdminProducts from "./pages/Admin/AdminProducts";
import AdminAddProduct from "./pages/Admin/AdminAddProduct";
import AdminProtectedRoute from "./components/AdminProtectedRoute";
import AdminLayout from "./components/AdminLayout";

function App() {
  return (
    <BrowserRouter>
      <Routes>

  {/* Customer Public */}
  <Route path="/" element={<EntranceQR />} />
  <Route path="/login" element={<Login />} />

  {/* Customer Protected */}
  {/* <Route element={<ProtectedRoute />}> */}
    <Route path="/home" element={<Home />} />
    <Route path="/entry-scanner" element={<EntryScanner />} />
    <Route path="/shopping" element={<Shopping />} />
    <Route path="/scan-product" element={<ScanProduct />} />
    <Route
      path="/product-details"
      element={<ProductDetails />}
    />
    <Route
      path="/product-summary"
      element={<ProductSummary />}
    />
    <Route path="/payment" element={<Payment />} />
    <Route
      path="/verification"
      element={<Verification />}
    />
    <Route path="/thank-you" element={<ThankYou />} />
  {/* </Route> */}

  {/* Admin Routes */}
  <Route path="/admin" element={<AdminEntry />} />
  <Route path="/admin/login" element={<AdminLogin />} />

  {/* Protected Admin Routes */}
  <Route element={<AdminProtectedRoute />}>
    <Route element={<AdminLayout />}>
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
      <Route path="/admin/products" element={<AdminProducts />} />
      <Route path="/admin/products/add" element={<AdminAddProduct />} />
    </Route>
  </Route>

</Routes>
    </BrowserRouter>
  );
}

export default App;