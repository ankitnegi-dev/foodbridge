import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import supabase from '../lib/supabase'
import ListingCard from '../components/ListingCard'

const TABS = ['Active', 'Claimed', 'Expired']

export default function MyListings() {
  const { user } = useAuth()
  const [listings, setListings] = useState([])
  const [tab, setTab] = useState('Active')
  const [loading, setLoading] = useState(true)
  const [claimMap, setClaimMap] = useState({}) // listing_id → { receiver name, phone }
  const channelRef = useRef(null)

  useEffect(() => {
    if (!user) return

    async function load() {
      // Fetch all donor listings
      const { data: listingsData } = await supabase.from('food_listings')
        .select('*')
        .eq('donor_id', user.id)
        .order('created_at', { ascending: false })
      setListings(listingsData || [])
      setLoading(false)

      // For claimed listings, fetch receiver info
      const claimedIds = (listingsData || []).filter(l => l.status === 'claimed').map(l => l.id)
      if (claimedIds.length > 0) {
        const { data: claimsData } = await supabase.from('claims')
          .select('listing_id, receiver_id')
          .in('listing_id', claimedIds)
        if (claimsData && claimsData.length > 0) {
          const receiverIds = [...new Set(claimsData.map(c => c.receiver_id))]
          const { data: profiles } = await supabase.from('profiles')
            .select('id, name, phone').in('id', receiverIds)
          const profileMap = {}
          if (profiles) profiles.forEach(p => { profileMap[p.id] = p })
          const map = {}
          claimsData.forEach(c => { map[c.listing_id] = profileMap[c.receiver_id] || null })
          setClaimMap(map)
        }
      }
    }

    load()

    // Realtime: update listing status live when someone claims it
    channelRef.current = supabase
      .channel('my-listings-' + user.id)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'food_listings',
        filter: `donor_id=eq.${user.id}`
      }, payload => {
        setListings(prev => prev.map(l => l.id === payload.new.id ? { ...l, ...payload.new } : l))
        if (payload.new.status === 'claimed') {
          setTab('Claimed')
          // Fetch receiver info for this newly claimed listing
          supabase.from('claims').select('receiver_id').eq('listing_id', payload.new.id).single()
            .then(({ data: claim }) => {
              if (claim?.receiver_id) {
                supabase.from('profiles').select('id, name, phone').eq('id', claim.receiver_id).single()
                  .then(({ data: p }) => {
                    if (p) setClaimMap(prev => ({ ...prev, [payload.new.id]: p }))
                  })
              }
            })
        }
      })
      .subscribe()

    return () => { channelRef.current && supabase.removeChannel(channelRef.current) }
  }, [user])

  function handleDelete(id) {
    setListings(prev => prev.map(l => l.id === id ? { ...l, status: 'expired' } : l))
  }

  const statusMap = { Active: 'available', Claimed: 'claimed', Expired: 'expired' }
  const filtered = listings.filter(l => l.status === statusMap[tab])

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Listings</h1>
        <Link to="/post" className="px-5 py-2 bg-green-700 text-white text-sm font-semibold rounded-xl hover:bg-green-800 transition">
          + Post New Food
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 text-sm font-medium rounded-lg transition ${tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading listings…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">🍽️</p>
          <p className="text-gray-500">No {tab.toLowerCase()} listings</p>
          {tab === 'Active' && (
            <Link to="/post" className="mt-4 inline-block text-sm text-green-700 font-semibold hover:underline">Post your first listing →</Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(listing => {
            const receiver = claimMap[listing.id]
            const waMsg = receiver ? encodeURIComponent(
              `Hi ${receiver.name || 'there'}! I'm the donor of "${listing.food_name}" on FoodBridge 🍱\n\nYou claimed my listing — let's arrange a pickup!\n\n*Pickup address:* ${listing.pickup_address}\n\nWhen works for you?`
            ) : null
            return (
              <div key={listing.id}>
                <ListingCard listing={listing} showActions={tab === 'Active'} onDelete={handleDelete} />
                {/* Claimed tab: show receiver contact */}
                {tab === 'Claimed' && (
                  <div className="mt-2 bg-blue-50 border border-blue-100 rounded-2xl p-3">
                    <p className="text-xs font-semibold text-blue-700 mb-2">👤 Claimed by: <span className="font-bold">{receiver?.name || 'Loading…'}</span></p>
                    {receiver?.phone ? (
                      <a
                        href={`https://wa.me/91${receiver.phone.replace(/\D/g,'')}?text=${waMsg}`}
                        target="_blank" rel="noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-2 bg-[#25D366] hover:bg-[#1ebe57] text-white rounded-xl text-xs font-semibold transition"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.136.564 4.14 1.545 5.872L0 24l6.293-1.516A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.65-.502-5.18-1.378l-.37-.22-3.737.9.933-3.632-.241-.374A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                        WhatsApp {receiver.name || 'Receiver'}
                      </a>
                    ) : (
                      <p className="text-xs text-center text-amber-600">📵 Receiver hasn't added their WhatsApp number yet</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
