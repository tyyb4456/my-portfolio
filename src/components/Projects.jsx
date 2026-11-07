import { useEffect, useRef, useState } from 'react'
import Reveal from './Reveal'

const projects = [
  {
    id: 'wellai',
    title: 'WellAI – AI Health Assistant',
    tech: 'Python · LangChain · FastAPI · React · RAG',
    desc: 'A retrieval-augmented health assistant that answers questions over medical documents with grounded, personalised guidance. Recognised at a competitive hackathon demo.',
    img: 'pexels-cottonbro-6153354.webp',
    fallback: 'pexels-cottonbro-6153354.jpg',
    url: 'https://github.com/igntayyab',
  },
  {
    id: 'pneumonia',
    title: 'Pneumonia & Disease Detection',
    tech: 'TensorFlow · Keras · CNN · Transfer Learning',
    desc: 'Medical imaging and agricultural disease classifiers built with transfer learning and augmentation, reaching 90%+ test accuracy on real-world datasets.',
    img: 'pexels-pavel-danilyuk-8438923.webp',
    fallback: 'pexels-pavel-danilyuk-8438923.jpg',
    url: 'https://github.com/igntayyab',
  },
  {
    id: 'gemma-rag',
    title: 'Gemma RAG System',
    tech: 'Python · LangGraph · LangChain · ChromaDB',
    desc: 'A modular RAG pipeline powered by Gemma for document-based Q&A, with optimised chunking, retrieval and citation-aware responses.',
    img: 'pexels-marketingtuig-185576.webp',
    fallback: 'pexels-marketingtuig-185576.jpg',
    url: 'https://github.com/igntayyab',
  },
  {
    id: 'stock-forecast',
    title: 'Stock Price Forecasting',
    tech: 'Python · LSTM · Scikit-learn · Time Series',
    desc: 'LSTM and ensemble-based forecasting on Google, Meta and NVIDIA stock data, benchmarked against competitive RMSE baselines.',
    img: 'pexels-ron-lach-9783353.webp',
    fallback: 'pexels-ron-lach-9783353.jpg',
    url: 'https://github.com/igntayyab',
  },
  {
    id: 'heart-disease',
    title: 'Heart Disease & Bank Churn',
    tech: 'Scikit-learn · XGBoost · SHAP',
    desc: 'Gradient-boosted predictive models with SHAP explainability, hitting 87% AUC on bank churn and supporting transparent medical risk analysis.',
    img: 'pexels-shvetsa-4226215.webp',
    fallback: 'pexels-shvetsa-4226215.jpg',
    url: 'https://github.com/igntayyab',
  },
  {
    id: 'sales-app',
    title: 'Sales Management App',
    tech: 'React · FastAPI · REST API',
    desc: 'A full-stack production app actively used by local SMBs for inventory tracking, sales operations and real-time analytics.',
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
      {!loaded && <div className="absolute inset-0 bg-[var(--skeleton)] animate-pulse" />}
      {inView && (
        <picture>
          <source srcSet={img} type="image/webp" />
          <img
            src={fallback}
            alt={alt}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            className={`w-full h-full object-cover transition-[opacity,transform] duration-500 ease-out group-hover:scale-105 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />
        </picture>
      )}
    </div>
  )
}

function ProjectCard({ project, index }) {
  const reverse = index % 2 === 1
  const number = String(index + 1).padStart(2, '0')

  return (
    <Reveal
      variant={reverse ? 'right' : 'left'}
      duration="slow"
      className="md:sticky"
      style={{ top: `calc(6rem + ${index * 2}rem)`, zIndex: index + 1 }}
    >
      <article className="clay group overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2">

          {/* Visual */}
          <div className={`relative min-h-[260px] sm:min-h-[300px] md:min-h-[420px] ${reverse ? 'md:order-2' : ''}`}>
            <LazyImage img={project.img} fallback={project.fallback} alt={project.title} />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--media-fade)] via-transparent to-transparent" />
            <span className="absolute top-6 left-6 clay-pill px-3 py-1.5 text-[11px] font-bold tracking-[0.2em] text-cream-soft">
              {number}
            </span>
          </div>

          {/* Content */}
          <div className="relative flex flex-col justify-center p-7 sm:p-9 md:p-10 lg:p-12">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -top-8 right-5 text-[110px] sm:text-[150px] font-black leading-none text-[var(--watermark)] select-none"
            >
              {number}
            </span>

            <div className="relative flex items-center gap-3 mb-4">
              <span className="h-px w-8 bg-lav/60" />
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-lav">
                Project {number}
              </p>
            </div>

            <h3 className="relative text-2xl sm:text-3xl lg:text-4xl font-black text-cream leading-tight tracking-tight">
              {project.title}
            </h3>
            <p className="relative mt-3 text-xs font-bold tracking-wide text-lav/80">{project.tech}</p>
            <p className="relative mt-5 text-muted leading-relaxed">{project.desc}</p>

            <a
              href={project.url}
              target="_blank"
              rel="noreferrer"
              className="clay-btn mt-7 px-6 py-3 text-sm w-fit"
            >
              View project
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6l6 6-6 6" />
              </svg>
            </a>
          </div>

        </div>
      </article>
    </Reveal>
  )
}

export default function Projects() {
  return (
    <section id="projects" className="relative px-6 pb-28 pt-16">

      {/* Dot grid — matches other sections */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.05]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, var(--dot) 1px, transparent 0)',
          backgroundSize: '48px 48px',
        }}
      />

      <Reveal variant="up" className="relative text-center mb-16 md:mb-20">
        <p className="text-xs uppercase text-lav mb-3 tracking-[0.25em] font-extrabold">Selected projects</p>
        <h2 className="text-5xl md:text-6xl font-black text-cream mb-6 tracking-tight">
          Featured <span className="text-clay-gradient">Work</span>
        </h2>
        <div className="h-1.5 rounded-full bg-linear-to-r from-lav to-sky mx-auto w-[90px]" />
      </Reveal>

      <div className="relative max-w-6xl mx-auto space-y-16 md:space-y-24">
        {projects.map((project, i) => (
          <ProjectCard key={project.id} project={project} index={i} />
        ))}
      </div>

    </section>
  )
}
