import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import supabase from '../lib/supabase'

export default function Navbar() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unread, setUnread] = useState(0)
  const channelRef = useRef(null)
  const bellRef = useRef(null)

  const handleSignOut = async () => { await signOut(); navigate('/login') }

  // Load + subscribe to notifications
  useEffect(() => {
    if (!user) return

    // Fetch existing notifications
    supabase.from('notifications').select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setNotifications(data || [])
        setUnread((data || []).filter(n => !n.is_read).length)
      })

    // Realtime: new notifications for this user
    channelRef.current = supabase
      .channel('notifications-' + user.id)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, payload => {
        setNotifications(prev => [payload.new, ...prev])
        setUnread(u => u + 1)
      })
      .subscribe()

    return () => { channelRef.current && supabase.removeChannel(channelRef.current) }
  }, [user])

  // Close bell on outside click
  useEffect(() => {
    function handleClick(e) {
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function markAllRead() {
    if (!user || unread === 0) return
    await supabase.from('notifications').update({ is_read: true })
      .eq('user_id', user.id).eq('is_read', false)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnread(0)
  }

  const navLink = (to, label) => (
    <Link key={to} to={to} onClick={() => setMenuOpen(false)}
      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        location.pathname === to ? 'bg-green-100 text-green-800' : 'text-gray-700 hover:bg-gray-100'
      }`}>
      {label}
    </Link>
  )

  const donorLinks    = [navLink('/', 'Home'), navLink('/post', 'Post Food'), navLink('/my-listings', 'My Listings'), navLink('/dashboard', 'Dashboard')]
  const receiverLinks = [navLink('/', 'Home'), navLink('/map', 'Find Food'), navLink('/claims', 'My Claims'), navLink('/dashboard', 'Dashboard')]
  const volunteerLinks= [navLink('/', 'Home'), navLink('/map', 'Live Map'), navLink('/volunteer', '🚗 Pickups'), navLink('/dashboard', 'Dashboard')]
  const publicLinks   = [navLink('/', 'Home')]

  const links = !user ? publicLinks
    : profile?.role === 'donor' ? donorLinks
    : profile?.role === 'volunteer' ? volunteerLinks
    : receiverLinks

  const roleColor = { donor: 'bg-green-100 text-green-700', receiver: 'bg-blue-100 text-blue-700', volunteer: 'bg-orange-100 text-orange-700' }

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl text-green-700">
          🍱 <span>FoodBridge</span>
        </Link>

        <div className="hidden md:flex items-center gap-1">{links}</div>

        <div className="hidden md:flex items-center gap-2">
          {user ? (
            <>
              {/* Notification Bell */}
              <div className="relative" ref={bellRef}>
                <button onClick={() => { setBellOpen(!bellOpen); if (!bellOpen) markAllRead() }}
                  className="relative p-2 rounded-full hover:bg-gray-100 text-gray-600 transition">
                  🔔
                  {unread > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </button>

                {bellOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-200 py-2 z-50 max-h-96 overflow-y-auto">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
                      <p className="text-xs font-bold text-gray-700 uppercase">Notifications</p>
                      {notifications.length > 0 && (
                        <button onClick={markAllRead} className="text-xs text-green-600 hover:underline">Mark all read</button>
                      )}
                    </div>
                    {notifications.length === 0 ? (
                      <p className="px-4 py-6 text-sm text-gray-400 text-center">No notifications yet</p>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id}
                          className={`px-4 py-3 text-sm border-b border-gray-50 last:border-0 ${!n.is_read ? 'bg-green-50' : ''}`}>
                          <p className="text-gray-800">{n.message}</p>
                          <p className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {profile?.role && (
                <span className={`text-xs font-semibold px-2 py-1 rounded-full capitalize ${roleColor[profile.role] || 'bg-gray-100 text-gray-600'}`}>
                  {profile.role}
                </span>
              )}
              <Link to="/profile" className="text-sm text-gray-600 hover:text-green-700 font-medium transition">
                {profile?.name || user.email}
              </Link>
              <button onClick={handleSignOut}
                className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition">Login</Link>
              <Link to="/register" className="px-4 py-2 text-sm font-medium text-white bg-green-700 rounded-lg hover:bg-green-800 transition">Register</Link>
            </>
          )}
        </div>

        <button className="md:hidden p-2 rounded-lg hover:bg-gray-100" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200 px-4 py-3 flex flex-col gap-2">
          {links}
          {user && <Link to="/profile" onClick={() => setMenuOpen(false)} className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">👤 Profile</Link>}
          {user ? (
            <button onClick={handleSignOut} className="text-left px-3 py-2 text-sm text-red-600 rounded-lg hover:bg-red-50">Logout</button>
          ) : (
            <>
              <Link to="/login" onClick={() => setMenuOpen(false)} className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Login</Link>
              <Link to="/register" onClick={() => setMenuOpen(false)} className="px-3 py-2 text-sm text-white bg-green-700 rounded-lg text-center">Register</Link>
            </>
          )}
        </div>
      )}
    </nav>
  )
}
