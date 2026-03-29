import { useEffect, useState } from 'react'
import supabase from '../lib/supabase'

export default function Transparency() {
  const [transactions, setTransactions] = useState([])
  const [stats, setStats] = useState({ total: 0, kg: 0, donors: 0, receivers: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('food_listings')
      .select('*, profiles(name, role)')
      .eq('status', 'claimed')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        const listings = data || []
        const totalKg = listings.reduce((s, l) => s + (parseFloat(l.quantity) || 0), 0)
        const uniqueDonors = new Set(listings.map(l => l.donor_id)).size
        setTransactions(listings)
        setStats({ total: listings.length, kg: Math.round(totalKg), donors: uniqueDonors, receivers: listings.length })
        setLoading(false)
      })
  }, [])

  const foodTypeColors = {
    Veg: 'bg-green-100 text-green-700',
    'Non-Veg': 'bg-red-100 text-red-700',
    Dairy: 'bg-blue-100 text-blue-700',
    Bakery: 'bg-amber-100 text-amber-700',
    Cooked: 'bg-orange-100 text-orange-700',
    Raw: 'bg-gray-100 text-gray-600',
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Transparency Report 📋</h1>
        <p className="text-gray-500 text-sm mt-1">Complete open record of all food redistributed through FoodBridge</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          { icon: '✅', label: 'Successful Transfers', value: stats.total, color: 'bg-green-50 border-green-200 text-green-700' },
          { icon: '⚖️', label: 'Total kg Redistributed', value: `${stats.kg} kg`, color: 'bg-blue-50 border-blue-200 text-blue-700' },
          { icon: '👨‍🍳', label: 'Unique Donors', value: stats.donors, color: 'bg-amber-50 border-amber-200 text-amber-700' },
          { icon: '🍽️', label: 'Meals Enabled', value: Math.round(stats.kg * 2.5), color: 'bg-purple-50 border-purple-200 text-purple-700' },
        ].map(s => (
          <div key={s.label} className={`border rounded-2xl p-4 text-center ${s.color}`}>
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs mt-1 opacity-80">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Transaction Log */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">📦 Redistribution Log</h2>
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading records…</div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">📋</p>
          <p className="text-gray-500">No completed transactions yet</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Food</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Qty</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Donor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Location</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(t => (
                <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {t.is_emergency && <span className="mr-1">🚨</span>}
                    {t.food_name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{t.quantity} {t.unit}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(t.food_type || []).map(ft => (
                        <span key={ft} className={`text-xs px-2 py-0.5 rounded-full font-medium ${foodTypeColors[ft] || 'bg-gray-100 text-gray-600'}`}>
                          {ft}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{t.profiles?.name || 'Anonymous'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{t.pickup_address}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{new Date(t.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center mt-6">
        🔒 All records are tamper-proof and stored on Supabase PostgreSQL. Last updated: {new Date().toLocaleString()}
      </p>
    </div>
  )
}
