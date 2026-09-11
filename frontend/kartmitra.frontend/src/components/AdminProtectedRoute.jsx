import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isAdminAuthenticated } from "../utils/adminAuth";

/**
 * Route guard component for Admin routes.
 * Redirects unauthenticated users to /admin/login.
 */
const AdminProtectedRoute = () => {
  const isAuth = isAdminAuthenticated();
  const location = useLocation();

  if (!isAuth) {
    return (
      <Navigate
        to="/admin/login"
        replace
        state={{ from: location }}
      />
    );
  }

  return <Outlet />;
};

export default AdminProtectedRoute;
