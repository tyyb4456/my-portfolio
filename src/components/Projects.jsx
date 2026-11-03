import { useEffect, useRef, useState, useCallback } from 'react'

const projects = [
  {
    id: 'wellai',
    title: 'WellAI – AI Health Assistant',
    tech: 'Python · LangChain · FastAPI · React · RAG',
    img: 'pexels-cottonbro-6153354.webp',
    fallback: 'pexels-cottonbro-6153354.jpg',
    url: 'https://github.com/igntayyab',
  },
  {
    id: 'pneumonia',
    title: 'Pneumonia & Disease Detection',
    tech: 'TensorFlow · Keras · CNN · Transfer Learning',
    img: 'pexels-pavel-danilyuk-8438923.webp',
    fallback: 'pexels-pavel-danilyuk-8438923.jpg',
    url: 'https://github.com/igntayyab',
  },
  {
    id: 'gemma-rag',
    title: 'Gemma RAG System',
    tech: 'Python · LangGraph · LangChain · ChromaDB',
    img: 'pexels-marketingtuig-185576.webp',
    fallback: 'pexels-marketingtuig-185576.jpg',
    url: 'https://github.com/igntayyab',
  },
  {
    id: 'stock-forecast',
    title: 'Stock Price Forecasting',
    tech: 'Python · LSTM · Scikit-learn · Time Series',
    img: 'pexels-ron-lach-9783353.webp',
    fallback: 'pexels-ron-lach-9783353.jpg',
    url: 'https://github.com/igntayyab',
  },
  {
    id: 'heart-disease',
    title: 'Heart Disease & Bank Churn',
    tech: 'Scikit-learn · XGBoost · SHAP',
    img: 'pexels-shvetsa-4226215.webp',
    fallback: 'pexels-shvetsa-4226215.jpg',
    url: 'https://github.com/igntayyab',
  },
  {
    id: 'sales-app',
    title: 'Sales Management App',
    tech: 'React · FastAPI · REST API',
    img: 'pexels-thisisengineering-3913031.webp',
    fallback: 'pexels-thisisengineering-3913031.jpg',
    url: 'https://github.com/igntayyab',
  },
]

function LazyImage({ img, fallback, alt }) {
  const [loaded, setLoaded] = useState(false)
  const [inView, setInView] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect() } },
      { rootMargin: '300px' }
    )
    if (wrapRef.current) observer.observe(wrapRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={wrapRef} className="absolute inset-0">
      {!loaded && <div className="absolute inset-0 bg-gray-800 animate-pulse" />}
      {inView && (
        <picture>
          <source srcSet={img} type="image/webp" />
          <img
            src={fallback}
            alt={alt}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            className={`w-full h-full object-cover transition-opacity duration-300 group-hover:scale-105 transition-transform duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />
        </picture>
      )}
    </div>
  )
}

function TiltCard({ project, visible, delay, onClick }) {
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
      el.style.transform = `perspective(800px) rotateX(${-y * 10}deg) rotateY(${x * 10}deg) translateY(-4px)`
    })
  }

  const handleMouseLeave = () => {
    if (ref.current) ref.current.style.transform = 'perspective(800px) rotateX(0) rotateY(0) translateY(0)'
  }

  return (
    <div
      ref={ref}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`group cursor-pointer transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}
      style={{
        transitionDelay: `${delay}ms`,
        willChange: 'transform',
        transform: 'perspective(800px) rotateX(0) rotateY(0)',
      }}
    >
      <div className="clay p-3">
        <div className="relative overflow-hidden clay-inset rounded-[1.4rem] aspect-video">
          <LazyImage img={project.img} fallback={project.fallback} alt={project.title} />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300" />
          <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#12121a]/95 via-[#12121a]/60 to-transparent translate-y-2 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
            <h3 className="text-cream text-lg font-extrabold mb-0.5">{project.title}</h3>
            <p className="text-lav text-xs font-bold">{project.tech}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Projects() {
  const [visible, setVisible] = useState(false)
  const sectionRef = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.05 }
    )
    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  const handleClick = useCallback((url) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [])

  return (
    <section id="projects" ref={sectionRef} className="relative px-6 pb-28 pt-16 overflow-hidden">

      {/* Dot grid — matches other sections */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.05]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className={`relative text-center mb-16 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <p className="text-xs uppercase text-lav mb-3 tracking-[0.25em] font-extrabold">Selected projects</p>
        <h2 className="text-5xl md:text-6xl font-black text-cream mb-6 tracking-tight">
          Featured <span className="text-clay-gradient">Work</span>
        </h2>
        <div className="h-1.5 rounded-full bg-linear-to-r from-lav to-sky mx-auto transition-all duration-700 delay-300" style={{ width: visible ? '90px' : '0px' }} />
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project, i) => (
          <TiltCard
            key={project.id}
            project={project}
            visible={visible}
            delay={i * 80}
            onClick={() => handleClick(project.url)}
          />
        ))}
      </div>

    </section>
  )
}
