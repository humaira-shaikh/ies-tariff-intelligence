import { useState, useEffect, useRef } from 'react'
import './landing.css'

export default function LandingPage({ onLaunchApp }) {
  const [scrolled,      setScrolled]      = useState(false)
  const [activeSection, setActiveSection] = useState('hero')
  const [formSent,      setFormSent]      = useState(false)
  const [count,         setCount]         = useState({ policies: 0, states: 0, accuracy: 0, time: 0 })

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Animate counters when stats section is visible
  useEffect(() => {
    const targets = { policies: 11, states: 5, accuracy: 100, time: 98 }
    const duration = 1800
    const steps = 60
    let step = 0
    const timer = setInterval(() => {
      step++
      const progress = Math.min(step / steps, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      setCount({
        policies: Math.round(targets.policies * ease),
        states:   Math.round(targets.states   * ease),
        accuracy: Math.round(targets.accuracy * ease),
        time:     Math.round(targets.time     * ease),
      })
      if (step >= steps) clearInterval(timer)
    }, duration / steps)
    return () => clearInterval(timer)
  }, [])

  const scrollTo = id => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleContact = e => {
    e.preventDefault()
    setFormSent(true)
    setTimeout(() => setFormSent(false), 4000)
  }

  return (
    <div className="gs-body">

      {/* ── NAVBAR ─────────────────────────────────────── */}
      <nav className={`gs-nav ${scrolled ? 'scrolled' : ''}`}>
        {/* Logo — stays left */}
        <div className="gs-logo" onClick={() => scrollTo('hero')}>
          <div className="gs-logo-icon">V</div>
          <span className="gs-logo-text">Volt<span>IQ</span></span>
        </div>

        {/* Everything right-aligned */}
        <div className="gs-nav-right">
          <ul className="gs-nav-links">
            <li>
              <button>Products ▾</button>
              <div className="gs-dropdown">
                <div className="gs-dropdown-label">Modules</div>
                <a onClick={() => onLaunchApp('ti')} style={{cursor:'pointer'}}>Tariff Discovery</a>
                <a onClick={() => onLaunchApp('ti')} style={{cursor:'pointer'}}>Bill Calculator</a>
                <a onClick={() => onLaunchApp('ti')} style={{cursor:'pointer'}}>Policy Generator</a>
              </div>
            </li>
            <li>
              <button>Resources ▾</button>
              <div className="gs-dropdown">
                <div className="gs-dropdown-label">Learn</div>
                <a onClick={() => scrollTo('resources')} style={{cursor:'pointer'}}>Documentation</a>
                <a onClick={() => scrollTo('resources')} style={{cursor:'pointer'}}>API Reference</a>
                <a onClick={() => scrollTo('resources')} style={{cursor:'pointer'}}>Beckn Protocol</a>
                <a onClick={() => scrollTo('resources')} style={{cursor:'pointer'}}>IES Specifications</a>
              </div>
            </li>
            <li><a onClick={() => scrollTo('about')} style={{cursor:'pointer'}}>About</a></li>
            <li><a onClick={() => scrollTo('contact')} style={{cursor:'pointer'}}>Contact</a></li>
          </ul>
          <div className="gs-nav-cta" style={{marginLeft:'0.75rem'}}>
            <button className="gs-btn-outline" onClick={() => scrollTo('how-it-works')}>How it Works</button>
            <button className="gs-btn-primary" onClick={() => onLaunchApp('dashboard')}>Launch App →</button>
          </div>
        </div>
      </nav>

      {/* ── HERO ───────────────────────────────────────── */}
      <section id="hero" className="gs-hero">
        <div className="gs-hero-inner">
          <div>
            <div className="gs-hero-badge">
              <span className="dot" /> Live on IES Testnet · nfh.global/testnet-deg
            </div>
            <h1>
              India's <span className="highlight">Tariff Intelligence</span> Platform
            </h1>
            <p>
              Machine-readable electricity tariff policies. Discover, verify, and execute
              SERC tariff rules via the Beckn protocol — no PDFs, no manual interpretation.
            </p>
            <div className="gs-hero-btns">
              <button className="gs-hero-btn-main" onClick={() => onLaunchApp('ti')}>
                Start Discovery →
              </button>
              <button className="gs-hero-btn-sec" onClick={() => scrollTo('how-it-works')}>
                See How It Works
              </button>
            </div>
            <div className="gs-hero-trust">
              <div className="gs-trust-logos">
                <div className="gs-trust-logo">IES</div>
                <div className="gs-trust-logo">Beckn</div>
                <div className="gs-trust-logo">DEG</div>
                <div className="gs-trust-logo">DeDi</div>
              </div>
              Built at IES Bootcamp 2026 · REC Limited, Gurugram
            </div>
          </div>

          {/* Floating cards */}
          <div className="gs-hero-visual">
            <div className="gs-float-card c1">
              <div className="fc-label">Karnataka LT-2A</div>
              <div className="fc-value green">₹ 847.50</div>
              <div className="fc-sub">250 kWh · 3 slabs applied</div>
              <span className="fc-badge green">VERIFIED ✓</span>
            </div>
            <div className="gs-float-card c2">
              <div className="fc-label">Beckn Flow</div>
              <div style={{display:'flex',gap:'4px',flexWrap:'wrap',marginTop:'6px'}}>
                {['SELECT','INIT','CONFIRM','STATUS'].map(s => (
                  <span key={s} style={{background:'#DBEAFE',color:'#1652F0',padding:'2px 6px',borderRadius:'4px',fontSize:'0.65rem',fontWeight:'700'}}>{s}</span>
                ))}
              </div>
              <div className="fc-sub" style={{marginTop:'8px'}}>All 4 steps · ACK ✓</div>
            </div>
            <div className="gs-float-card c3">
              <div className="fc-label">SHA-256 Hash</div>
              <div style={{fontFamily:'monospace',fontSize:'0.7rem',color:'#059669',marginTop:'4px',wordBreak:'break-all'}}>
                f3cebaac4e18cb53...
              </div>
              <span className="fc-badge green">TAMPER-PROOF</span>
            </div>
            <div className="gs-float-card c4">
              <div className="fc-label">Policies Loaded</div>
              <div className="fc-value blue">11</div>
              <div className="fc-sub">KA · PB · DL · MH</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ──────────────────────────────────── */}
      <div className="gs-stats">
        <div className="gs-stats-inner">
          {[
            { num: count.policies, suffix: '+', label: 'Tariff Policies' },
            { num: count.states,   suffix: '',  label: 'States Covered' },
            { num: count.accuracy, suffix: '%', label: 'Hash Verification Accuracy' },
            { num: count.time,     suffix: 'ms',label: 'Avg. Beckn Response' },
          ].map((s, i) => (
            <div className="gs-stat-item" key={i}>
              <div className="gs-stat-num">{s.num}<span>{s.suffix}</span></div>
              <div className="gs-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ───────────────────────────────── */}
      <section id="how-it-works" className="gs-section gs-section-alt">
        <div className="gs-section-inner">
          <div className="gs-section-head center">
            <div className="gs-section-tag">Protocol</div>
            <h2 className="gs-section-h">How VoltIQ Works</h2>
            <p className="gs-section-sub">
              Three steps. One Beckn lifecycle. Fully automated from policy discovery to bill calculation.
            </p>
          </div>
          <div className="gs-steps">
            {[
              {
                n: '01', icon: '🔍',
                title: 'Discover via DeDi',
                desc: 'Query the Decentralised Directory to locate any SERC\'s Policy Registry BPP endpoint. No central broker, no custom API contracts.',
              },
              {
                n: '02', icon: '⚡',
                title: 'Fetch via Beckn',
                desc: 'Run the full SELECT → INIT → CONFIRM → STATUS lifecycle through the IES Beckn gateway. Every message is cryptographically signed.',
              },
              {
                n: '03', icon: '🧮',
                title: 'Execute & Verify',
                desc: 'Parse energy slabs, run the tariff engine against meter data, verify SHA-256 content hash. Clause-level traceability on every rupee.',
              },
            ].map((s, i) => (
              <div className="gs-step anim-up" style={{ animationDelay: `${i * 0.15}s` }} key={i}>
                <div className="gs-step-num">{s.n}</div>
                <div className="gs-step-icon">{s.icon}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── RESOURCES ──────────────────────────────────── */}
      <section id="resources" className="gs-section gs-section-alt">
        <div className="gs-section-inner">
          <div className="gs-section-head">
            <div className="gs-section-tag green">Resources</div>
            <h2 className="gs-section-h">Docs & References</h2>
            <p className="gs-section-sub">Everything you need to understand and extend the platform.</p>
          </div>
          <div className="gs-resources">
            {[
              { icon: '📖', title: 'API Documentation', desc: 'Interactive Swagger UI with all endpoints — tariff, billing, BPP receiver, and filing.', link: 'http://localhost:9000/docs', label: 'Open API Docs →' },
              { icon: '⚡', title: 'Beckn DEG Specification', desc: 'Adaptation of Beckn protocol for the energy sector. CommonEnvelope, DDM, and DEG data models.', link: 'https://github.com/beckn/DEG-Specification', label: 'View on GitHub →' },
              { icon: '🏛️', title: 'IES Documentation', desc: 'IES implementation guides, data exchange specs, and use case schemas on GitHub.', link: 'https://github.com/India-Energy-Stack/ies-docs', label: 'View on GitHub →' },
              { icon: '🌐', title: 'DeDi Registry', desc: 'Decentralised Directory — register your BPP namespace and discover other energy participants.', link: 'https://publish.dedi.global', label: 'Open DeDi →' },
            ].map((r, i) => (
              <a className="gs-resource-card" key={i} href={r.link} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="gs-resource-icon">{r.icon}</div>
                <div>
                  <h4>{r.title}</h4>
                  <p>{r.desc}</p>
                  <span className="gs-resource-link">{r.label}</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── ABOUT ──────────────────────────────────────── */}
      <section id="about" className="gs-section">
        <div className="gs-section-inner">
          <div className="gs-about-grid">
            <div className="gs-about-text">
              <div className="gs-section-tag">About</div>
              <h2>Built for India's Energy Future</h2>
              <p>
                VoltIQ was built at the <strong>India Energy Stack (IES) Bootcamp 2026</strong> at
                REC Limited World Headquarters, Gurugram — a 3-day hands-on hackathon under
                the Ministry of Power's IES initiative.
              </p>
              <p>
                IES is India's next major Digital Public Infrastructure — the UPI of energy.
                VoltIQ implements IES Building Block #5 (Policy as Code) and Building Block #3
                (Transaction Protocols via Beckn/DEG) in a working, end-to-end system.
              </p>
              <p>
                Today, SERC tariff orders live as PDF documents. VoltIQ converts them
                into executable, discoverable, tamper-verifiable digital objects — making
                regulatory compliance instant and billing disputes obsolete.
              </p>
              <div className="gs-about-pills">
                {['IES Bootcamp 2026','Ministry of Power','REC Limited','Beckn Protocol','DEG v2.0','JSON-LD','W3C Standards'].map(p => (
                  <span className="gs-pill" key={p}>{p}</span>
                ))}
              </div>
            </div>
            <div className="gs-about-cards">
              {[
                { icon: '🏛️', title: 'DPI for Energy', desc: 'Built on the same DPI principles as Aadhaar and UPI — open, interoperable, no central broker.' },
                { icon: '🔐', title: 'Cryptographic Trust', desc: 'Every policy download verified with SHA-256. Every Beckn message signed by the ONIX gateway.' },
                { icon: '📡', title: 'Decentralised', desc: 'Any SERC can publish as a BPP. Any app can consume as a BAP. DeDi handles discovery.' },
                { icon: '⚖️', title: 'Regulatory Grade', desc: 'Clause-level traceability on every bill. Receipt is tamper-proof proof of submission.' },
              ].map((c, i) => (
                <div className="gs-about-card" key={i}>
                  <div className="icon">{c.icon}</div>
                  <h4>{c.title}</h4>
                  <p>{c.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CONTACT ────────────────────────────────────── */}
      <section id="contact" className="gs-section gs-section-alt">
        <div className="gs-section-inner">
          <div className="gs-contact-grid">
            <div className="gs-contact-info">
              <div className="gs-section-tag orange">Contact</div>
              <h2>Get in Touch</h2>
              <p>
                Have a question about VoltIQ, IES implementation, or want to
                integrate your SERC as a BPP? We'd love to hear from you.
              </p>
              <div className="gs-contact-items">
                {[
                  { icon: '✉️', title: 'Email', text: 'humairafirdaus.j@infosys.com' },
                  { icon: '🏢', title: 'Organisation', text: 'Infosys Limited' },
                  { icon: '📍', title: 'Location', text: 'IES Bootcamp · REC HQ, Gurugram' },
                ].map((item, i) => (
                  <div className="gs-contact-item" key={i}>
                    <div className="ci-icon">{item.icon}</div>
                    <div>
                      <h5>{item.title}</h5>
                      <p>{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="gs-contact-form">
              <h3>Send a Message</h3>
              {formSent ? (
                <div style={{ textAlign:'center', padding:'2rem', color:'#059669' }}>
                  <div style={{ fontSize:'2.5rem', marginBottom:'0.75rem' }}>✅</div>
                  <div style={{ fontWeight:'700', fontSize:'1.1rem' }}>Message sent!</div>
                  <div style={{ color:'#64748B', fontSize:'0.875rem', marginTop:'0.4rem' }}>We'll get back to you shortly.</div>
                </div>
              ) : (
                <form onSubmit={handleContact}>
                  <div className="gs-form-row">
                    <div className="gs-form-group">
                      <label>First Name</label>
                      <input placeholder="Humeira" required />
                    </div>
                    <div className="gs-form-group">
                      <label>Last Name</label>
                      <input placeholder="Firdaus" required />
                    </div>
                  </div>
                  <div className="gs-form-group">
                    <label>Email Address</label>
                    <input type="email" placeholder="you@example.com" required />
                  </div>
                  <div className="gs-form-group">
                    <label>Topic</label>
                    <select>
                      <option>Tariff Intelligence Query</option>
                      <option>BPP Integration</option>
                      <option>IES / DPI Question</option>
                      <option>Beckn Protocol</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div className="gs-form-group">
                    <label>Message</label>
                    <textarea placeholder="Tell us about your use case or question..." required />
                  </div>
                  <button type="submit" className="gs-form-submit">Send Message →</button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────── */}
      <footer className="gs-footer">
        <div className="gs-footer-inner">
          <div className="gs-footer-grid">
            <div className="gs-footer-brand">
              <div className="gs-logo">
                <div className="gs-logo-icon">G</div>
                <span className="gs-logo-text">Volt<span>IQ</span></span>
              </div>
              <p>India's Tariff Intelligence Platform. Built on IES, powered by the Beckn protocol.</p>
            </div>
            <div className="gs-footer-col">
              <h5>Product</h5>
              <a onClick={() => onLaunchApp('ti')} style={{cursor:'pointer'}}>Tariff Discovery</a>
              <a onClick={() => onLaunchApp('ti')} style={{cursor:'pointer'}}>Bill Calculator</a>
              <a onClick={() => onLaunchApp('ti')} style={{cursor:'pointer'}}>Policy Generator</a>
              <a onClick={() => onLaunchApp('dashboard')} style={{cursor:'pointer'}}>Dashboard</a>
            </div>
            <div className="gs-footer-col">
              <h5>Resources</h5>
              <a href="http://localhost:9000/docs" target="_blank" rel="noreferrer">API Docs</a>
              <a href="https://github.com/beckn/DEG-Specification" target="_blank" rel="noreferrer">DEG Spec</a>
              <a href="https://github.com/India-Energy-Stack/ies-docs" target="_blank" rel="noreferrer">IES Docs</a>
              <a href="https://publish.dedi.global" target="_blank" rel="noreferrer">DeDi Registry</a>
            </div>
            <div className="gs-footer-col">
              <h5>About</h5>
              <a onClick={() => scrollTo('about')} style={{cursor:'pointer'}}>Our Story</a>
              <a onClick={() => scrollTo('contact')} style={{cursor:'pointer'}}>Contact</a>
              <a href="https://ies.fsrglobal.org" target="_blank" rel="noreferrer">IES Initiative</a>
              <a href="https://recindia.nic.in" target="_blank" rel="noreferrer">REC Limited</a>
            </div>
          </div>
          <div className="gs-footer-bottom">
            <span>© 2026 VoltIQ · IES Bootcamp · REC Limited, Gurugram</span>
            <div className="gs-footer-bottom-links">
              <a href="#">Privacy</a>
              <a href="#">Terms</a>
            </div>
            <div className="gs-powered">
              <span className="dot" />
              Powered by Beckn Protocol v2.0
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}
