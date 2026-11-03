import { useState, useEffect, useRef } from 'react'
import ProfilePanel from './ProfilePanel'

const quickActions = [
  {
    label: 'ML',
    color: 'text-lav',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6l2.1 2.1m0-12.8l-2.1 2.1M7.7 16.3l-2.1 2.1" />
        <circle cx="12" cy="12" r="3.5" />
      </svg>
    ),
  },
  {
    label: 'LLM',
    color: 'text-sky',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5M21 12a8 8 0 01-8 8H7l-4 2 1.2-4.2A8 8 0 1121 12z" />
      </svg>
    ),
  },
  {
    label: 'RAG',
    color: 'text-mint',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6.5A2.5 2.5 0 016.5 4H20v13H6.5A2.5 2.5 0 004 19.5v-13z" />
        <path strokeLinecap="round" d="M8 8h8M8 12h5" />
      </svg>
    ),
  },
  {
    label: 'Deploy',
    color: 'text-coral',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L8 8m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
      </svg>
    ),
  },
]

const stats = [
  { value: 'Kaggle', label: 'Master' },
  { value: '2nd', label: 'AI Hackathon' },
  { value: '6+', label: 'AI projects' },
]

export default function Hero() {
  const [visible, setVisible] = useState({ title: false, subtitle: false, desc: false, buttons: false })
  const [subtitleText, setSubtitleText] = useState('')
  const [panelOpen, setPanelOpen] = useState(false)
  const heroRef = useRef(null)
  const mousePosRef = useRef({ x: 0, y: 0 })
  const rafPending = useRef(false)
  const fullText = 'AI engineer'

  useEffect(() => {
    setTimeout(() => setVisible(v => ({ ...v, title: true })), 200)
    setTimeout(() => setVisible(v => ({ ...v, subtitle: true })), 600)
    setTimeout(() => setVisible(v => ({ ...v, desc: true })), 1000)
    setTimeout(() => setVisible(v => ({ ...v, buttons: true })), 1400)

    let i = 0
    const timer = setTimeout(() => {
      const type = setInterval(() => {
        if (i < fullText.length) { setSubtitleText(fullText.slice(0, i + 1)); i++ }
        else clearInterval(type)
      }, 100)
    }, 800)
    return () => clearTimeout(timer)
  }, [])

  const handleMouseMove = (e) => {
    mousePosRef.current = { x: e.clientX, y: e.clientY }
    if (rafPending.current) return
    rafPending.current = true
    requestAnimationFrame(() => {
      rafPending.current = false
      const rect = heroRef.current?.getBoundingClientRect()
      if (!rect) return
      const x = (mousePosRef.current.x - rect.left) / rect.width - 0.5
      const y = (mousePosRef.current.y - rect.top) / rect.height - 0.5
      heroRef.current.querySelectorAll('.hero-float').forEach((el, i) => {
        el.style.transform = `translate(${x * (i + 1) * 10}px, ${y * (i + 1) * 10}px)`
      })
    })
  }

  const handleMouseLeave = () => {
    heroRef.current?.querySelectorAll('.hero-float').forEach(el => { el.style.transform = 'translate(0,0)' })
  }

  return (
    <>
      <section
        id="hero"
        ref={heroRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative overflow-hidden min-h-screen flex items-center px-6 pt-32 pb-20"
      >
        <div className="relative z-10 grid md:grid-cols-2 items-center gap-14 md:gap-12 w-full max-w-6xl mx-auto">

          {/* Copy */}
          <div className="space-y-7 text-center md:text-left">
            <div className={`inline-flex items-center gap-2 clay-pill px-4 py-2 text-xs font-bold tracking-widest uppercase text-muted transition-all duration-700 ${visible.title ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <span className="relative flex w-2 h-2">
                <span className="absolute inline-flex w-full h-full rounded-full bg-mint opacity-75 animate-ping" />
                <span className="relative inline-flex w-2 h-2 rounded-full bg-mint" />
              </span>
              Available for work
            </div>

            <h1 className={`text-7xl md:text-8xl font-black tracking-tight leading-[0.95] transition-all duration-700 ${visible.title ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
              <span className="text-clay-gradient">AI.</span>
              <span className="block text-3xl md:text-4xl font-extrabold mt-4 text-cream">Built to ship.</span>
            </h1>

            <p className={`uppercase tracking-[0.3em] text-muted text-xs font-bold transition-all duration-700 ${visible.subtitle ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              {subtitleText}<span className="animate-pulse text-lav">|</span>
            </p>

            <p className={`text-muted text-base md:text-lg max-w-lg mx-auto md:mx-0 leading-relaxed transition-all duration-700 ${visible.desc ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              With expertise in Machine Learning, LLM applications, RAG systems, and full-stack AI development
            </p>

            <div className={`flex flex-wrap justify-center md:justify-start gap-4 transition-all duration-700 ${visible.buttons ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <button onClick={() => setPanelOpen(true)} className="clay-btn px-8 py-3.5 text-sm">
                Learn More
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6l6 6-6 6" />
                </svg>
              </button>
              <a href="mailto:igntayyab@gmail.com" className="clay-btn clay-btn-primary px-8 py-3.5 text-sm">
                Contact Me
              </a>
            </div>
          </div>

          {/* Clay profile card */}
          <div className={`hero-float transition-all duration-1000 delay-300 ${visible.buttons ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`} style={{ transitionProperty: 'opacity, transform' }}>
            <div className="clay-lg p-6 md:p-7 max-w-md mx-auto relative">
              <div className="flex items-center gap-4">
                <div className="clay-tile w-16 h-16 rounded-full overflow-hidden shrink-0">
                  <img
                    src="1118a52b-a8fd-4b47-8042-f18d7b520be1.webp"
                    alt="Tayyab Hussain"
                    className="w-full h-full object-cover scale-110"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold tracking-widest uppercase text-muted">Good to see you</p>
                  <p className="text-xl font-black text-cream truncate">Tayyab Hussain</p>
                  <p className="text-xs text-muted truncate">AI Engineer · Multan, PK</p>
                </div>
                <span className="ml-auto w-3 h-3 rounded-full bg-mint shadow-[0_0_12px_rgba(110,231,183,0.8)] shrink-0" />
              </div>

              <div className="clay-inset mt-6 p-4 flex items-center gap-4">
                <div className="clay-tile w-11 h-11 text-lav shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <rect x="3" y="5" width="18" height="16" rx="4" />
                    <path strokeLinecap="round" d="M8 3v4m8-4v4M3 11h18" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-cream">Current focus</p>
                  <p className="text-xs text-muted">LLM &amp; RAG systems</p>
                </div>
                <svg className="w-4 h-4 text-muted ml-auto shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>

              <p className="text-xs font-bold tracking-widest uppercase text-muted mt-6 mb-3">Quick actions</p>
              <div className="grid grid-cols-4 gap-3">
                {quickActions.map((action) => (
                  <div key={action.label} className="clay-tile clay-hover flex flex-col items-center gap-2 py-3">
                    <span className={action.color}>{action.icon}</span>
                    <span className="text-[10px] font-bold text-muted tracking-wide">{action.label}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3 mt-6">
                {stats.map((s) => (
                  <div key={s.label} className="clay-inset px-2 py-3 text-center">
                    <p className="text-base font-black text-clay-gradient">{s.value}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </section>

      <ProfilePanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  )
}
