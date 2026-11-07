import { useEffect, useRef, useState } from 'react'

const DURATIONS = { fast: 500, base: 700, slow: 900 }

export default function Reveal({
  children,
  variant = 'up',
  delay = 0,
  duration = 'base',
  threshold = 0.15,
  rootMargin = '0px 0px -10% 0px',
  once = true,
  className = '',
  style,
  ...rest
}) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined')

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          if (once) obs.disconnect()
        } else if (!once) {
          setVisible(false)
        }
      },
      { threshold, rootMargin }
    )

    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold, rootMargin, once])

  const ms = typeof duration === 'number' ? duration : (DURATIONS[duration] ?? DURATIONS.base)

  return (
    <div
      ref={ref}
      data-variant={variant}
      className={`reveal ${visible ? 'is-visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms`, transitionDuration: `${ms}ms`, ...style }}
      {...rest}
    >
      {children}
    </div>
  )
}
