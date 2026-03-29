import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import supabase from '../lib/supabase'
import toast from 'react-hot-toast'

function getBadges(posted, claimed, kgDonated) {
  const badges = []
  if (posted >= 1)   badges.push({ icon: '🌱', label: 'First Post' })
  if (posted >= 5)   badges.push({ icon: '🥉', label: 'Bronze Donor' })
  if (posted >= 20)  badges.push({ icon: '🥈', label: 'Silver Donor' })
  if (posted >= 50)  badges.push({ icon: '🥇', label: 'Gold Donor' })
  if (claimed >= 1)  badges.push({ icon: '✅', label: 'First Claim' })
  if (claimed >= 10) badges.push({ icon: '🤝', label: 'Community Hero' })
  if (kgDonated >= 10) badges.push({ icon: '⚖️', label: '10kg Milestone' })
  if (kgDonated >= 50) badges.push({ icon: '🌍', label: 'Food Champion' })
  return badges
}

export default function Profile() {
  const { user, profile, refetchProfile } = useAuth()
  const [form, setForm] = useState({ name: '', phone: '', org_name: '', address: '' })
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({ posted: 0, claimed: 0, kgDonated: 0, claimsMade: 0 })
  const [avgRating, setAvgRating] = useState(null)

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name || '',
        phone: profile.phone || '',
        org_name: profile.org_name || '',
        address: profile.address || '',
      })
    }
    if (!user) return
    // Load donor stats
    supabase.from('food_listings').select('status,quantity').eq('donor_id', user.id)
      .then(({ data }) => {
        const listings = data || []
        const claimed = listings.filter(l => l.status === 'claimed')
        setStats(s => ({
          ...s,
          posted: listings.length,
          claimed: claimed.length,
          kgDonated: Math.round(claimed.reduce((a, l) => a + (parseFloat(l.quantity) || 0), 0))
        }))
      })
    // Load receiver claim count
    supabase.from('claims').select('id').eq('receiver_id', user.id)
      .then(({ data }) => setStats(s => ({ ...s, claimsMade: (data || []).length })))
    // Load avg rating received
    supabase.from('ratings').select('rating').eq('ratee_id', user.id)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const avg = data.reduce((a, r) => a + r.rating, 0) / data.length
          setAvgRating(avg.toFixed(1))
        }
      })
  }, [user, profile])

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Name is required'); return }
    setLoading(true)
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      role: profile.role,
      ...form,
    })
    setLoading(false)
    if (error) toast.error('Failed to save profile')
    else { await refetchProfile(); toast.success('Profile updated! ✅') }
  }

  const badges = getBadges(stats.posted, stats.claimed, stats.kgDonated)
  const roleColor = { donor: 'bg-green-100 text-green-700', receiver: 'bg-blue-100 text-blue-700', volunteer: 'bg-orange-100 text-orange-700' }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Profile</h1>

      {/* Avatar + Role */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-5 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-3xl">
          {profile?.role === 'donor' ? '🥘' : profile?.role === 'volunteer' ? '🚗' : '🙏'}
        </div>
        <div>
          <p className="font-bold text-gray-900 text-lg">{form.name || user?.email}</p>
          <span className={`text-xs font-semibold px-2 py-1 rounded-full capitalize ${roleColor[profile?.role] || 'bg-gray-100 text-gray-600'}`}>
            {profile?.role}
          </span>
          {avgRating && (
            <span className="ml-2 text-xs font-semibold text-yellow-600 bg-yellow-100 px-2 py-1 rounded-full">
              ⭐ {avgRating} avg rating
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {profile?.role === 'donor' && <>
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-green-700">{stats.posted}</p>
            <p className="text-xs text-green-600">Posts</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-blue-700">{stats.claimed}</p>
            <p className="text-xs text-blue-600">Claimed</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-amber-700">{stats.kgDonated}kg</p>
            <p className="text-xs text-amber-600">Donated</p>
          </div>
        </>}
        {profile?.role === 'receiver' && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-blue-700">{stats.claimsMade}</p>
            <p className="text-xs text-blue-600">Claims Made</p>
          </div>
        )}
        {avgRating && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-yellow-700">⭐ {avgRating}</p>
            <p className="text-xs text-yellow-600">Avg Rating</p>
          </div>
        )}
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">🏅 Badges Earned</h2>
          <div className="flex flex-wrap gap-2">
            {badges.map(b => (
              <span key={b.label} className="flex items-center gap-1 bg-white border border-gray-200 rounded-full px-3 py-1 text-sm">
                {b.icon} {b.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Edit Form */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="font-bold text-gray-900 mb-4">Edit Details</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input type="text" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Your name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number <span className="text-green-600 text-xs">(needed for WhatsApp contact)</span>
            </label>
            <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="e.g. 9876543210" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Organisation / NGO Name</label>
            <input type="text" value={form.org_name} onChange={e => setForm(f => ({ ...f, org_name: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Optional — leave blank if individual" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Your area / city" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-green-700 text-white py-3 rounded-xl font-semibold hover:bg-green-800 transition disabled:opacity-50">
            {loading ? 'Saving…' : '💾 Save Profile'}
          </button>
        </form>
      </div>
    </div>
  )
}
