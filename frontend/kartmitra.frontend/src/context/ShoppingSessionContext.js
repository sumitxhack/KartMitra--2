import { createContext, useContext } from "react";

export const ShoppingSessionContext = createContext(null);

export const useShoppingSession = () => {
  const session = useContext(ShoppingSessionContext);
  if (!session) throw new Error("useShoppingSession must be used within ShoppingSessionProvider");
  return session;
};
