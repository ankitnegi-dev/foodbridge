import { useState } from 'react'
import supabase from '../lib/supabase'
import toast from 'react-hot-toast'

function getUrgencyBadge(expiryAt) {
  const diff = (new Date(expiryAt) - new Date()) / 3600000
  if (diff <= 0) return { label: '⚫ Expired', cls: 'bg-gray-200 text-gray-500' }
  if (diff < 2)  return { label: '🔴 Urgent', cls: 'bg-red-100 text-red-700' }
  if (diff < 6)  return { label: '🟠 Expiring Soon', cls: 'bg-amber-100 text-amber-700' }
  if (diff < 24) return { label: '🔵 Available', cls: 'bg-blue-100 text-blue-700' }
  return { label: '🟢 Fresh', cls: 'bg-green-100 text-green-700' }
}

function getSafetyScore(expiryAt) {
  const diff = (new Date(expiryAt) - new Date()) / 3600000
  if (diff <= 0)  return { score: 0, stars: '☆☆☆☆☆', label: 'Expired',   cls: 'text-gray-400' }
  if (diff < 2)   return { score: 1, stars: '★☆☆☆☆', label: 'Critical',  cls: 'text-red-500' }
  if (diff < 6)   return { score: 2, stars: '★★☆☆☆', label: 'Poor',      cls: 'text-orange-500' }
  if (diff < 12)  return { score: 3, stars: '★★★☆☆', label: 'Moderate',  cls: 'text-amber-500' }
  if (diff < 24)  return { score: 4, stars: '★★★★☆', label: 'Good',      cls: 'text-blue-500' }
  return           { score: 5, stars: '★★★★★', label: 'Excellent', cls: 'text-green-600' }
}

function getCountdown(expiryAt) {
  const diff = new Date(expiryAt) - new Date()
  if (diff <= 0) return 'Expired'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h > 0) return `Expires in ${h}h ${m}m`
  return `Expires in ${m}m`
}

export default function ListingCard({ listing, showActions, onDelete }) {
  const [deleting, setDeleting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const badge = getUrgencyBadge(listing.expiry_at)
  const safety = getSafetyScore(listing.expiry_at)
  const isEmergency = listing.is_emergency

  async function handleDelete() {
    setDeleting(true)
    const { error } = await supabase
      .from('food_listings')
      .update({ status: 'expired' })
      .eq('id', listing.id)
    setDeleting(false)
    if (error) toast.error('Failed to delete listing')
    else { toast.success('Listing removed'); onDelete?.(listing.id) }
    setShowConfirm(false)
  }

  return (
    <div className={`bg-white rounded-2xl border overflow-hidden hover:shadow-md transition ${isEmergency ? 'border-red-400 ring-2 ring-red-200' : 'border-gray-200'}`}>
      {/* Emergency Banner */}
      {isEmergency && (
        <div className="bg-red-500 text-white text-xs font-bold px-3 py-1 flex items-center gap-1">
          🚨 EMERGENCY MODE — Urgent Food Needed
        </div>
      )}

      {/* Photo */}
      <div className="h-40 bg-gray-100 overflow-hidden">
        {listing.photo_url ? (
          <img src={listing.photo_url} alt={listing.food_name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl text-gray-300">🍽️</div>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-bold text-gray-900 text-base">{listing.food_name}</h3>
          <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${badge.cls}`}>{badge.label}</span>
        </div>

        <p className="text-sm text-gray-600 mb-2">
          <span className="font-medium">{listing.quantity} {listing.unit}</span>
        </p>

        {listing.food_type?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {listing.food_type.map(t => (
              <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{t}</span>
            ))}
          </div>
        )}

        {/* Safety Score */}
        <div className="flex items-center gap-1 mb-2">
          <span className="text-xs text-gray-500">Safety:</span>
          <span className={`text-sm font-bold ${safety.cls}`}>{safety.stars}</span>
          <span className={`text-xs font-semibold ${safety.cls}`}>{safety.label}</span>
        </div>

        <p className="text-xs text-gray-500 mb-1">📍 {listing.pickup_address}</p>
        <p className="text-xs text-gray-400">{getCountdown(listing.expiry_at)}</p>

        {showActions && (
          <div className="mt-3 flex gap-2">
            {!showConfirm ? (
              <button onClick={() => setShowConfirm(true)}
                className="flex-1 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition">
                Delete
              </button>
            ) : (
              <div className="flex gap-2 w-full">
                <button onClick={handleDelete} disabled={deleting}
                  className="flex-1 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition disabled:opacity-50">
                  {deleting ? '…' : 'Confirm Delete'}
                </button>
                <button onClick={() => setShowConfirm(false)}
                  className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
