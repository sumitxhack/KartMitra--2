import { BrowserRouter, Routes, Route } from "react-router-dom";

import EntranceQR from "./pages/EntranceQR/EntranceQR";
import Home from "./pages/Home/Home";
import Login from "./pages/Login/Login";
import Shopping from "./pages/Shopping/Shopping";
import ScanProduct from "./pages/ScanProduct/ScanProduct";
import ProductDetails from "./pages/ProductDetails/ProductDetails";
import ProductSummary from "./pages/ProductSummary/ProductSummary";
import Payment from "./pages/Payment/Payment";
import Verification from "./pages/Verification/Verification";
import ThankYou from "./pages/ThankYou/ThankYou";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Entrance QR Display */}
        <Route path="/" element={<EntranceQR />} />

        {/* Existing pages */}
        <Route path="/home" element={<Home />} />
        <Route path="/login" element={<Login />} />
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

      </Routes>
    </BrowserRouter>
  );
}

export default App;