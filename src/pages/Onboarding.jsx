import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import supabase from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const ROLES = [
  {
    role: 'donor',
    icon: '🥘',
    title: 'I want to donate food',
    desc: 'Post surplus food and connect with people nearby who need it',
    badge: 'Donor',
    color: 'green',
    border: 'border-green-200 hover:border-green-500 hover:bg-green-50',
    badgeCls: 'bg-green-100 text-green-700',
  },
  {
    role: 'receiver',
    icon: '🙏',
    title: 'I need food',
    desc: 'Browse the live map and claim available food near your location',
    badge: 'Receiver',
    color: 'blue',
    border: 'border-blue-200 hover:border-blue-500 hover:bg-blue-50',
    badgeCls: 'bg-blue-100 text-blue-700',
  },
  {
    role: 'volunteer',
    icon: '🚗',
    title: 'I want to volunteer',
    desc: 'Help coordinate pickups and deliveries between donors and receivers',
    badge: 'Volunteer',
    color: 'orange',
    border: 'border-orange-200 hover:border-orange-500 hover:bg-orange-50',
    badgeCls: 'bg-orange-100 text-orange-700',
  },
]

export default function Onboarding() {
  const { user, refetchProfile } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  async function selectRole(role) {
    if (!user) return
    setLoading(true)
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      role,
      name: user.email.split('@')[0],
    })
    setLoading(false)
    if (error) {
      toast.error('Something went wrong, please try again')
    } else {
      await refetchProfile()
      toast.success(`Welcome! You're registered as a ${role}.`)
      navigate('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-2xl">
        <div className="text-center mb-8">
          <span className="text-5xl">🍱</span>
          <h1 className="text-2xl font-bold text-gray-900 mt-3">How will you use FoodBridge?</h1>
          <p className="text-gray-500 text-sm mt-1">Choose your role to get started</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ROLES.map(r => (
            <button
              key={r.role}
              onClick={() => selectRole(r.role)}
              disabled={loading}
              className={`p-6 border-2 rounded-2xl transition group text-left ${r.border}`}
            >
              <div className="text-4xl mb-3">{r.icon}</div>
              <h2 className="font-bold text-gray-900 text-base mb-1">{r.title}</h2>
              <p className="text-gray-500 text-xs mt-1">{r.desc}</p>
              <span className={`inline-block mt-3 text-xs font-semibold px-3 py-1 rounded-full ${r.badgeCls}`}>{r.badge}</span>
            </button>
          ))}
        </div>

        {loading && <p className="text-center text-sm text-gray-500 mt-6">Setting up your account…</p>}
      </div>
    </div>
  )
}
