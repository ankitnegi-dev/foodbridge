import { useEffect, useState, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import { useAuth } from '../context/AuthContext'
import supabase from '../lib/supabase'
import toast from 'react-hot-toast'

// Haversine distance in km
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

function getMarkerColor(expiryAt) {
  const diff = (new Date(expiryAt) - new Date()) / 3600000
  if (diff <= 0)  return '#6b7280' // gray — expired
  if (diff < 2)   return '#ef4444' // red — urgent
  if (diff < 6)   return '#f97316' // orange — expiring soon
  if (diff < 24)  return '#3b82f6' // blue — available
  return '#22c55e'                 // green — fresh
}

function getCountdown(expiryAt) {
  const diff = new Date(expiryAt) - new Date()
  if (diff <= 0) return 'Expired'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function getUrgencyBadge(expiryAt) {
  const diff = (new Date(expiryAt) - new Date()) / 3600000
  if (diff <= 0)  return { label: '⚫ Expired',       cls: 'bg-gray-200 text-gray-500' }
  if (diff < 2)   return { label: '🔴 Urgent',        cls: 'bg-red-100 text-red-700' }
  if (diff < 6)   return { label: '🟠 Expiring Soon', cls: 'bg-amber-100 text-amber-700' }
  if (diff < 24)  return { label: '🔵 Available',     cls: 'bg-blue-100 text-blue-700' }
  return                 { label: '🟢 Fresh',         cls: 'bg-green-100 text-green-700' }
}

function UserLocationMarker({ onLocation }) {
  const map = useMap()
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords
        map.setView([latitude, longitude], 13)
        onLocation([latitude, longitude])
      },
      () => {
        // Default to Chennai
        map.setView([13.0827, 80.2707], 12)
        onLocation([13.0827, 80.2707])
      }
    )
  }, [map, onLocation])
  return null
}

const FOOD_TYPES = ['Veg', 'Non-Veg', 'Dairy', 'Bakery', 'Cooked', 'Raw']

export default function MapPage() {
  const { user, profile } = useAuth()
  const [listings, setListings] = useState([])
  const [userLocation, setUserLocation] = useState(null)
  const [radius, setRadius] = useState(10)
  const [typeFilters, setTypeFilters] = useState([])
  const [urgencyFilter, setUrgencyFilter] = useState('All')
  const [claiming, setClaiming] = useState(null)
  const [claimedInfo, setClaimedInfo] = useState({})
  const [filterOpen, setFilterOpen] = useState(false)
  const channelRef = useRef(null)

  useEffect(() => {
    // Fetch available listings
    supabase.from('food_listings')
      .select('*, profiles(name, phone)')
      .eq('status', 'available')
      .then(({ data }) => setListings(data || []))

    // Realtime subscription
    channelRef.current = supabase
      .channel('food-listings-map')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'food_listings' }, payload => {
        const newListing = payload.new
        if (newListing.status === 'available') {
          // Fetch donor profile
          supabase.from('profiles').select('name,phone').eq('id', newListing.donor_id).single()
            .then(({ data }) => {
              setListings(prev => [...prev, { ...newListing, profiles: data }])
              toast('📍 New food available nearby!', { icon: '🍱' })
            })
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'food_listings' }, payload => {
        const updated = payload.new
        if (updated.status === 'claimed' || updated.status === 'expired') {
          setListings(prev => prev.filter(l => l.id !== updated.id))
        }
      })
      .subscribe()

    return () => { channelRef.current && supabase.removeChannel(channelRef.current) }
  }, [])

  const handleLocation = useCallback((loc) => setUserLocation(loc), [])

  async function claimFood(listing) {
    if (!user) { toast.error('Please log in to claim food'); return }
    setClaiming(listing.id)
    try {
      const { error: claimErr } = await supabase.from('claims').insert({
        listing_id: listing.id,
        receiver_id: user.id,
        status: 'pending'
      })
      if (claimErr) throw claimErr

      const { error: updateErr } = await supabase.from('food_listings')
        .update({ status: 'claimed' })
        .eq('id', listing.id)
      if (updateErr) throw updateErr

      // Notify the donor that their food was claimed
      const receiverName = profile?.name || user.email
      await supabase.from('notifications').insert({
        user_id: listing.donor_id,
        message: `🎉 "${listing.food_name}" was claimed by ${receiverName}! Arrange pickup with them.`,
        is_read: false,
      })

      setListings(prev => prev.filter(l => l.id !== listing.id))
      setClaimedInfo(prev => ({ ...prev, [listing.id]: listing }))
      toast.success('Food claimed! Contact the donor to arrange pickup. 🎉')
    } catch (err) {
      toast.error(err.message || 'Failed to claim food')
    } finally {
      setClaiming(null)
    }
  }

  function toggleType(type) {
    setTypeFilters(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type])
  }

  function getUrgencyLabel(expiryAt) {
    const diff = (new Date(expiryAt) - new Date()) / 3600000
    if (diff <= 0) return 'Expired'
    if (diff < 2)  return 'Urgent'
    if (diff < 6)  return 'Expiring Soon'
    return 'Fresh'
  }

  const filtered = listings.filter(l => {
    if (!l.lat || !l.lng) return false
    // Exclude expired food from map
    const diff = (new Date(l.expiry_at) - new Date()) / 3600000
    if (diff <= 0) return false
    if (userLocation) {
      const dist = haversine(userLocation[0], userLocation[1], l.lat, l.lng)
      if (dist > radius) return false
    }
    if (typeFilters.length > 0 && !typeFilters.some(t => l.food_type?.includes(t))) return false
    if (urgencyFilter !== 'All' && getUrgencyLabel(l.expiry_at) !== urgencyFilter) return false
    return true
  })

  return (
    <div className="relative" style={{ height: 'calc(100vh - 64px)' }}>
      <MapContainer
        center={[13.0827, 80.2707]}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='© OpenStreetMap contributors'
        />

        <UserLocationMarker onLocation={handleLocation} />

        {/* User location pulsing circle */}
        {userLocation && (
          <CircleMarker
            center={userLocation}
            radius={12}
            pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.3, weight: 2 }}
          />
        )}

        {filtered.map(listing => {
          const badge = getUrgencyBadge(listing.expiry_at)
          const dist = userLocation ? haversine(userLocation[0], userLocation[1], listing.lat, listing.lng) : null
          const phone = listing.profiles?.phone || listing.donor_phone || ''

          return (
            <CircleMarker
              key={listing.id}
              center={[listing.lat, listing.lng]}
              radius={10}
              pathOptions={{
                color: getMarkerColor(listing.expiry_at),
                fillColor: getMarkerColor(listing.expiry_at),
                fillOpacity: 0.8,
                weight: 2
              }}
            >
              <Popup maxWidth={260}>
                <div className="p-1 w-56">
                  {listing.photo_url && (
                    <img src={listing.photo_url} alt={listing.food_name}
                      className="w-full h-28 object-cover rounded-lg mb-2" />
                  )}
                  <p className="font-bold text-gray-900 text-sm">{listing.food_name}</p>
                  <p className="text-xs text-gray-600 mt-1">{listing.quantity} {listing.unit}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                    <span className="text-xs text-gray-400">⏱ {getCountdown(listing.expiry_at)}</span>
                  </div>
                  {dist !== null && <p className="text-xs text-blue-600 mt-1">📍 {dist.toFixed(1)} km away</p>}
                  <p className="text-xs text-gray-500 mt-1 truncate">{listing.pickup_address}</p>

                  {claiming === listing.id ? (
                    <button disabled className="mt-3 w-full py-2 bg-green-400 text-white rounded-lg text-xs font-semibold">
                      Claiming…
                    </button>
                  ) : (
                    <button onClick={() => claimFood(listing)}
                      className="mt-3 w-full py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg text-xs font-semibold transition">
                      🍽️ Claim This Food
                    </button>
                  )}

                  {phone ? (
                    <a
                      href={`https://wa.me/91${phone.replace(/\D/g,'')}?text=${encodeURIComponent(
                        `Hi! I just claimed your food listing on FoodBridge 🍱\n\n*Food:* ${listing.food_name}\n*Quantity:* ${listing.quantity} ${listing.unit}\n*Pickup:* ${listing.pickup_address}\n\nCan we arrange a pickup time?`
                      )}`}
                      target="_blank" rel="noreferrer"
                      className="mt-2 flex items-center justify-center gap-1 w-full py-2 bg-[#25D366] hover:bg-[#1ebe57] text-white rounded-lg text-xs font-semibold transition">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.136.564 4.14 1.545 5.872L0 24l6.293-1.516A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.65-.502-5.18-1.378l-.37-.22-3.737.9.933-3.632-.241-.374A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                      WhatsApp Donor
                    </a>
                  ) : (
                    <p className="mt-2 text-xs text-gray-400 text-center">📵 Donor hasn't added phone yet</p>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          )
        })}
      </MapContainer>

      {/* Filter Toggle Button */}
      <button
        onClick={() => setFilterOpen(!filterOpen)}
        className="absolute top-4 right-4 z-[1000] bg-white border border-gray-200 shadow-md rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2"
      >
        🔍 Filters {typeFilters.length + (urgencyFilter !== 'All' ? 1 : 0) > 0 && (
          <span className="bg-green-600 text-white text-xs rounded-full px-2 py-0.5">
            {typeFilters.length + (urgencyFilter !== 'All' ? 1 : 0)}
          </span>
        )}
      </button>

      {/* Listing count */}
      <div className="absolute top-4 left-4 z-[1000] bg-white border border-gray-200 shadow-md rounded-xl px-4 py-2 text-sm text-gray-700">
        🍱 <strong>{filtered.length}</strong> listings nearby
      </div>

      {/* Filter Panel */}
      {filterOpen && (
        <div className="absolute top-16 right-4 z-[1000] bg-white border border-gray-200 shadow-xl rounded-2xl p-4 w-64">
          <h3 className="font-bold text-gray-900 text-sm mb-3">Filter Food</h3>

          <div className="mb-4">
            <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">
              Radius: {radius} km
            </label>
            <input type="range" min="1" max="20" value={radius} onChange={e => setRadius(Number(e.target.value))}
              className="w-full accent-green-600" />
          </div>

          <div className="mb-4">
            <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">Food Type</label>
            <div className="flex flex-wrap gap-1">
              {FOOD_TYPES.map(type => (
                <button key={type} onClick={() => toggleType(type)}
                  className={`text-xs px-3 py-1 rounded-full border transition ${
                    typeFilters.includes(type) ? 'bg-green-600 text-white border-green-600' : 'border-gray-300 text-gray-600 hover:border-green-400'
                  }`}>
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">Urgency</label>
            {['All', 'Urgent', 'Expiring Soon', 'Fresh'].map(u => (
              <button key={u} onClick={() => setUrgencyFilter(u)}
                className={`block w-full text-left text-xs px-3 py-2 rounded-lg mb-1 transition ${
                  urgencyFilter === u ? 'bg-green-100 text-green-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'
                }`}>
                {u}
              </button>
            ))}
          </div>

          {(typeFilters.length > 0 || urgencyFilter !== 'All') && (
            <button onClick={() => { setTypeFilters([]); setUrgencyFilter('All') }}
              className="mt-2 w-full text-xs text-red-600 hover:underline">Clear filters</button>
          )}
        </div>
      )}
    </div>
  )
}
