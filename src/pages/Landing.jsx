import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

function useCountUpOnVisible(target, duration = 1200) {
  const [value, setValue] = useState(0)
  const ref = useRef(null)
  const started = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
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
      }
    }, { threshold: 0.3 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target, duration])
  return [value, ref]
}

function ImpactStat({ value, label, suffix = '' }) {
  const [animated, ref] = useCountUpOnVisible(value)
  return (
    <div ref={ref} className="text-center">
      <p className="text-3xl md:text-4xl font-bold text-green-700">{animated.toLocaleString()}{suffix}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  )
}

const steps = [
  { icon: '📸', title: 'Post Surplus Food', desc: 'Take a photo, add details and pickup location. Takes under 2 minutes.' },
  { icon: '🗺️', title: 'Find it on the Map', desc: 'Nearby receivers see your listing as a live pin on the map.' },
  { icon: '🤝', title: 'Arrange Pickup', desc: 'Receiver claims the food and contacts you via WhatsApp to coordinate.' },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="text-6xl mb-6">🍱</div>
        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 leading-tight mb-4">
          Rescue Food.<br />
          <span className="text-green-700">Feed Communities.</span>
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-8">
          Connect surplus food with people who need it — in real time.
          India wastes 67 million tonnes of food annually. Let's change that.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/register" className="px-8 py-4 bg-green-700 text-white font-bold rounded-2xl hover:bg-green-800 transition text-lg">
            🥘 Donate Surplus Food
          </Link>
          <Link to="/map" className="px-8 py-4 border-2 border-green-700 text-green-700 font-bold rounded-2xl hover:bg-green-50 transition text-lg">
            🗺️ Find Food Near Me
          </Link>
        </div>
      </section>

      {/* Impact Stats */}
      <section className="bg-gray-50 py-12 border-y border-gray-200">
        <div className="max-w-3xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8">
          <ImpactStat value={2400} label="kg food saved" suffix="+" />
          <ImpactStat value={6000} label="meals served" suffix="+" />
          <ImpactStat value={48} label="active donors" suffix="+" />
          <ImpactStat value={12} label="cities covered" suffix="+" />
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">How It Works</h2>
        <p className="text-gray-500 mb-10">Three simple steps to rescue food</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((s, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-md transition">
              <div className="text-4xl mb-3">{s.icon}</div>
              <div className="text-xs font-bold text-green-700 mb-1">Step {i + 1}</div>
              <h3 className="font-bold text-gray-900 mb-2">{s.title}</h3>
              <p className="text-sm text-gray-500">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-green-700 py-16 text-center px-4">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">Ready to make a difference?</h2>
        <p className="text-green-100 mb-8">Join hundreds of donors and receivers already using FoodBridge</p>
        <Link to="/register" className="px-8 py-4 bg-white text-green-700 font-bold rounded-2xl hover:bg-green-50 transition text-lg">
          Get Started Free →
        </Link>
      </section>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between text-sm text-gray-400">
        <div className="font-bold text-gray-700 flex items-center gap-2">
          🍱 FoodBridge
          <span className="font-normal text-gray-400">— Rescue Food. Feed Communities.</span>
        </div>
        <a href="https://github.com" target="_blank" rel="noreferrer" className="mt-4 md:mt-0 hover:text-gray-600">GitHub</a>
      </footer>
    </div>
  )
}
