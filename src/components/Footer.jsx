import Reveal from './Reveal'

const socialLinks = [
  {
    label: 'Twitter',
    href: '#',
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
      </svg>
    ),
  },
  {
    label: 'LinkedIn',
    href: 'https://linkedin.com/in/igntayyab',
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  {
    label: 'GitHub',
    href: 'https://github.com/igntayyab',
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
      </svg>
    ),
  },
]

export default function Footer() {
  return (
    <footer className="relative px-6 pb-8 pt-6 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <div className="clay-lg p-8 md:p-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">

            {/* Brand */}
            <Reveal variant="up">
              <h3 className="text-2xl font-black tracking-tight mb-4">
                <span className="text-clay-gradient">tayyab</span>
                <span className="text-muted">.ai</span>
              </h3>
              <p className="text-muted leading-relaxed mb-6 text-sm">
                AI Engineer building production-ready ML systems, RAG pipelines, and full-stack AI applications. Let's build something intelligent together.
              </p>
              <div className="flex space-x-3">
                {socialLinks.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    aria-label={s.label}
                    className="clay-tile w-11 h-11 rounded-full text-muted hover:text-lav transition-all duration-300 hover:-translate-y-1"
                  >
                    {s.icon}
                  </a>
                ))}
              </div>
            </Reveal>

            {/* Quick Links */}
            <Reveal variant="up" delay={120}>
              <h4 className="text-lg font-extrabold text-cream mb-6 tracking-wide">Quick Links</h4>
              <nav className="space-y-4">
                {['About', 'Services', 'Skills', 'Projects'].map((link) => (
                  <a
                    key={link}
                    href={`#${link.toLowerCase()}`}
                    className="group block text-muted hover:text-lav hover:translate-x-2 transition-all duration-300 font-semibold"
                  >
                    {link}
                  </a>
                ))}
              </nav>
            </Reveal>

            {/* Contact */}
            <Reveal variant="up" delay={240}>
              <h4 className="text-lg font-extrabold text-cream mb-6 tracking-wide">Get in Touch</h4>
              <div className="space-y-4">
                <a href="mailto:igntayyab@gmail.com" className="flex items-center space-x-3 text-muted hover:text-lav hover:translate-x-1 transition-all duration-300">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 7.89a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span>igntayyab@gmail.com</span>
                </a>
                <a href="tel:+923404328229" className="flex items-center space-x-3 text-muted hover:text-lav hover:translate-x-1 transition-all duration-300">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span>+92 340 432 8229</span>
                </a>
                <div className="flex items-center space-x-3 text-muted">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Multan, Pakistan</span>
                </div>
              </div>
            </Reveal>

          </div>

          {/* Bottom bar */}
          <Reveal variant="up" delay={360} className="border-t border-[var(--line)] pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-muted-soft text-sm mb-4 md:mb-0">
              © 2025 Tayyab Hussain. All rights reserved.
            </p>
            <div className="flex space-x-6 text-sm">
              <a href="#" className="text-muted-soft hover:text-cream transition-all duration-300">Privacy Policy</a>
              <a href="#" className="text-muted-soft hover:text-cream transition-all duration-300">Terms of Service</a>
            </div>
          </Reveal>
        </div>
      </div>
    </footer>
  )
}