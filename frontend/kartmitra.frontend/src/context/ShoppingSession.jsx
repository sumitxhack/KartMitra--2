import { useEffect, useMemo, useState } from "react";
import { ShoppingSessionContext } from "./ShoppingSessionContext";
import { authApi } from "../api/authApi";
import { sessionApi } from "../api/sessionApi";
import { cartApi } from "../api/cartApi";

const storageKey = "kartmitra-shopping-session";
const tokenKey = "kartmitra-token";

const restoreSession = () => {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || {};
  } catch {
    return {};
  }
};

export const ShoppingSessionProvider = ({ children }) => {
  const saved = restoreSession();
  const [user, setUser] = useState(saved.user ?? null);
  const [sessionId, setSessionId] = useState(saved.sessionId ?? null);
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Helper to fetch cart items from backend
  const fetchCart = async (sid = sessionId) => {
    if (!sid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await cartApi.get(sid);
      if (res.success) {
        setCartItems(res.data);
      }
    } catch (err) {
      console.error("Failed to load cart items:", err);
      setError(err.message || "Failed to load cart");
    } finally {
      setLoading(false);
    }
  };

  // Fetch cart items when sessionId changes or on mount
  useEffect(() => {
    if (sessionId) {
      fetchCart(sessionId);
    } else {
      setCartItems([]);
    }
  }, [sessionId]);

  // Sync session states to local storage
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({ user, sessionId }));
  }, [user, sessionId]);

  const value = useMemo(() => {
    const itemCount = cartItems.reduce((count, item) => count + item.quantity, 0);
    const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    return {
      user,
      sessionId,
      cartItems,
      itemCount,
      total,
      loading,
      error,
      
      signIn: async (email, password) => {
        setLoading(true);
        setError(null);
        try {
          const res = await authApi.login(email, password);
          if (res.success) {
            const { token, user: loggedUser } = res.data;
            localStorage.setItem(tokenKey, token);
            setUser(loggedUser);
            return loggedUser;
          }
        } catch (err) {
          setError(err.message || "Login failed");
          throw err;
        } finally {
          setLoading(false);
        }
      },

      startSession: async (storeId) => {
        setLoading(true);
        setError(null);
        try {
          const res = await sessionApi.startSession(storeId);
          if (res.success) {
            const { sessionId: sid } = res.data;
            setSessionId(sid);
            return res.data;
          }
        } catch (err) {
          setError(err.message || "Failed to start shopping session");
          throw err;
        } finally {
          setLoading(false);
        }
      },

      signOut: () => {
        localStorage.removeItem(tokenKey);
        localStorage.removeItem(storageKey);
        setUser(null);
        setSessionId(null);
        setCartItems([]);
      },

      addToCart: async (product, quantity = 1) => {
        if (!sessionId) return;
        setLoading(true);
        setError(null);
        try {
          const res = await cartApi.add(sessionId, product.id, quantity);
          if (res.success) {
            await fetchCart(sessionId);
          }
        } catch (err) {
          setError(err.message || "Failed to add to cart");
          throw err;
        } finally {
          setLoading(false);
        }
      },

      removeFromCart: async (cartItemId) => {
        setLoading(true);
        setError(null);
        try {
          const res = await cartApi.delete(cartItemId);
          if (res.success) {
            await fetchCart(sessionId);
          }
        } catch (err) {
          setError(err.message || "Failed to remove from cart");
          throw err;
        } finally {
          setLoading(false);
        }
      },

      updateCartItemQuantity: async (cartItemId, quantity) => {
        setLoading(true);
        setError(null);
        try {
          const res = await cartApi.update(cartItemId, quantity);
          if (res.success) {
            await fetchCart(sessionId);
          }
        } catch (err) {
          setError(err.message || "Failed to update item quantity");
          throw err;
        } finally {
          setLoading(false);
        }
      },

      clearCart: () => {
        setCartItems([]);
      },
      
      fetchCart
    };
  }, [cartItems, sessionId, user, loading, error]);

  return <ShoppingSessionContext.Provider value={value}>{children}</ShoppingSessionContext.Provider>;
};
