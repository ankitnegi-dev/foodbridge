import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import supabase from '../lib/supabase'
import toast from 'react-hot-toast'

const FOOD_TYPES = ['Veg', 'Non-Veg', 'Dairy', 'Bakery', 'Cooked', 'Raw']

function getUrgencyBadge(expiryAt) {
  if (!expiryAt) return null
  const diff = (new Date(expiryAt) - new Date()) / 3600000
  if (diff <= 0)  return <span className="inline-block text-xs font-bold text-white bg-gray-500 px-3 py-1 rounded-full">⚫ Expired — cannot post</span>
  if (diff < 2)   return <span className="inline-block text-xs font-bold text-white bg-red-500 px-3 py-1 rounded-full">🔴 Too soon — minimum 2 hours required</span>
  if (diff < 6)   return <span className="inline-block text-xs font-bold text-white bg-amber-500 px-3 py-1 rounded-full">🟠 Expiring Soon</span>
  if (diff < 24)  return <span className="inline-block text-xs font-bold text-white bg-blue-500 px-3 py-1 rounded-full">🔵 Available</span>
  return                 <span className="inline-block text-xs font-bold text-white bg-green-600 px-3 py-1 rounded-full">🟢 Fresh</span>
}

export default function PostFood() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    food_name: '', description: '', quantity: '', unit: 'kg',
    food_type: [], expiry_at: '', pickup_address: ''
  })
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [lat, setLat] = useState(null)
  const [lng, setLng] = useState(null)
  const [geocoding, setGeocoding] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isEmergency, setIsEmergency] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)

  if (!user || profile?.role !== 'donor') {
    navigate('/login')
    return null
  }

  function toggleFoodType(type) {
    setForm(f => ({
      ...f,
      food_type: f.food_type.includes(type) ? f.food_type.filter(t => t !== type) : [...f.food_type, type]
    }))
  }

  async function geocodeAddress() {
    if (!form.pickup_address.trim()) return
    setGeocoding(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(form.pickup_address)}&format=json&limit=1`
      )
      const data = await res.json()
      if (data.length > 0) {
        setLat(parseFloat(data[0].lat))
        setLng(parseFloat(data[0].lon))
        toast.success('Location found!')
      } else {
        toast.error('Location not found. Try a more specific address.')
      }
    } catch {
      toast.error('Geocoding failed')
    } finally {
      setGeocoding(false)
    }
  }

  async function handlePhotoChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
    setAiAnalysis(null)

    // Auto-trigger AI analysis after photo selected
    setAiLoading(true)
    try {
      const base64 = await readFileAsBase64(file)
      const res = await fetch('/api/analyze-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          foodName: form.food_name || '',
          expiryAt: form.expiry_at || null
        })
      })
      const data = await res.json()
      if (data.success) setAiAnalysis(data.analysis)
      else setAiAnalysis({ error: data.error })
    } catch {
      setAiAnalysis({ error: 'AI analysis unavailable' })
    } finally {
      setAiLoading(false)
    }
  }

  // Convert image file to base64 data URL — no storage bucket needed
  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()

    // Block if food is already expired or expiring within 2 hours
    const diffHours = (new Date(form.expiry_at) - new Date()) / 3600000
    if (diffHours <= 0) {
      toast.error('❌ This food has already expired. You cannot post it.')
      return
    }
    if (diffHours < 2) {
      toast.error('❌ Food must have at least 2 hours before expiry to be posted.')
      return
    }

    if (!lat || !lng) { toast.error('Please confirm location (blur the address field)'); return }
    setLoading(true)

    try {
      let publicUrl = null

      if (photo) {
        // Store as base64 directly in DB — bypasses storage bucket entirely
        publicUrl = await readFileAsBase64(photo)
      }

      // Insert listing (photo_url is nullable)
      const { error: insertError } = await supabase.from('food_listings').insert({
        donor_id: user.id,
        food_name: form.food_name,
        description: form.description,
        quantity: parseFloat(form.quantity),
        unit: form.unit,
        food_type: form.food_type,
        expiry_at: form.expiry_at,
        photo_url: publicUrl,
        pickup_address: form.pickup_address,
        lat,
        lng,
        status: 'available',
        is_emergency: isEmergency,
      })
      if (insertError) throw insertError

      toast.success('Food listing posted! 🎉')
      navigate('/my-listings')
    } catch (err) {
      toast.error(err.message || 'Failed to post listing')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Post Surplus Food</h1>
      <p className="text-gray-500 text-sm mb-4">Help reduce waste by sharing food with your community</p>

      {/* Phone warning — receivers contact donor via WhatsApp */}
      {!profile?.phone && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 mb-5">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">Add your phone number!</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Receivers contact you via WhatsApp after claiming. Without a phone number, they won't be able to reach you.{' '}
              <a href="/profile" className="underline font-semibold">Add it in Profile →</a>
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Food Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Food Name *</label>
          <input type="text" required value={form.food_name} onChange={e => setForm(f => ({ ...f, food_name: e.target.value }))}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="e.g. Biryani, Idli Sambar, Bread" />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={3} className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            placeholder="Any details about the food..." />
        </div>

        {/* Quantity & Unit */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
            <input type="number" min="1" required value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="20" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
            <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
              {['kg', 'portions', 'items', 'packets'].map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
        </div>

        {/* Food Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Food Type</label>
          <div className="flex flex-wrap gap-2">
            {FOOD_TYPES.map(type => (
              <button key={type} type="button" onClick={() => toggleFoodType(type)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition ${
                  form.food_type.includes(type)
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-green-400'
                }`}>
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Expiry */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date & Time *</label>
          <input type="datetime-local" required value={form.expiry_at} onChange={e => setForm(f => ({ ...f, expiry_at: e.target.value }))}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          {form.expiry_at && <div className="mt-2">{getUrgencyBadge(form.expiry_at)}</div>}
        </div>

        {/* Photo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Food Photo <span className="text-gray-400 font-normal">(optional)</span></label>
          <input type="file" accept="image/*" onChange={handlePhotoChange}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" />
          {photoPreview && (
            <img src={photoPreview} alt="preview" className="mt-2 w-24 h-24 object-cover rounded-xl border" />
          )}

          {/* AI Analysis Result */}
          {aiLoading && (
            <div className="mt-3 flex items-center gap-2 text-sm text-purple-600 bg-purple-50 border border-purple-200 rounded-xl px-4 py-3">
              <span className="animate-spin">🤖</span>
              <span>AI is analyzing your food photo…</span>
            </div>
          )}
          {aiAnalysis && !aiAnalysis.error && (
            <div className={`mt-3 rounded-xl border-2 p-4 ${
              aiAnalysis.safeToEat
                ? aiAnalysis.freshnessScore >= 7 ? 'border-green-300 bg-green-50'
                  : aiAnalysis.freshnessScore >= 4 ? 'border-amber-300 bg-amber-50'
                  : 'border-orange-300 bg-orange-50'
                : 'border-red-300 bg-red-50'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold text-gray-800">🤖 AI Food Analysis</p>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                  aiAnalysis.safeToEat ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {aiAnalysis.safeToEat ? '✅ Safe to Share' : '⚠️ Not Recommended'}
                </span>
              </div>
              <div className="flex items-center gap-3 mb-2">
                <div className="text-center">
                  <div className="text-2xl font-black text-gray-800">{aiAnalysis.freshnessScore}<span className="text-sm font-normal text-gray-500">/10</span></div>
                  <div className="text-xs text-gray-500">Freshness</div>
                </div>
                <div className="flex-1">
                  <div className={`text-xs font-semibold mb-1 ${
                    aiAnalysis.condition === 'Excellent' || aiAnalysis.condition === 'Good' ? 'text-green-700'
                    : aiAnalysis.condition === 'Fair' ? 'text-amber-700'
                    : 'text-red-700'
                  }`}>Condition: {aiAnalysis.condition}</div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className={`h-2 rounded-full ${
                      aiAnalysis.freshnessScore >= 7 ? 'bg-green-500'
                      : aiAnalysis.freshnessScore >= 4 ? 'bg-amber-500'
                      : 'bg-red-500'
                    }`} style={{ width: `${aiAnalysis.freshnessScore * 10}%` }} />
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-700 mb-1">{aiAnalysis.summary}</p>
              {aiAnalysis.warnings?.length > 0 && (
                <p className="text-xs text-amber-700">⚠️ {aiAnalysis.warnings.join(' • ')}</p>
              )}
              {aiAnalysis.recommendation && (
                <p className="text-xs text-gray-600 mt-1 italic">💡 {aiAnalysis.recommendation}</p>
              )}
            </div>
          )}
          {aiAnalysis?.error && (
            <p className="mt-2 text-xs text-gray-400">🤖 AI analysis unavailable: {aiAnalysis.error}</p>
          )}
        </div>

        {/* Address */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Address *</label>
          <input type="text" required value={form.pickup_address}
            onChange={e => setForm(f => ({ ...f, pickup_address: e.target.value }))}
            onBlur={geocodeAddress}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="e.g. Tambaram, Chennai" />
          {geocoding && <p className="text-xs text-blue-500 mt-1">📍 Finding location…</p>}
          {lat && lng && <p className="text-xs text-green-600 mt-1">✅ Location confirmed: {lat.toFixed(4)}, {lng.toFixed(4)}</p>}
        </div>

        {/* Emergency Mode */}
        <div
          onClick={() => setIsEmergency(e => !e)}
          className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition ${
            isEmergency ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-red-300'
          }`}
        >
          <span className="text-2xl">🚨</span>
          <div className="flex-1">
            <p className="font-semibold text-sm text-gray-900">Emergency Mode</p>
            <p className="text-xs text-gray-500">Mark this as urgent — disaster/crisis food needed immediately</p>
          </div>
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
            isEmergency ? 'bg-red-500 border-red-500' : 'border-gray-300'
          }`}>
            {isEmergency && <span className="text-white text-xs font-bold">✓</span>}
          </div>
        </div>

        <button type="submit" disabled={loading}
          className="w-full bg-green-700 text-white py-3 rounded-xl font-semibold hover:bg-green-800 transition disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? (
            <><span className="animate-spin">⏳</span> Posting…</>
          ) : '🍽️ Post Food Listing'}
        </button>
      </form>
    </div>
  )
}
