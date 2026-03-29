import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import MapPage from './pages/MapPage'
import PostFood from './pages/PostFood'
import MyListings from './pages/MyListings'
import Claims from './pages/Claims'
import VolunteerPage from './pages/VolunteerPage'
import Profile from './pages/Profile'
import Transparency from './pages/Transparency'

function ProtectedRoute({ children, requireRole }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-4xl animate-bounce">🍱</div>
    </div>
  )
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (!profile) return <Navigate to="/onboarding" replace />
  if (requireRole && profile.role !== requireRole) return <Navigate to="/dashboard" replace />
  return children
}

function AppRoutes() {
  const { user, profile, loading } = useAuth()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-4xl animate-bounce">🍱</div>
    </div>
  )

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={user && profile ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/register" element={user && profile ? <Navigate to="/dashboard" /> : <Register />} />
        <Route path="/onboarding" element={
          user ? (profile ? <Navigate to="/dashboard" /> : <Onboarding />) : <Navigate to="/login" />
        } />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/map" element={<ProtectedRoute><MapPage /></ProtectedRoute>} />
        <Route path="/post" element={<ProtectedRoute requireRole="donor"><PostFood /></ProtectedRoute>} />
        <Route path="/my-listings" element={<ProtectedRoute requireRole="donor"><MyListings /></ProtectedRoute>} />
        <Route path="/claims" element={<ProtectedRoute><Claims /></ProtectedRoute>} />
        <Route path="/volunteer" element={<ProtectedRoute requireRole="volunteer"><VolunteerPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/transparency" element={<Transparency />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <MobileNav />
    </>
  )
}

function MobileNav() {
  const { user, profile } = useAuth()
  const location = useLocation()
  if (!user || !profile) return null
  const isActive = path => location.pathname === path ? 'text-green-700' : 'text-gray-500'

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-50">
      <a href="/" className={`flex-1 flex flex-col items-center py-2 text-xs ${isActive('/')}`}>
        <span className="text-xl">🏠</span>Home
      </a>
      <a href="/map" className={`flex-1 flex flex-col items-center py-2 text-xs ${isActive('/map')}`}>
        <span className="text-xl">🗺️</span>Map
      </a>
      {profile.role === 'donor' && (
        <a href="/post" className={`flex-1 flex flex-col items-center py-2 text-xs ${isActive('/post')}`}>
          <span className="text-xl">➕</span>Post
        </a>
      )}
      {profile.role === 'volunteer' && (
        <a href="/volunteer" className={`flex-1 flex flex-col items-center py-2 text-xs ${isActive('/volunteer')}`}>
          <span className="text-xl">🚗</span>Pickups
        </a>
      )}
      <a href="/dashboard" className={`flex-1 flex flex-col items-center py-2 text-xs ${isActive('/dashboard')}`}>
        <span className="text-xl">📊</span>Dashboard
      </a>
      <a href="/profile" className={`flex-1 flex flex-col items-center py-2 text-xs ${isActive('/profile')}`}>
        <span className="text-xl">👤</span>Profile
      </a>
    </nav>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
