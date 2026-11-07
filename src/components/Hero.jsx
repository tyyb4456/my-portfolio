import { useState, useEffect, useRef } from 'react'
import ProfilePanel from './ProfilePanel'

const coreStack = [
  {
    label: 'Machine Learning',
    color: 'text-lav',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6l2.1 2.1m0-12.8l-2.1 2.1M7.7 16.3l-2.1 2.1" />
        <circle cx="12" cy="12" r="3.5" />
      </svg>
    ),
  },
  {
    label: 'LLMs',
    color: 'text-sky',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5M21 12a8 8 0 01-8 8H7l-4 2 1.2-4.2A8 8 0 1121 12z" />
      </svg>
    ),
  },
  {
    label: 'RAG',
    color: 'text-mint',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6.5A2.5 2.5 0 016.5 4H20v13H6.5A2.5 2.5 0 004 19.5v-13z" />
        <path strokeLinecap="round" d="M8 8h8M8 12h5" />
      </svg>
    ),
  },
  {
    label: 'Deploy',
    color: 'text-coral',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L8 8m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
      </svg>
    ),
  },
]

const stats = [
  { value: '6+', label: 'AI projects' },
  { value: '2nd', label: 'AI Hackathon' },
  { value: 'Master', label: 'Kaggle' },
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

          {/* Clay profile sections */}
          <div className="hero-float">
            <div className="relative max-w-md mx-auto space-y-4">
              <div className="pointer-events-none absolute -inset-10 -z-10 rounded-full bg-lav/10 blur-3xl" aria-hidden="true" />

              {/* Identity */}
              <div className={`clay relative p-6 transition-all duration-700 ease-out ${visible.buttons ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                <div className="flex items-center gap-4">
                  <div className="relative shrink-0">
                    <div className="clay-tile w-20 h-20 rounded-full overflow-hidden">
                      <img
                        src="1118a52b-a8fd-4b47-8042-f18d7b520be1.webp"
                        alt="Tayyab Hussain"
                        className="w-full h-full object-cover scale-110"
                      />
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 flex w-5 h-5">
                      <span className="absolute inline-flex w-full h-full rounded-full bg-mint/60 animate-ping" />
                      <span className="relative inline-flex w-5 h-5 rounded-full bg-mint border-4 border-[var(--surface-solid)]" />
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-muted">Good to see you</p>
                    <p className="text-2xl font-black text-cream truncate">Tayyab Hussain</p>
                    <p className="text-sm text-muted truncate">AI Engineer · Multan, PK</p>
                  </div>
                </div>
              </div>

              {/* Currently building */}
              <div
                className={`clay-sm relative overflow-hidden p-5 transition-all duration-700 ease-out ${visible.buttons ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                style={{ transitionDelay: '100ms' }}
              >
                <div className="pointer-events-none absolute -top-12 -right-12 w-40 h-40 rounded-full bg-lav/15 blur-2xl" aria-hidden="true" />
                <div className="relative flex items-center gap-2">
                  <span className="relative flex w-2 h-2">
                    <span className="absolute inline-flex w-full h-full rounded-full bg-lav opacity-70 animate-ping" />
                    <span className="relative inline-flex w-2 h-2 rounded-full bg-lav" />
                  </span>
                  <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-muted">Currently building</p>
                </div>
                <p className="relative mt-2 text-2xl font-black text-cream leading-tight">LLM &amp; RAG systems</p>
                <p className="relative text-sm text-muted mt-2 leading-relaxed">Production retrieval pipelines with LangChain, LangGraph &amp; vector search.</p>
              </div>

              {/* Stats */}
              <div
                className={`grid grid-cols-3 gap-3 transition-all duration-700 ease-out ${visible.buttons ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                style={{ transitionDelay: '200ms' }}
              >
                {stats.map((s) => (
                  <div key={s.label} className="clay-sm py-4 text-center">
                    <p className="text-xl font-black text-clay-gradient leading-none">{s.value}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted mt-1.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Core stack + CTA */}
              <div
                className={`pt-1 transition-all duration-700 ease-out ${visible.buttons ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                style={{ transitionDelay: '300ms' }}
              >
                <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-muted mb-3">Core stack</p>
                <div className="flex flex-wrap gap-2">
                  {coreStack.map((item) => (
                    <span key={item.label} className="clay-pill flex items-center gap-2 px-3 py-1.5">
                      <span className={item.color}>{item.icon}</span>
                      <span className="text-[11px] font-bold tracking-wide text-cream-soft">{item.label}</span>
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => setPanelOpen(true)}
                  className="clay-btn w-full justify-center px-5 py-3 mt-5 text-sm"
                >
                  View full profile
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6l6 6-6 6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

        </div>
      </section>

      <ProfilePanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  )
}
