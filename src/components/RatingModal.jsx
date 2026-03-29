import { useState } from 'react'
import supabase from '../lib/supabase'
import toast from 'react-hot-toast'

export default function RatingModal({ claim, onClose, currentUserId }) {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)

  async function submitRating() {
    if (rating === 0) { toast.error('Please select a star rating'); return }
    setLoading(true)
    const { error } = await supabase.from('ratings').insert({
      rater_id: currentUserId,
      ratee_id: claim.food_listings?.donor_id || claim.donor_id,
      listing_id: claim.listing_id,
      claim_id: claim.id,
      rating,
      comment,
    })
    setLoading(false)
    if (error) {
      if (error.code === '23505') toast.error('You already rated this listing')
      else toast.error('Failed to submit rating')
    } else {
      toast.success('Rating submitted! ⭐ Thank you for your feedback')
      onClose()
    }
  }

  const labels = ['', 'Poor', 'Below Average', 'Average', 'Good', 'Excellent']

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Rate this Donation</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <p className="text-sm text-gray-500 mb-1">Food: <span className="font-semibold text-gray-900">{claim.food_listings?.food_name}</span></p>
        <p className="text-sm text-gray-500 mb-5">How was your experience with this food donation?</p>

        {/* Stars */}
        <div className="flex gap-2 justify-center mb-2">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              onMouseEnter={() => setHover(star)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(star)}
              className="text-4xl transition-transform hover:scale-110"
            >
              {star <= (hover || rating) ? '⭐' : '☆'}
            </button>
          ))}
        </div>
        {(hover || rating) > 0 && (
          <p className="text-center text-sm font-semibold text-green-700 mb-4">{labels[hover || rating]}</p>
        )}

        {/* Comment */}
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={3}
          placeholder="Leave a comment (optional)…"
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none mb-4"
        />

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 border border-gray-300 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50">
            Skip
          </button>
          <button onClick={submitRating} disabled={loading || rating === 0}
            className="flex-1 py-3 bg-green-700 text-white rounded-xl text-sm font-semibold hover:bg-green-800 transition disabled:opacity-50">
            {loading ? 'Submitting…' : '⭐ Submit Rating'}
          </button>
        </div>
      </div>
    </div>
  )
}
