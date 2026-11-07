import { useEffect, useRef, useState } from 'react'
import Reveal from './Reveal'

const skills = [
  { name: 'Python',     icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg',         invert: false },
  { name: 'TensorFlow', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/tensorflow/tensorflow-original.svg', invert: false },
  { name: 'PyTorch',    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/pytorch/pytorch-original.svg',       invert: false },
  { name: 'React',      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg',           invert: false },
  { name: 'FastAPI',    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/fastapi/fastapi-original.svg',       invert: false },
  { name: 'Docker',     icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/docker/docker-original.svg',         invert: false },
  { name: 'Azure',      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/azure/azure-original.svg',           invert: false },
  { name: 'GitHub',     icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-original.svg',         invert: true  },
  { name: 'JavaScript', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg', invert: false },
  { name: 'C++',        icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/cplusplus/cplusplus-original.svg',   invert: false },
]

function SkillCard({ skill, cardRef }) {
  return (
    <div
      ref={cardRef}
      style={{ willChange: 'transform' }}
      className="clay clay-hover group relative flex flex-col items-center justify-center gap-3 p-6 min-h-[160px]"
    >
      <div className="clay-inset w-16 h-16 rounded-2xl flex items-center justify-center">
        <img
          src={skill.icon}
          alt={skill.name}
          loading="lazy"
          className={`relative z-10 w-8 h-8 transition-transform duration-300 group-hover:scale-110 ${skill.invert ? 'icon-invert' : ''}`}
        />
      </div>
      <p className="relative z-10 text-muted text-sm font-extrabold tracking-wide group-hover:text-cream transition-colors duration-300">
        {skill.name}
      </p>
    </div>
  )
}

export default function Skills() {
  const [visible, setVisible] = useState(false)
  const sectionRef = useRef(null)
  const cursorRef  = useRef(null)
  const cardRefs   = useRef([])
  const lerp       = useRef(skills.map(() => ({ rx: 0, ry: 0 })))
  const rafRef     = useRef(null)

  useEffect(() => {
    const LERP = 0.08
    const MAX  = 6

    const loop = () => {
      const cur = cursorRef.current

      for (let i = 0; i < skills.length; i++) {
        const el    = cardRefs.current[i]
        const state = lerp.current[i]
        if (!el) continue

        let tx = 0, ty = 0
        if (cur) {
          const r  = el.getBoundingClientRect()
          const nx = (cur.x - (r.left + r.width  / 2)) / (r.width  / 2)
          const ny = (cur.y - (r.top  + r.height / 2)) / (r.height / 2)
          tx = -Math.max(-1, Math.min(1, ny)) * MAX
          ty =  Math.max(-1, Math.min(1, nx)) * MAX
        }

        state.rx += (tx - state.rx) * LERP
        state.ry += (ty - state.ry) * LERP

        if (!cur && Math.abs(state.rx) < 0.02 && Math.abs(state.ry) < 0.02) {
          if (el.style.transform) el.style.transform = ''
          state.rx = 0; state.ry = 0
          continue
        }

        el.style.transform = `perspective(800px) rotateX(${state.rx.toFixed(2)}deg) rotateY(${state.ry.toFixed(2)}deg)`
      }

      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true) },
      { threshold: 0.1 }
    )
    if (sectionRef.current) obs.observe(sectionRef.current)
    return () => obs.disconnect()
  }, [])

  return (
    <section
      id="skills"
      ref={sectionRef}
      onMouseMove={(e) => { cursorRef.current = { x: e.clientX, y: e.clientY } }}
      onMouseLeave={() => { cursorRef.current = null }}
      className="relative py-24 px-6 md:px-16 overflow-hidden"
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.05]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, var(--dot) 1px, transparent 0)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative max-w-6xl mx-auto">

        <Reveal variant="up" className="text-center mb-16">
          <h2 className="text-5xl md:text-6xl font-black tracking-tight text-cream mb-6">
            My <span className="text-clay-gradient">Skills</span>
          </h2>
          <div className="h-1.5 rounded-full bg-linear-to-r from-lav to-sky mx-auto transition-all duration-700 delay-300" style={{ width: visible ? '90px' : '0px' }} />
        </Reveal>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {skills.map((skill, i) => (
            <Reveal key={skill.name} variant="up" delay={i * 60}>
              <SkillCard
                skill={skill}
                cardRef={(el) => { cardRefs.current[i] = el }}
              />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
