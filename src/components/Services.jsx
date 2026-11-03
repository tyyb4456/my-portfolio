import { useEffect, useRef, useState } from 'react'
import ServicePanel from './ServicePanel'

const services = [
  {
    title: 'ML & Deep Learning',
    desc: 'End-to-end ML pipelines, computer vision, and deep learning models for real-world problems.',
    sub: 'Ask me about ML projects',
    icon: (
      <svg className="h-12 w-12 text-lav" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M4 4h16v12H4z" /><path d="M8 20h8" /><path d="M10 16h4" />
      </svg>
    ),
  },
  {
    title: 'LLM & RAG Systems',
    desc: 'Retrieval-augmented generation pipelines, document Q&A, and LangChain-powered AI apps.',
    sub: 'Inquire about LLM development',
    icon: (
      <svg className="h-12 w-12 text-lav" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M4 20h16M4 4l7.5 7.5" /><path d="M14.5 12.5l5 5" />
      </svg>
    ),
  },
  {
    title: 'Full-Stack AI Apps',
    desc: 'Production-ready web applications powered by AI — React frontend, FastAPI backend, deployed on cloud.',
    sub: 'Learn about full-stack AI',
    icon: (
      <svg className="h-12 w-12 text-lav" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M12 12c2.5 0 4.5-2 4.5-4.5S14.5 3 12 3 7.5 5 7.5 7.5 9.5 12 12 12zM19 21v-2c0-2.5-5-3.9-7-4s-7 1.5-7 4v2" />
        <path d="M15 9h6v6" />
      </svg>
    ),
  },
]

function TiltCard({ children, className, style }) {
  const ref = useRef(null)
  const rafPending = useRef(false)

  const handleMouseMove = (e) => {
    if (rafPending.current) return
    rafPending.current = true
    requestAnimationFrame(() => {
      rafPending.current = false
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width - 0.5
      const y = (e.clientY - rect.top) / rect.height - 0.5
      el.style.transform = `perspective(600px) rotateX(${-y * 10}deg) rotateY(${x * 10}deg) scale(1.02)`
    })
  }

  const handleMouseLeave = () => {
    if (ref.current) ref.current.style.transform = 'perspective(600px) rotateX(0) rotateY(0) scale(1)'
  }

  return (
    <div
      ref={ref}
      className={className}
      style={{ ...style, willChange: 'transform', transform: 'perspective(600px) rotateX(0) rotateY(0) scale(1)', transition: 'opacity 0.5s, transform 0.12s ease-out' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </div>
  )
}

export default function Services() {
  const [visible, setVisible] = useState(false)
  const [selectedService, setSelectedService] = useState(null)
  const sectionRef = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.15 }
    )
    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <section id="services" ref={sectionRef} className="relative py-24 px-6">
        <div className="max-w-6xl mx-auto">

          <div className={`mb-14 text-center transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <p className="text-xs uppercase text-lav mb-3 tracking-[0.25em] font-extrabold">What I do</p>
            <h2 className="text-4xl md:text-5xl font-black mb-5 tracking-tight">
              My <span className="text-clay-gradient">Services</span>
            </h2>
            <p className="text-lg text-muted max-w-2xl mx-auto leading-relaxed">
              From training deep learning models to deploying full-stack AI systems — I build end-to-end
              solutions that work in production, not just in notebooks.
            </p>
            <a
              href="mailto:igntayyab@gmail.com"
              className="clay-btn clay-btn-primary mt-7 px-7 py-3 text-sm"
            >
              Start Your Project
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {services.map((service, i) => (
              <TiltCard
                key={service.title}
                className={`clay p-7 group flex flex-col ${
                  visible ? 'opacity-100' : 'opacity-0'
                }`}
                style={{ transitionDelay: `${i * 120}ms` }}
              >
                <div className="clay-tile w-16 h-16 mb-5">{service.icon}</div>
                <h3 className="text-xl font-extrabold mb-2 text-cream">{service.title}</h3>
                <p className="text-muted mb-4 flex-1 leading-relaxed">{service.desc}</p>
                <div className="text-sm text-lav/80 font-bold mb-4">{service.sub}</div>
                <button
                  onClick={() => setSelectedService(service)}
                  className="text-cream/80 hover:text-lav text-sm font-extrabold flex items-center gap-1 group-hover:gap-2 transition-all duration-200 w-fit"
                >
                  Read more <span>→</span>
                </button>
              </TiltCard>
            ))}
          </div>

        </div>
      </section>

      <ServicePanel service={selectedService} onClose={() => setSelectedService(null)} />
    </>
  )
}
