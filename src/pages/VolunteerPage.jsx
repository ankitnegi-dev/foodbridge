import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import supabase from '../lib/supabase'
import toast from 'react-hot-toast'

function getSafetyScore(expiryAt) {
  const diff = (new Date(expiryAt) - new Date()) / 3600000
  if (diff <= 0)  return { score: 0, label: 'Expired',   cls: 'text-gray-400' }
  if (diff < 2)   return { score: 1, label: 'Critical',  cls: 'text-red-500' }
  if (diff < 6)   return { score: 2, label: 'Poor',      cls: 'text-orange-500' }
  if (diff < 12)  return { score: 3, label: 'Moderate',  cls: 'text-amber-500' }
  if (diff < 24)  return { score: 4, label: 'Good',      cls: 'text-blue-500' }
  return           { score: 5, label: 'Excellent', cls: 'text-green-600' }
}

export default function VolunteerPage() {
  const { user } = useAuth()
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(null)

  useEffect(() => {
    supabase.from('food_listings')
      .select('*, profiles(name, phone, address)')
      .eq('status', 'available')
      .order('expiry_at', { ascending: true })
      .then(({ data }) => { setListings(data || []); setLoading(false) })
  }, [])

  async function acceptDelivery(listing) {
    setAccepting(listing.id)
    const { error } = await supabase.from('food_listings')
      .update({ status: 'claimed' })
      .eq('id', listing.id)
    setAccepting(null)
    if (error) {
      toast.error('Failed to accept delivery')
    } else {
      setListings(prev => prev.filter(l => l.id !== listing.id))
      toast.success('Delivery accepted! Contact the donor to arrange pickup.')
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Volunteer Dashboard 🚗</h1>
        <p className="text-gray-500 text-sm mt-1">Coordinate pickups and deliveries to help food reach those in need</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-orange-700">{listings.length}</div>
          <div className="text-xs text-orange-600 mt-1">Available Pickups</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-red-700">{listings.filter(l => (new Date(l.expiry_at) - new Date()) / 3600000 < 2).length}</div>
          <div className="text-xs text-red-600 mt-1">Urgent Pickups</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-green-700">{listings.filter(l => (new Date(l.expiry_at) - new Date()) / 3600000 >= 6).length}</div>
          <div className="text-xs text-green-600 mt-1">Fresh Pickups</div>
        </div>
      </div>

      <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">Available Pickups</h2>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading pickups…</div>
      ) : listings.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">✅</p>
          <p className="text-gray-500">No pickups available right now</p>
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map(l => {
            const safety = getSafetyScore(l.expiry_at)
            const diff = (new Date(l.expiry_at) - new Date()) / 3600000
            const urgent = diff < 2
            return (
              <div key={l.id} className={`bg-white border rounded-2xl p-4 flex gap-4 items-start ${urgent ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                {l.photo_url && (
                  <img src={l.photo_url} alt={l.food_name} className="w-16 h-16 object-cover rounded-xl flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-gray-900">{l.food_name}</h3>
                    {urgent && <span className="text-xs font-bold text-white bg-red-500 px-2 py-0.5 rounded-full">🚨 URGENT</span>}
                  </div>
                  <p className="text-sm text-gray-600">{l.quantity} {l.unit} · {l.pickup_address}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`text-xs font-semibold ${safety.cls}`}>Safety: {safety.label} ({safety.score}/5)</span>
                    <span className="text-xs text-gray-400">
                      ⏱ {diff > 0 ? `${Math.floor(diff)}h ${Math.floor((diff % 1) * 60)}m left` : 'Expired'}
                    </span>
                  </div>
                  {l.profiles?.phone && (
                    <p className="text-xs text-gray-500 mt-1">📞 Donor: {l.profiles.name} · {l.profiles.phone}</p>
                  )}
                  {/* Smart Routing */}
                  {l.lat && l.lng && (
                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${l.lat},${l.lng}`}
                      target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1">
                      🗺️ Get Directions
                    </a>
                  )}
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    onClick={() => acceptDelivery(l)}
                    disabled={accepting === l.id}
                    className="px-4 py-2 bg-orange-600 text-white text-xs font-semibold rounded-xl hover:bg-orange-700 transition disabled:opacity-50"
                  >
                    {accepting === l.id ? '…' : 'Accept Pickup'}
                  </button>
                  {l.profiles?.phone && (
                    <a
                      href={`https://wa.me/91${l.profiles.phone.replace(/\D/g,'')}?text=${encodeURIComponent(
                        `Hi ${l.profiles.name || 'there'}! I'm a FoodBridge volunteer 🚗\n\nI'd like to pick up your food listing:\n*Food:* ${l.food_name}\n*Quantity:* ${l.quantity} ${l.unit}\n*Address:* ${l.pickup_address}\n\nWhen can I come for pickup?`
                      )}`}
                      target="_blank" rel="noreferrer"
                      className="px-4 py-2 bg-[#25D366] text-white text-xs font-semibold rounded-xl hover:bg-[#1ebe57] transition text-center">
                      💬 WhatsApp
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
