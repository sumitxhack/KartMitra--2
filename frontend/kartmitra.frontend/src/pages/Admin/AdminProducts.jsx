import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Package,
  PlusCircle,
  Search,
  RefreshCw,
  Barcode,
  CheckCircle2,
  Filter,
} from "lucide-react";
import apiClient from "../../api/client";

const FALLBACK_PRODUCTS = [
  {
    _id: "demo-1",
    name: "Amul Taaza Homogenised Toned Milk 1L",
    barcode: "8901262010053",
    sku: "AMUL-MILK-1L",
    price: 62.0,
    weight: 1000,
    weightUnit: "g",
    category: "Dairy",
    isActive: true,
  },
  {
    _id: "demo-2",
    name: "Britannia Good Day Butter Cookies 100g",
    barcode: "8901063012117",
    sku: "BRIT-GD-100G",
    price: 30.0,
    weight: 100,
    weightUnit: "g",
    category: "Snacks",
    isActive: true,
  },
  {
    _id: "demo-3",
    name: "Tata Salt Vacuum Evaporated 1kg",
    barcode: "8901058852896",
    sku: "TATA-SALT-1KG",
    price: 28.0,
    weight: 1000,
    weightUnit: "g",
    category: "Groceries",
    isActive: true,
  },
  {
    _id: "demo-4",
    name: "Coca-Cola Original Taste 750ml",
    barcode: "8901764012232",
    sku: "COKE-750ML",
    price: 40.0,
    weight: 750,
    weightUnit: "ml",
    category: "Beverages",
    isActive: true,
  },
  {
    _id: "demo-5",
    name: "Parle-G Original Glucose Biscuits 250g",
    barcode: "8901719101035",
    sku: "PARLE-G-250G",
    price: 25.0,
    weight: 250,
    weightUnit: "g",
    category: "Snacks",
    isActive: true,
  },
  {
    _id: "demo-6",
    name: "Maggi 2-Minute Noodles Masala 70g",
    barcode: "8901058857433",
    sku: "MAGGI-70G",
    price: 14.0,
    weight: 70,
    weightUnit: "g",
    category: "Groceries",
    isActive: true,
  },
];

const AdminProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [usingMock, setUsingMock] = useState(false);

  const fetchProducts = async () => {
    try {
      const res = await apiClient("/products");
      if (res && res.data && Array.isArray(res.data)) {
        setProducts(res.data);
        setUsingMock(false);
      } else if (Array.isArray(res)) {
        setProducts(res);
        setUsingMock(false);
      } else {
        setProducts(FALLBACK_PRODUCTS);
        setUsingMock(true);
      }
    } catch (err) {
      console.warn("Backend API not reachable, loading fallback demo catalog:", err.message);
      setProducts(FALLBACK_PRODUCTS);
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    apiClient("/products")
      .then((res) => {
        if (ignore) return;
        if (res && res.data && Array.isArray(res.data)) {
          setProducts(res.data);
          setUsingMock(false);
        } else if (Array.isArray(res)) {
          setProducts(res);
          setUsingMock(false);
        } else {
          setProducts(FALLBACK_PRODUCTS);
          setUsingMock(true);
        }
      })
      .catch((err) => {
        if (ignore) return;
        console.warn("Backend API not reachable, loading fallback demo catalog:", err.message);
        setProducts(FALLBACK_PRODUCTS);
        setUsingMock(true);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const categories = [
    "ALL",
    ...new Set(
      products
        .map((p) => p.category)
        .filter(Boolean)
    ),
  ];

  const filteredProducts = products.filter((p) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      p.name?.toLowerCase().includes(term) ||
      p.barcode?.toLowerCase().includes(term) ||
      p.sku?.toLowerCase().includes(term);

    const matchesCategory =
      selectedCategory === "ALL" ||
      p.category?.toLowerCase() === selectedCategory.toLowerCase();

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Products Catalog
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage inventory barcodes, prices, SKU references, and product metadata.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchProducts}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium transition shadow-2xs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <Link
            to="/admin/products/add"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/20 transition transform active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Product</span>
          </Link>
        </div>
      </div>

      {usingMock && (
        <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs flex items-center justify-between">
          <span>
            Notice: Backend API is currently offline or returning mock items. Displaying local demo inventory.
          </span>
          <span className="font-semibold text-amber-700 text-[11px]">Demo Mode</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, barcode, SKU..."
            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
          />
        </div>

        {/* Category Pill Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <Filter className="w-3.5 h-3.5 text-slate-400 mr-1 shrink-0" />
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                selectedCategory === cat
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product List Table / Card View */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-700">No products found</p>
            <p className="text-xs text-slate-400 mt-1">
              Try adjusting your search or category filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-6">Product & SKU</th>
                  <th className="py-3.5 px-4">Barcode</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Price</th>
                  <th className="py-3.5 px-4">Weight</th>
                  <th className="py-3.5 px-6 text-right">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredProducts.map((product) => (
                  <tr
                    key={product._id || product.barcode}
                    className="hover:bg-slate-50/80 transition"
                  >
                    <td className="py-3.5 px-6 font-semibold text-slate-900">
                      <div className="font-bold text-slate-900">{product.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        SKU: {product.sku || "N/A"}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-700 font-medium">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                        <Barcode className="w-3 h-3 text-slate-500" />
                        <span>{product.barcode}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                        {product.category || "General"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-black text-slate-900 text-sm">
                      ₹{Number(product.price).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-medium">
                      {product.weight} {product.weightUnit || "g"}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Verified</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing {filteredProducts.length} of {products.length} products
          </span>
          <Link
            to="/admin/products/add"
            className="font-semibold text-emerald-700 hover:text-emerald-800"
          >
            + Register Another Product
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminProducts;
