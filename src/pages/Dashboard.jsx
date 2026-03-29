import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import supabase from '../lib/supabase'

// ---------- Helpers ----------
function useCountUp(target, duration = 800) {
  const [value, setValue] = useState(0)
  const started = useRef(false)
  useEffect(() => {
    if (target === 0 || started.current) return
    started.current = true
    const start = Date.now()
    const tick = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      setValue(Math.floor(progress * target))
      if (progress < 1) requestAnimationFrame(tick)
      else setValue(target)
    }
    requestAnimationFrame(tick)
  }, [target, duration])
  return value
}

function getBadges(posted, claimed, kgDonated) {
  const badges = []
  if (posted >= 1)   badges.push({ icon: '🌱', label: 'First Post', desc: 'Posted your first listing' })
  if (posted >= 5)   badges.push({ icon: '🥉', label: 'Bronze Donor', desc: '5+ listings posted' })
  if (posted >= 20)  badges.push({ icon: '🥈', label: 'Silver Donor', desc: '20+ listings posted' })
  if (posted >= 50)  badges.push({ icon: '🥇', label: 'Gold Donor', desc: '50+ listings posted' })
  if (claimed >= 1)  badges.push({ icon: '✅', label: 'First Claim', desc: 'First food item claimed' })
  if (claimed >= 10) badges.push({ icon: '🤝', label: 'Community Hero', desc: '10+ items claimed' })
  if (kgDonated >= 10) badges.push({ icon: '⚖️', label: '10kg Milestone', desc: '10kg of food donated' })
  if (kgDonated >= 50) badges.push({ icon: '🌍', label: 'Food Champion', desc: '50kg of food donated' })
  return badges
}

function getPoints(posted, claimed, kgDonated) {
  return posted * 10 + claimed * 25 + Math.floor(kgDonated) * 5
}

function getLevel(points) {
  if (points >= 500) return { level: 5, label: 'Legend', color: 'text-purple-600', bg: 'bg-purple-100' }
  if (points >= 200) return { level: 4, label: 'Champion', color: 'text-yellow-600', bg: 'bg-yellow-100' }
  if (points >= 100) return { level: 3, label: 'Hero', color: 'text-blue-600', bg: 'bg-blue-100' }
  if (points >= 50)  return { level: 2, label: 'Helper', color: 'text-green-600', bg: 'bg-green-100' }
  return { level: 1, label: 'Newcomer', color: 'text-gray-600', bg: 'bg-gray-100' }
}

function StatCard({ icon, label, value }) {
  const animated = useCountUp(value)
  return (
    <div className="bg-green-700 text-white rounded-2xl p-5">
      <div className="text-3xl mb-1">{icon}</div>
      <div className="text-3xl font-bold">{animated.toLocaleString()}</div>
      <div className="text-green-100 text-sm mt-1">{label}</div>
    </div>
  )
}

const statusColor = {
  pending: 'bg-gray-100 text-gray-600',
  confirmed: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700'
}

// ---------- Component ----------
export default function Dashboard() {
  const { user, profile } = useAuth()
  const [stats, setStats] = useState({ totalSaved: 0, activeDonors: 0 })
  const [donorData, setDonorData] = useState({ listings: [], posted: 0, claimed: 0, kgDonated: 0 })
  const [receiverData, setReceiverData] = useState({ claims: [] })
  const [leaderboard, setLeaderboard] = useState([])

  useEffect(() => {
    // Global stats
    supabase.from('food_listings').select('quantity,donor_id,status').eq('status', 'claimed')
      .then(({ data: claimed }) => {
        const totalSaved = (claimed || []).reduce((s, l) => s + (parseFloat(l.quantity) || 0), 0)
        const uniqueDonors = new Set((claimed || []).map(l => l.donor_id)).size
        setStats({ totalSaved: Math.round(totalSaved), activeDonors: uniqueDonors })
      })

    // Leaderboard: top donors by claimed kg
    supabase.from('food_listings')
      .select('donor_id, quantity, profiles(name)')
      .eq('status', 'claimed')
      .then(({ data }) => {
        const map = {}
        ;(data || []).forEach(l => {
          const id = l.donor_id
          if (!map[id]) map[id] = { name: l.profiles?.name || 'Anonymous', kg: 0, count: 0 }
          map[id].kg += parseFloat(l.quantity) || 0
          map[id].count++
        })
        const sorted = Object.values(map).sort((a, b) => b.kg - a.kg).slice(0, 5)
        setLeaderboard(sorted)
      })

    if (!user) return

    if (profile?.role === 'donor') {
      supabase.from('food_listings').select('*').eq('donor_id', user.id).order('created_at', { ascending: false })
        .then(({ data }) => {
          const listings = data || []
          const claimed = listings.filter(l => l.status === 'claimed')
          const kgDonated = claimed.reduce((s, l) => s + (parseFloat(l.quantity) || 0), 0)
          setDonorData({ listings: listings.slice(0, 10), posted: listings.length, claimed: claimed.length, kgDonated: Math.round(kgDonated) })
        })
    }

    if (profile?.role === 'receiver') {
      supabase.from('claims')
        .select('*, food_listings(food_name, quantity, unit)')
        .eq('receiver_id', user.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => setReceiverData({ claims: data || [] }))
    }
  }, [user, profile])

  const meals = Math.round(stats.totalSaved * 2.5)
  const co2 = Math.round(stats.totalSaved * 2.5)

  const points = getPoints(donorData.posted, donorData.claimed, donorData.kgDonated)
  const lvl = getLevel(points)
  const badges = getBadges(donorData.posted, donorData.claimed, donorData.kgDonated)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Global Impact */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">🌍 Global Impact</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon="🥘" label="Food Saved (kg)" value={stats.totalSaved} />
          <StatCard icon="🍽️" label="Meals Served" value={meals} />
          <StatCard icon="🌿" label="CO₂ Avoided (kg)" value={co2} />
          <StatCard icon="👨‍🍳" label="Active Donors" value={stats.activeDonors} />
        </div>
      </div>

      {/* Donor Dashboard */}
      {profile?.role === 'donor' && (
        <div>
          {/* Points & Level */}
          <div className="bg-gradient-to-r from-green-700 to-green-500 rounded-2xl p-5 mb-5 text-white flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Your Level</p>
              <p className="text-3xl font-bold">{lvl.label}</p>
              <p className="text-green-100 text-sm mt-1">{points} points earned</p>
            </div>
            <div className="text-right">
              <div className={`inline-block px-4 py-2 rounded-xl text-sm font-bold ${lvl.bg} ${lvl.color}`}>
                Level {lvl.level}
              </div>
              <p className="text-green-100 text-xs mt-2">+10pts per post · +25pts per claim</p>
            </div>
          </div>

          {/* Badges */}
          {badges.length > 0 && (
            <div className="mb-5">
              <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">🏅 Your Badges</h2>
              <div className="flex flex-wrap gap-3">
                {badges.map(b => (
                  <div key={b.label} className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 hover:shadow-sm transition">
                    <span className="text-2xl">{b.icon}</span>
                    <div>
                      <p className="text-xs font-bold text-gray-900">{b.label}</p>
                      <p className="text-xs text-gray-400">{b.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase">Your Activity</h2>
            <Link to="/post" className="px-4 py-2 bg-green-700 text-white text-sm font-semibold rounded-xl hover:bg-green-800 transition">
              + Post Food
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: 'Total Posted', value: donorData.posted, icon: '📋' },
              { label: 'Total Claimed', value: donorData.claimed, icon: '✅' },
              { label: 'kg Donated', value: donorData.kgDonated, icon: '⚖️' },
            ].map(s => (
              <div key={s.label} className="bg-white border border-gray-200 rounded-2xl p-4 text-center">
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className="text-2xl font-bold text-gray-900">{s.value}</div>
                <div className="text-xs text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">Recent Listings</h2>
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-6">
            {donorData.listings.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                No listings yet. <Link to="/post" className="text-green-700 font-semibold">Post your first!</Link>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Food</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Qty</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {donorData.listings.map(l => (
                    <tr key={l.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900 flex items-center gap-1">
                        {l.is_emergency && <span title="Emergency">🚨</span>} {l.food_name}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{l.quantity} {l.unit}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          l.status === 'available' ? 'bg-green-100 text-green-700' :
                          l.status === 'claimed' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>{l.status}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{new Date(l.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Receiver Dashboard */}
      {profile?.role === 'receiver' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase">Your Claims</h2>
            <Link to="/map" className="px-4 py-2 bg-green-700 text-white text-sm font-semibold rounded-xl hover:bg-green-800 transition">
              🗺️ Find Food on Map
            </Link>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-6">
            {receiverData.claims.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                No claims yet. <Link to="/map" className="text-green-700 font-semibold">Find food near you!</Link>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Food</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {receiverData.claims.map(c => (
                    <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{c.food_listings?.food_name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColor[c.status] || 'bg-gray-100 text-gray-500'}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{new Date(c.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">🏆 Top Donors Leaderboard</h2>
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          {leaderboard.length === 0 ? (
            <div className="p-6 text-center text-gray-400">No donations yet — be the first!</div>
          ) : (
            leaderboard.map((d, i) => (
              <div key={i} className={`flex items-center gap-3 px-4 py-3 ${i < leaderboard.length - 1 ? 'border-b border-gray-100' : ''}`}>
                <span className="text-xl w-8 text-center">{['🥇','🥈','🥉','4️⃣','5️⃣'][i]}</span>
                <span className="flex-1 font-medium text-gray-900">{d.name}</span>
                <span className="text-sm text-green-700 font-bold">{Math.round(d.kg)} kg</span>
                <span className="text-xs text-gray-400">{d.count} donations</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
