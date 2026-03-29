import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import supabase from '../lib/supabase'
import RatingModal from '../components/RatingModal'
import toast from 'react-hot-toast'

const statusColor = {
  pending:   'bg-gray-100 text-gray-600',
  confirmed: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
}

export default function Claims() {
  const { user, profile } = useAuth()
  const [claims, setClaims] = useState([])
  const [loading, setLoading] = useState(true)
  const [ratingClaim, setRatingClaim] = useState(null)
  const [ratedIds, setRatedIds] = useState(new Set())
  const [pinging, setPinging] = useState(null)
  const [pingedIds, setPingedIds] = useState(new Set())

  useEffect(() => {
    if (!user) return

    async function loadClaims() {
      // Step 1: fetch claims + food listing basics
      const { data: claimsData } = await supabase.from('claims')
        .select('*, food_listings(food_name, quantity, unit, pickup_address, donor_id)')
        .eq('receiver_id', user.id)
        .order('created_at', { ascending: false })

      if (!claimsData) { setLoading(false); return }

      // Step 2: collect unique donor_ids and fetch their profiles
      const donorIds = [...new Set(claimsData.map(c => c.food_listings?.donor_id).filter(Boolean))]
      let profileMap = {}
      if (donorIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles')
          .select('id, name, phone')
          .in('id', donorIds)
        if (profiles) profiles.forEach(p => { profileMap[p.id] = p })
      }

      // Step 3: merge donor profile into each claim
      const merged = claimsData.map(c => ({
        ...c,
        food_listings: {
          ...c.food_listings,
          profiles: profileMap[c.food_listings?.donor_id] || null
        }
      }))

      setClaims(merged)
      setLoading(false)
    }

    loadClaims()

    // Check which claims already rated
    supabase.from('ratings').select('claim_id').eq('rater_id', user.id)
      .then(({ data }) => setRatedIds(new Set((data || []).map(r => r.claim_id))))
  }, [user])

  async function pingDonor(c) {
    if (pingedIds.has(c.id)) return
    setPinging(c.id)
    try {
      const receiverName = profile?.name || user.email
      const donorId = c.food_listings?.donor_id
      if (!donorId) throw new Error('Donor not found')
      const { error } = await supabase.from('notifications').insert({
        user_id: donorId,
        message: `📬 ${receiverName} claimed your "${c.food_listings?.food_name}" and wants to arrange pickup. Please add your WhatsApp number in your Profile so they can contact you!`,
        is_read: false,
      })
      if (error) throw error
      setPingedIds(prev => new Set([...prev, c.id]))
      toast.success('Donor notified! They will reach out to coordinate pickup.')
    } catch (err) {
      toast.error('Could not notify donor: ' + (err.message || 'permission denied'))
    } finally {
      setPinging(null)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Claims</h1>
        <Link to="/map" className="px-5 py-2 bg-green-700 text-white text-sm font-semibold rounded-xl hover:bg-green-800 transition">
          🗺️ Find More Food
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading claims…</div>
      ) : claims.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">🗺️</p>
          <p className="text-gray-500 mb-4">No claims yet</p>
          <Link to="/map" className="text-sm text-green-700 font-semibold hover:underline">Browse food on the map →</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {claims.map(c => {
            const donorPhone = c.food_listings?.profiles?.phone
            const donorName  = c.food_listings?.profiles?.name || 'the donor'
            const foodName   = c.food_listings?.food_name || '—'
            const waMessage  = encodeURIComponent(
              `Hi ${donorName}! I claimed your food listing on FoodBridge 🍱\n\n*Food:* ${foodName}\n*Quantity:* ${c.food_listings?.quantity} ${c.food_listings?.unit}\n*Pickup:* ${c.food_listings?.pickup_address}\n\nCan we arrange a pickup time?`
            )
            return (
              <div key={c.id} className="bg-white border border-gray-200 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{foodName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">📍 {c.food_listings?.pickup_address}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColor[c.status] || 'bg-gray-100 text-gray-500'}`}>
                        {c.status}
                      </span>
                      <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  {/* Rate button */}
                  {!ratedIds.has(c.id) ? (
                    <button onClick={() => setRatingClaim(c)}
                      className="px-3 py-2 text-xs font-semibold text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-xl hover:bg-yellow-100 transition whitespace-nowrap flex-shrink-0">
                      ⭐ Rate
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">✅ Rated</span>
                  )}
                </div>

                {/* Contact row */}
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                  {donorPhone ? (
                    <a
                      href={`https://wa.me/91${donorPhone.replace(/\D/g,'')}?text=${waMessage}`}
                      target="_blank" rel="noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-2 bg-[#25D366] hover:bg-[#1ebe57] text-white rounded-xl text-xs font-semibold transition"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.136.564 4.14 1.545 5.872L0 24l6.293-1.516A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.65-.502-5.18-1.378l-.37-.22-3.737.9.933-3.632-.241-.374A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                      Contact {donorName} on WhatsApp
                    </a>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-center text-amber-600 bg-amber-50 rounded-lg py-1.5 px-2">
                        📵 <strong>{donorName}</strong> hasn't added their WhatsApp number yet
                      </p>
                      {pingedIds.has(c.id) ? (
                        <p className="text-xs text-center text-green-600 font-medium">
                          ✅ Donor notified! They will contact you via the app.
                        </p>
                      ) : (
                        <button
                          onClick={() => pingDonor(c)}
                          disabled={pinging === c.id}
                          className="flex items-center justify-center gap-2 w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl text-xs font-semibold transition"
                        >
                          {pinging === c.id ? '📨 Sending…' : '📨 Ping Donor to Contact You'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Rating Modal */}
      {ratingClaim && (
        <RatingModal
          claim={ratingClaim}
          currentUserId={user.id}
          onClose={() => {
            setRatedIds(prev => new Set([...prev, ratingClaim.id]))
            setRatingClaim(null)
          }}
        />
      )}
    </div>
  )
}
