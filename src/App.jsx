import Navbar from './components/Navbar'
import Hero from './components/Hero'
import About from './components/About'
import Skills from './components/Skills'
import Services from './components/Services'
import Projects from './components/Projects'
import Footer from './components/Footer'

export default function App() {
  return (
    <div className="min-h-screen text-cream relative overflow-x-clip">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="clay-blob absolute top-[12%] left-[6%] w-72 h-72 bg-lav/30 animate-float-slow" />
        <div className="clay-blob absolute top-[45%] right-[4%] w-96 h-96 bg-sky/20 animate-float" />
        <div className="clay-blob absolute bottom-[8%] left-[35%] w-80 h-80 bg-coral/15 animate-float-slow" />
      </div>
      <Navbar />
      <Hero />
      <About />
      <Skills />
      <Services />
      <Projects />
      <Footer />
    </div>
  )
}
