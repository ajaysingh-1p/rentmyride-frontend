import axios from 'axios'

// Production me Vercel env variable se aayega, local me proxy fallback
const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api'
// Trailing slash clean karne ke liye (taaki URL me double slash na bane)
const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '')

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
  withCredentials: true, // Cross-origin cookies/session headers allow karne ke liye
})

// Origin nikalna static uploaded files ko backend se serve karne ke liye
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '')

export function resolveFileUrl(path) {
  if (!path) return path
  if (/^(https?:)?\/\//i.test(path) || path.startsWith('blob:') || path.startsWith('data:')) return path

  // Upload path format ensure karna
  if (!path.startsWith('/uploads/') && !path.startsWith('uploads/')) {
    path = '/uploads/' + path.replace(/^\/+/, '')
  } else if (path.startsWith('uploads/')) {
    path = '/' + path
  }
  return API_ORIGIN + path
}

// Har request ke sath JWT token attach karna
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('ddt_token')
  if (token) config.headers.Authorization = 'Bearer ' + token
  return config
}, (error) => Promise.reject(error))

// 401 (Unauthorized) aur 403 (Forbidden) globally handle karna
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem('ddt_token')
      sessionStorage.removeItem('ddt_user')
      window.location.href = '/login'
    }
    if (error.response?.status === 403) {
      window.location.href = '/unauthorized'
    }
    return Promise.reject(error)
  }
)

export default api