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
        className={`relative ml-auto w-full max-w-3xl h-full bg-[#0a0a0a] border-l border-white/10 flex flex-col transition-transform duration-500 ease-out ${mounted ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500/70" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <span className="w-3 h-3 rounded-full bg-green-500/70" />
            </div>
            <span className="text-white/30 text-xs ml-2 tracking-widest uppercase">tayyab.profile</span>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors duration-200 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Header */}
        <div className="px-8 py-7 border-b border-white/10 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold text-white tracking-tight">Tayyab Hussain</h2>
              <p className="text-white/50 text-sm mt-1 tracking-wide">AI Engineer · ML Systems · Full-Stack AI</p>
              <div className="flex flex-wrap gap-2 mt-4">
                {['Python', 'TensorFlow', 'LangChain', 'FastAPI', 'React'].map(tag => (
                  <span key={tag} className="px-2.5 py-0.5 text-xs border border-white/20 text-white/60 rounded-full tracking-wide">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-white/30 text-xs">BZU, Multan</p>
              <p className="text-white/30 text-xs mt-0.5">CGPA 3.40</p>
              <p className="text-white/30 text-xs mt-0.5">2022 – 2026</p>
            </div>
          </div>

          {/* Contact row */}
          <div className="flex flex-wrap gap-4 mt-5 text-xs text-white/40">
            <a href="mailto:igntayyab@gmail.com" className="hover:text-white/80 transition-colors">igntayyab@gmail.com</a>
            <span className="text-white/20">·</span>
            <a href="https://github.com/igntayyab" target="_blank" rel="noreferrer" className="hover:text-white/80 transition-colors">github.com/igntayyab</a>
            <span className="text-white/20">·</span>
            <span>+92 340 432 8229</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 px-8 shrink-0">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 mr-6 text-xs tracking-widest uppercase transition-all duration-200 border-b-2 ${
                activeTab === tab
                  ? 'text-white border-white'
                  : 'text-white/30 border-transparent hover:text-white/60'
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
                  <h3 className="text-white font-bold text-base">{job.role}</h3>
                  <p className="text-white/40 text-xs mt-0.5">{job.company}</p>
                </div>
                <span className="text-white/30 text-xs shrink-0 ml-4">{job.period}</span>
              </div>
              <ul className="space-y-3">
                {job.points.map((pt, j) => (
                  <li key={j} className="flex gap-3 text-sm text-white/60 leading-relaxed">
                    <span className="text-white/20 shrink-0 mt-0.5">→</span>
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
                <div key={i} className="border border-white/10 rounded-lg p-5 hover:border-white/25 transition-colors duration-200 group">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-white text-sm font-semibold group-hover:text-white transition-colors">{p.name}</h3>
                  </div>
                  <p className="text-white/30 text-xs mb-3 tracking-wide">{p.stack}</p>
                  <p className="text-white/55 text-xs leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>
          )}

          {/* SKILLS */}
          {activeTab === 'skills' && (
            <div className="space-y-6">
              {Object.entries(skills).map(([category, items]) => (
                <div key={category}>
                  <p className="text-white/30 text-xs tracking-widest uppercase mb-3">{category}</p>
                  <div className="flex flex-wrap gap-2">
                    {items.map(skill => (
                      <span key={skill} className="px-3 py-1 text-xs bg-white/5 border border-white/10 text-white/70 rounded hover:bg-white/10 hover:text-white transition-all duration-200">
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
                <div key={i} className="flex gap-5 border-l-2 border-white/20 pl-5 hover:border-white/50 transition-colors duration-200">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-white text-sm font-semibold">{a.title}</h3>
                      <span className="text-white/30 text-xs">{a.year}</span>
                    </div>
                    <p className="text-white/50 text-xs leading-relaxed">{a.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Bottom CTA */}
        <div className="px-8 py-5 border-t border-white/10 shrink-0 flex items-center justify-between">
          <p className="text-white/25 text-xs tracking-wide">Open to freelance & full-time opportunities</p>
          <a
            href="mailto:igntayyab@gmail.com"
            className="px-4 py-2 text-xs bg-white text-black font-semibold rounded hover:bg-gray-200 transition-colors duration-200"
          >
            Get in Touch →
          </a>
        </div>
      </div>
    </div>
  )
}