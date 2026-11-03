import { useEffect, useState } from 'react'

const serviceDetails = {
  'ML & Deep Learning': {
    tagline: 'From raw data to production models — end-to-end.',
    overview: `I build machine learning systems that solve real problems. Whether it's training a computer vision model to detect disease in medical scans or building a forecasting pipeline for business data — I handle the full lifecycle from data preprocessing to deployment.`,
    whatYouGet: [
      'Clean, documented ML codebase you actually own',
      'Model accuracy reports with evaluation metrics',
      'REST API endpoint to serve predictions',
      'Deployed on your infrastructure (cloud or local)',
      'Post-delivery support and iteration',
    ],
    process: [
      {
        step: '01',
        title: 'Discovery Call',
        desc: 'We discuss your problem, data availability, success metrics, and timeline. I tell you exactly what\'s feasible.',
      },
      {
        step: '02',
        title: 'Data Audit & Prep',
        desc: 'I analyze your dataset, handle missing values, engineer features, and prepare training/validation splits.',
      },
      {
        step: '03',
        title: 'Model Development',
        desc: 'I train and iterate on models — from classical ML to deep learning — using cross-validation and hyperparameter tuning.',
      },
      {
        step: '04',
        title: 'Evaluation & Explainability',
        desc: 'Full performance report with accuracy, AUC, confusion matrix, and SHAP explainability where relevant.',
      },
      {
        step: '05',
        title: 'Deployment',
        desc: 'Model wrapped in a FastAPI endpoint, containerized with Docker, and deployed to your environment.',
      },
      {
        step: '06',
        title: 'Handoff & Support',
        desc: 'Full documentation, code walkthrough, and 2 weeks of post-delivery support.',
      },
    ],
    stack: ['Python', 'TensorFlow', 'PyTorch', 'Scikit-learn', 'XGBoost', 'Keras', 'OpenCV', 'NumPy', 'Pandas', 'FastAPI', 'Docker'],
    useCases: ['Medical imaging diagnosis', 'Agricultural disease detection', 'Fraud detection', 'Churn prediction', 'Stock forecasting'],
  },

  'LLM & RAG Systems': {
    tagline: 'Make your documents talk. Build AI that knows your data.',
    overview: `I build retrieval-augmented generation (RAG) pipelines that let users have intelligent conversations with their own data — PDFs, databases, knowledge bases, anything. Using LangChain, LangGraph, and vector databases, I create LLM-powered apps that are accurate, fast, and hallucination-resistant.`,
    whatYouGet: [
      'Fully functional RAG pipeline with your data',
      'Vector database setup and optimized chunking strategy',
      'Chat interface or API endpoint (your choice)',
      'Hallucination-minimized responses with source citations',
      'Scalable architecture for growing document sets',
    ],
    process: [
      {
        step: '01',
        title: 'Use Case Definition',
        desc: 'We define what your AI should know, how users will query it, and what "correct" responses look like.',
      },
      {
        step: '02',
        title: 'Data Ingestion & Chunking',
        desc: 'Documents are loaded, cleaned, chunked optimally, and embedded into a vector database (Pinecone or ChromaDB).',
      },
      {
        step: '03',
        title: 'Retrieval Pipeline',
        desc: 'I build the retrieval logic — semantic search, re-ranking, hybrid search — tuned for your use case.',
      },
      {
        step: '04',
        title: 'LLM Integration',
        desc: 'Connect retrieval to the LLM (Gemma, GPT, Claude, etc.) with carefully engineered prompts and context windows.',
      },
      {
        step: '05',
        title: 'Testing & Accuracy Tuning',
        desc: 'Evaluate response quality, reduce hallucinations, and tune chunking/retrieval parameters.',
      },
      {
        step: '06',
        title: 'Deployment & API',
        desc: 'Ship as a FastAPI backend with React chat UI, or a standalone API for your existing product.',
      },
    ],
    stack: ['Python', 'LangChain', 'LangGraph', 'ChromaDB', 'Pinecone', 'HuggingFace', 'FastAPI', 'React', 'Docker', 'Prompt Engineering'],
    useCases: ['Document Q&A systems', 'Internal knowledge bases', 'AI customer support', 'Legal/medical document search', 'Research assistants'],
  },

  'Full-Stack AI Apps': {
    tagline: 'AI with a real interface. From model to market.',
    overview: `I build complete web applications where AI is the core product — not a bolt-on. React frontend, FastAPI backend, and an AI brain in the middle. I've shipped production apps used by real businesses, built hackathon prototypes in 24 hours, and everything in between.`,
    whatYouGet: [
      'Complete web app — frontend, backend, and AI layer',
      'Clean React UI with responsive design',
      'FastAPI backend with REST endpoints',
      'Live deployment on cloud (Azure or your platform)',
      'Authentication, logging, and error handling included',
    ],
    process: [
      {
        step: '01',
        title: 'Scope & Architecture',
        desc: 'We map out the full app — what it does, who uses it, what the AI component is, and the tech stack.',
      },
      {
        step: '02',
        title: 'Backend & AI Core',
        desc: 'FastAPI server built first — endpoints, database schema, AI model integration, and business logic.',
      },
      {
        step: '03',
        title: 'Frontend Development',
        desc: 'React UI built to match your needs — dashboards, chat interfaces, forms, data visualizations.',
      },
      {
        step: '04',
        title: 'Integration & Testing',
        desc: 'Frontend and backend wired together, tested end-to-end, edge cases handled, performance optimized.',
      },
      {
        step: '05',
        title: 'Deployment',
        desc: 'Dockerized and deployed to Azure or your preferred cloud. CI/CD pipeline set up if needed.',
      },
      {
        step: '06',
        title: 'Handoff',
        desc: 'Full documentation, recorded walkthrough, source code, and post-launch support window.',
      },
    ],
    stack: ['React', 'FastAPI', 'Python', 'REST API', 'Docker', 'Azure', 'TailwindCSS', 'PostgreSQL', 'LangChain'],
    useCases: ['AI health assistants', 'Sales/inventory management', 'AI content tools', 'Business dashboards', 'Customer-facing chatbots'],
  },
}

export default function ServicePanel({ service, onClose }) {
  const [mounted, setMounted] = useState(false)
  const open = !!service
  const data = service ? serviceDetails[service.title] : null

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

  if (!open || !data) return null

  return (
    <div className="fixed inset-0 z-100 flex">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity duration-500 ${mounted ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`relative ml-auto w-full max-w-2xl h-full bg-[#0a0a0a] border-l border-white/10 flex flex-col overflow-hidden transition-transform duration-500 ease-out ${mounted ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500/70" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <span className="w-3 h-3 rounded-full bg-green-500/70" />
            </div>
            <span className="text-white/30 text-xs ml-2 tracking-widest uppercase font-mono">service.details</span>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors duration-200 text-xl">✕</button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* Hero block */}
          <div className="px-8 py-8 border-b border-white/10">
            <div className="mb-3">{service.icon}</div>
            <h2 className="text-3xl font-black text-white tracking-tight mb-2">{service.title}</h2>
            <p className="text-white/40 text-sm font-mono italic mb-5">{data.tagline}</p>
            <p className="text-white/65 text-sm leading-relaxed">{data.overview}</p>
          </div>

          {/* What you get */}
          <div className="px-8 py-7 border-b border-white/10">
            <h3 className="text-xs text-white/30 uppercase tracking-widest font-mono mb-5">What You Get</h3>
            <ul className="space-y-3">
              {data.whatYouGet.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-white/65">
                  <span className="text-green-400/70 shrink-0 mt-0.5">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Process */}
          <div className="px-8 py-7 border-b border-white/10">
            <h3 className="text-xs text-white/30 uppercase tracking-widest font-mono mb-6">The Process</h3>
            <div className="space-y-5">
              {data.process.map((step, i) => (
                <div key={i} className="flex gap-5 group">
                  <div className="shrink-0 w-8 h-8 rounded-full border border-white/15 flex items-center justify-center group-hover:border-white/40 transition-colors duration-200">
                    <span className="text-white/30 text-xs font-mono group-hover:text-white/60 transition-colors duration-200">{step.step}</span>
                  </div>
                  <div className="pb-5 border-b border-white/5 flex-1 last:border-0 last:pb-0">
                    <p className="text-white text-sm font-semibold mb-1">{step.title}</p>
                    <p className="text-white/50 text-xs leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tech Stack */}
          <div className="px-8 py-7 border-b border-white/10">
            <h3 className="text-xs text-white/30 uppercase tracking-widest font-mono mb-4">Tech Stack</h3>
            <div className="flex flex-wrap gap-2">
              {data.stack.map(tech => (
                <span key={tech} className="px-3 py-1 text-xs bg-white/5 border border-white/10 text-white/60 rounded-full hover:bg-white/10 hover:text-white transition-all duration-200">
                  {tech}
                </span>
              ))}
            </div>
          </div>

          {/* Use Cases */}
          <div className="px-8 py-7">
            <h3 className="text-xs text-white/30 uppercase tracking-widest font-mono mb-4">Common Use Cases</h3>
            <div className="grid grid-cols-1 gap-2">
              {data.useCases.map((uc, i) => (
                <div key={i} className="flex items-center gap-3 text-sm text-white/50">
                  <span className="text-white/20 font-mono">→</span>
                  {uc}
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Bottom CTA */}
        <div className="px-8 py-5 border-t border-white/10 shrink-0 flex items-center justify-between">
          <p className="text-white/25 text-xs font-mono">Ready to start?</p>
          <a
            href="mailto:igntayyab@gmail.com"
            className="px-5 py-2 text-xs bg-white text-black font-bold rounded hover:bg-gray-200 transition-colors duration-200"
          >
            Let's Talk →
          </a>
        </div>
      </div>
    </div>
  )
}