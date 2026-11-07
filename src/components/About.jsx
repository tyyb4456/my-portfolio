import Reveal from './Reveal'

export default function About() {
  return (
    <section
      id="about"
      className="relative px-6 md:px-16 py-24 overflow-hidden"
    >
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-10 items-center">

        {/* Text */}
        <Reveal variant="left" className="md:col-span-3">
          <div className="clay p-7 md:p-10">
            <p className="text-xs uppercase text-lav mb-3 tracking-[0.25em] font-extrabold">Who I am</p>
            <h2 className="text-4xl md:text-5xl font-black mb-5 tracking-tight">
              About <span className="text-clay-gradient">Me</span>
            </h2>
            <p className="text-xs uppercase text-muted mb-5 tracking-widest font-bold">
              AI Engineer | ML &amp; Full-Stack AI Systems
            </p>
            <p className="text-muted leading-relaxed">
              I'm Tayyab Hussain, an AI Engineer and IT undergraduate at Bahauddin Zakariya University (CGPA: 3.40),
              based in Multan, Pakistan. I specialize in building production-ready ML pipelines, RAG systems,
              and full-stack AI applications using Python, TensorFlow, PyTorch, LangChain, FastAPI, and React.
              <br /><br />
              I'm a Kaggle Master ranked in the global top tier, and a 2nd place finisher in an International AI
              Hackathon against 50+ teams. My focus is delivering end-to-end AI solutions — from model training
              to live deployment.
            </p>
            <p className="mt-4 text-cream-soft italic font-semibold">
              Interested in building something with AI?
            </p>
            <a href="#contact" className="clay-btn mt-6 px-6 py-3 text-sm">
              Contact Me
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6l6 6-6 6" />
              </svg>
            </a>
          </div>
        </Reveal>

        {/* Image */}
        <Reveal variant="right" delay={150} className="md:col-span-2 flex justify-center">
          <div className="relative">
            <div className="clay-lg p-4 rotate-2 hover:rotate-0 transition-transform duration-500">
              <img
                src="1118a52b-a8fd-4b47-8042-f18d7b520be1.webp"
                alt="Tayyab Hussain"
                className="w-64 h-72 md:w-72 md:h-80 object-cover rounded-[2rem]"
              />
            </div>

            <Reveal variant="scale" delay={400} className="absolute -bottom-5 -left-4 md:-left-8">
              <div className="clay-sm px-4 py-3 animate-float">
                <p className="text-sm font-black text-cream">Kaggle Master</p>
                <p className="text-[10px] uppercase tracking-widest text-muted font-bold">Global top tier</p>
              </div>
            </Reveal>

            <Reveal variant="scale" delay={550} className="absolute -top-5 -right-3 md:-right-6">
              <div className="clay-sm px-4 py-3 animate-float-slow">
                <p className="text-sm font-black text-clay-gradient">2nd Place</p>
                <p className="text-[10px] uppercase tracking-widest text-muted font-bold">Intl. AI Hackathon</p>
              </div>
            </Reveal>
          </div>
        </Reveal>

      </div>
    </section>
  )
}
