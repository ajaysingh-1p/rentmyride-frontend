import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

// IMPORTANT: we use sessionStorage here, not localStorage. localStorage is shared across
// every tab of the same browser, so logging in as a different role in a second tab would
// silently overwrite the first tab's session and log it out. sessionStorage is scoped to a
// single tab, so an admin, a customer, and a driver can each be logged in at the same time
// in separate tabs without stepping on each other.
export function AuthProvider({ children }) {
  const stored = sessionStorage.getItem('ddt_user')
  const [user,  setUser]  = useState(stored ? JSON.parse(stored) : null)
  const [token, setToken] = useState(sessionStorage.getItem('ddt_token') || null)

  // authData matches backend AuthResponseDTO:
  // { token, role, userId, name, email, message, success }
  function login(authData) {
    const userData = {
      userId: authData.userId,
      name:   authData.name,
      email:  authData.email,
      role:   authData.role,
    }
    sessionStorage.setItem('ddt_token', authData.token)
    sessionStorage.setItem('ddt_user',  JSON.stringify(userData))
    setToken(authData.token)
    setUser(userData)
  }

  function logout() {
    sessionStorage.removeItem('ddt_token')
    sessionStorage.removeItem('ddt_user')
    setToken(null)
    setUser(null)
  }

  // Patch a few fields on the stored user (e.g. after a profile edit) without a full re-login
  function updateUser(patch) {
    setUser(prev => {
      const next = { ...prev, ...patch }
      sessionStorage.setItem('ddt_user', JSON.stringify(next))
      return next
    })
  }

  const isAuthenticated = () => !!token && !!user
  const isAdmin         = () => user?.role === 'ADMIN'
  const isCustomer      = () => user?.role === 'CUSTOMER'
  const isDriver        = () => user?.role === 'DRIVER'

  return (
    <AuthContext.Provider value={{
      user, token,
      login, logout, updateUser,
      isAuthenticated,
      isAdmin, isCustomer, isDriver,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
