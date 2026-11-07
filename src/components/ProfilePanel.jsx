import { useEffect, useState } from 'react'

const experience = [
  {
    role: 'Machine Learning Engineer',
    company: 'Freelance — Independent Remote',
    period: '2023 – Present',
    points: [
      'Designed end-to-end ML pipelines: preprocessing, feature engineering, cross-validation, hyperparameter tuning',
      'Built TensorFlow/Keras models for medical imaging & agricultural disease detection — 90%+ test accuracy',
      'Developed RAG pipelines with LangChain + LangGraph backed by vector databases for document Q&A',
      'Implemented CNN & transformer architectures for image classification and segmentation',
      'Deployed a REST API-backed sales management system using React + FastAPI with real-time analytics',
      'Delivered 6+ AI prototypes in 24–48hr hackathon sprints — placed 2nd against 50+ international teams',
    ],
  },
]

const projects = [
  { name: 'WellAI – AI Health Assistant', stack: 'Python · LangChain · FastAPI · React · RAG', desc: 'RAG system for personalized health guidance over medical documents. Recognized at competitive hackathon demo.' },
  { name: 'Pneumonia & Disease Detection', stack: 'TensorFlow · Keras · CNN · Transfer Learning', desc: '90%+ test accuracy on medical imaging and agricultural datasets using transfer learning and data augmentation.' },
  { name: 'Gemma RAG System', stack: 'Python · LangGraph · LangChain · ChromaDB', desc: 'Modular RAG pipeline using Gemma LLM for document-based Q&A with optimized chunking and retrieval.' },
  { name: 'Stock Price Forecasting', stack: 'Python · LSTM · Scikit-learn · Time Series', desc: 'LSTM + ensemble forecasting on Google, Meta & NVIDIA stocks with competitive RMSE benchmarks.' },
  { name: 'Heart Disease & Bank Churn', stack: 'Scikit-learn · XGBoost · SHAP', desc: '87% AUC on bank churn using gradient boosting with SHAP explainability analysis.' },
  { name: 'Sales Management App', stack: 'React · FastAPI · REST API', desc: 'Full-stack production app actively used by local SMBs for inventory tracking and sales operations.' },
]

const skills = {
  'Languages': ['Python (Advanced)', 'JavaScript', 'SQL', 'C++'],
  'ML / DL': ['TensorFlow', 'PyTorch', 'Scikit-learn', 'XGBoost', 'Keras', 'OpenCV', 'HuggingFace'],
  'LLMs & AI': ['LangChain', 'LangGraph', 'RAG Systems', 'Pinecone', 'ChromaDB', 'Prompt Engineering'],
  'Web & DevOps': ['FastAPI', 'React', 'REST API', 'Docker', 'Azure', 'Git'],
}

const achievements = [
  { title: 'Kaggle Master', year: '2024', desc: 'Global top tier for contributions across EDA, ML, and deep learning.' },
  { title: '2nd Place – International AI Hackathon', year: '2024', desc: 'Competed against 50+ teams. Recognized for technical depth and end-to-end AI delivery.' },
  { title: 'Live Production Deployment', year: '2025', desc: 'Sales management app actively used by local SMBs for daily operations.' },
]

export default function ProfilePanel({ open, onClose }) {
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState('experience')

  useEffect(() => {
    if (open) {
      setTimeout(() => setMounted(true), 10)
      document.body.style.overflow = 'hidden'
    } else {
      setMounted(false)
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!open) return null

  const tabs = ['experience', 'projects', 'skills', 'achievements']

  return (
    <div className="fixed inset-0 z-100 flex">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-500 ${mounted ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`relative ml-auto w-full max-w-3xl h-full bg-[var(--panel-bg)] border-l border-[var(--line)] shadow-[var(--panel-shadow)] flex flex-col transition-transform duration-500 ease-out ${mounted ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-[var(--line)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500/70" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <span className="w-3 h-3 rounded-full bg-green-500/70" />
            </div>
            <span className="text-muted text-xs ml-2 tracking-widest uppercase">tayyab.profile</span>
          </div>
          <button
            onClick={onClose}
            className="clay-tile w-9 h-9 rounded-full text-muted hover:text-cream text-sm leading-none"
          >
            ✕
          </button>
        </div>

        {/* Header */}
        <div className="px-8 py-7 border-b border-[var(--line)] shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-3xl font-black text-cream tracking-tight">Tayyab Hussain</h2>
              <p className="text-muted text-sm mt-1 tracking-wide">AI Engineer · ML Systems · Full-Stack AI</p>
              <div className="flex flex-wrap gap-2 mt-4">
                {['Python', 'TensorFlow', 'LangChain', 'FastAPI', 'React'].map(tag => (
                  <span key={tag} className="clay-pill px-3 py-1 text-xs text-lav font-bold tracking-wide">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-muted text-xs">BZU, Multan</p>
              <p className="text-muted text-xs mt-0.5">CGPA 3.40</p>
              <p className="text-muted text-xs mt-0.5">2022 – 2026</p>
            </div>
          </div>

          {/* Contact row */}
          <div className="flex flex-wrap gap-4 mt-5 text-xs text-muted">
            <a href="mailto:igntayyab@gmail.com" className="hover:text-lav transition-colors">igntayyab@gmail.com</a>
            <span className="text-[var(--line-strong)]">·</span>
            <a href="https://github.com/igntayyab" target="_blank" rel="noreferrer" className="hover:text-lav transition-colors">github.com/igntayyab</a>
            <span className="text-[var(--line-strong)]">·</span>
            <span>+92 340 432 8229</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--line)] px-8 shrink-0">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 mr-6 text-xs font-bold tracking-widest uppercase transition-all duration-200 border-b-2 ${
                activeTab === tab
                  ? 'text-lav border-lav'
                  : 'text-muted border-transparent hover:text-cream'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-8 py-7 space-y-6 scrollbar-thin">

          {/* EXPERIENCE */}
          {activeTab === 'experience' && experience.map((job, i) => (
            <div key={i}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-cream font-extrabold text-base">{job.role}</h3>
                  <p className="text-muted text-xs mt-0.5">{job.company}</p>
                </div>
                <span className="text-lav text-xs shrink-0 ml-4">{job.period}</span>
              </div>
              <ul className="space-y-3">
                {job.points.map((pt, j) => (
                  <li key={j} className="flex gap-3 text-sm text-muted leading-relaxed">
                    <span className="text-lav/50 shrink-0 mt-0.5">→</span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* PROJECTS */}
          {activeTab === 'projects' && (
            <div className="space-y-4">
              {projects.map((p, i) => (
                <div key={i} className="clay-sm p-5 transition-all duration-300 group hover:-translate-y-1">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-cream text-sm font-extrabold group-hover:text-lav transition-colors">{p.name}</h3>
                  </div>
                  <p className="text-lav/70 text-xs mb-3 tracking-wide font-bold">{p.stack}</p>
                  <p className="text-muted text-xs leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>
          )}

          {/* SKILLS */}
          {activeTab === 'skills' && (
            <div className="space-y-6">
              {Object.entries(skills).map(([category, items]) => (
                <div key={category}>
                  <p className="text-lav text-xs tracking-widest uppercase mb-3 font-bold">{category}</p>
                  <div className="flex flex-wrap gap-2">
                    {items.map(skill => (
                      <span key={skill} className="clay-pill px-3 py-1.5 text-xs text-cream-soft font-semibold hover:text-lav transition-all duration-200">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ACHIEVEMENTS */}
          {activeTab === 'achievements' && (
            <div className="space-y-5">
              {achievements.map((a, i) => (
                <div key={i} className="flex gap-5 clay-sm p-5 hover:-translate-y-1 transition-transform duration-300">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-cream text-sm font-extrabold">{a.title}</h3>
                      <span className="text-lav text-xs font-bold">{a.year}</span>
                    </div>
                    <p className="text-muted text-xs leading-relaxed">{a.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Bottom CTA */}
        <div className="px-8 py-5 border-t border-[var(--line)] shrink-0 flex items-center justify-between">
          <p className="text-muted text-xs tracking-wide">Open to freelance &amp; full-time opportunities</p>
          <a
            href="mailto:igntayyab@gmail.com"
            className="clay-btn clay-btn-primary px-5 py-2.5 text-xs"
          >
            Get in Touch →
          </a>
        </div>
      </div>
    </div>
  )
}