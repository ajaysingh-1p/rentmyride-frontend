import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function ProtectedRoute() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  return isAuthenticated() ? <Outlet /> : <Navigate to="/login" state={{ from: location }} replace />
}

export function AdminRoute() {
  const { isAuthenticated, isAdmin } = useAuth()
  const location = useLocation()
  if (!isAuthenticated()) return <Navigate to="/login" state={{ from: location }} replace />
  if (!isAdmin())         return <Navigate to="/unauthorized" replace />
  return <Outlet />
}

export function CustomerRoute() {
  const { isAuthenticated, isCustomer } = useAuth()
  const location = useLocation()
  // Bug fix / new feature support: this used to redirect to /login with no memory of where the
  // customer was actually headed — after signing in they always landed on the generic
  // dashboard, even if they'd clicked "Book Now" on a specific car from the new public Home
  // page (or any other deep link). Passing the current location in redirect state lets
  // UnifiedLogin send them straight back to it once they're authenticated.
  if (!isAuthenticated()) return <Navigate to="/login" state={{ from: location }} replace />
  if (!isCustomer())      return <Navigate to="/unauthorized" replace />
  return <Outlet />
}

export function DriverRoute() {
  const { isAuthenticated, isDriver } = useAuth()
  const location = useLocation()
  if (!isAuthenticated()) return <Navigate to="/login" state={{ from: location }} replace />
  if (!isDriver())         return <Navigate to="/unauthorized" replace />
  return <Outlet />
}
