import { useState, useEffect } from 'react'

const navLinks = ['About', 'Services', 'Skills', 'Projects']

export default function Navbar() {
  const [hidden, setHidden] = useState(false)
  const [lastScrollY, setLastScrollY] = useState(0)
  const [btnState, setBtnState] = useState('Connect') // 'Connect' | 'Connecting...' | 'Connected!'

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY
      setHidden(currentY > lastScrollY && currentY > 100)
      setLastScrollY(currentY)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [lastScrollY])

  const handleConnect = () => {
    setBtnState('Connecting...')
    setTimeout(() => setBtnState('Connected!'), 150)
    setTimeout(() => setBtnState('Connect'), 2000)
  }

  return (
    <div
      className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-6xl transition-transform duration-500 ease-out ${
        hidden ? '-translate-y-[180%]' : 'translate-y-0'
      }`}
    >
      <nav className="clay-sm flex justify-between items-center gap-4 px-5 py-3 md:px-6">
        {/* Logo */}
        <a href="#hero" className="text-xl font-black tracking-tight group cursor-pointer select-none">
          <span className="text-clay-gradient">tayyab</span>
          <span className="text-muted group-hover:text-cream transition-colors duration-300">.ai</span>
        </a>

        {/* Nav Links */}
        <ul className="hidden md:flex items-center gap-1 clay-inset rounded-full px-2 py-1.5">
          {navLinks.map((link) => (
            <li key={link}>
              <a
                href={`#${link.toLowerCase()}`}
                className="block px-4 py-1.5 rounded-full text-sm font-bold text-muted hover:text-cream hover:bg-white/5 transition-all duration-300"
              >
                {link}
              </a>
            </li>
          ))}
        </ul>

        {/* Connect Button */}
        <button
          onClick={handleConnect}
          className={`clay-btn px-5 py-2 text-sm ${
            btnState === 'Connected!' ? 'clay-btn-primary' : ''
          }`}
        >
          <span
            className={`inline-block w-2 h-2 rounded-full transition-colors duration-300 ${
              btnState === 'Connected!' ? 'bg-emerald-900' : 'bg-mint'
            }`}
          />
          {btnState}
        </button>
      </nav>
    </div>
  )
}
