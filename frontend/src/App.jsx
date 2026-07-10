import { useState } from 'react'
import LandingPage      from './LandingPage'
import Dashboard        from './components/Dashboard'
import TIPanel          from './components/TIPanel'
import LiveBillTracker  from './components/LiveBillTracker'
import RateOptimizer    from './components/RateOptimizer'
import DisputeResolver  from './components/DisputeResolver'
import EVScheduler      from './components/EVScheduler'
import PDFUploader      from './components/PDFUploader'
import './App.css'

// Single admin credential for demo
const ADMIN = { username: 'admin', password: 'admin123', role: 'Administrator' }

// TI sub-sections that map to TIPanel
const TI_SECTIONS = ['flow', 'calculate', 'generate']

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [showPw,   setShowPw]   = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Simulate a brief network delay for realistic feel
    setTimeout(() => {
      if (username === ADMIN.username && password === ADMIN.password) {
        onLogin({ username: ADMIN.username, role: ADMIN.role })
      } else {
        setError('Invalid username or password. Please try again.')
        setLoading(false)
      }
    }, 700)
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(135deg, #F0F7FF 0%, #EEF2FF 50%, #F0FDF9 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      padding: '1rem',
    }}>

      {/* Background decoration */}
      <div style={{ position: 'fixed', top: -200, right: -200, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(22,82,240,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: -100, left: -100, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,200,150,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, #1652F0, #00C896)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, fontWeight: 900, color: '#fff',
            margin: '0 auto 1rem',
            boxShadow: '0 8px 24px rgba(22,82,240,0.3)',
          }}>V</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.5px' }}>
            Volt<span style={{ color: '#1652F0' }}>IQ</span>
          </div>
          <div style={{ fontSize: '0.875rem', color: '#64748B', marginTop: '0.3rem' }}>
            Tariff Intelligence Platform
          </div>
        </div>

        {/* Login card */}
        <div style={{
          background: '#fff', borderRadius: 20, padding: '2.5rem',
          boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
          border: '1px solid #E2E8F0',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.3rem' }}>
            Welcome back
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#64748B', marginBottom: '1.75rem' }}>
            Sign in to access the dashboard
          </p>

          <form onSubmit={handleSubmit}>

            {/* Username */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => { setUsername(e.target.value); setError('') }}
                placeholder="Enter your username"
                autoFocus
                required
                style={{
                  width: '100%', padding: '0.75rem 1rem',
                  border: `1.5px solid ${error ? '#FECACA' : '#E2E8F0'}`,
                  borderRadius: 10, fontSize: '0.9rem', color: '#1E293B',
                  outline: 'none', background: '#fff',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = '#1652F0'}
                onBlur={e => e.target.style.borderColor = error ? '#FECACA' : '#E2E8F0'}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  placeholder="Enter your password"
                  required
                  style={{
                    width: '100%', padding: '0.75rem 2.75rem 0.75rem 1rem',
                    border: `1.5px solid ${error ? '#FECACA' : '#E2E8F0'}`,
                    borderRadius: 10, fontSize: '0.9rem', color: '#1E293B',
                    outline: 'none', background: '#fff',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.target.style.borderColor = '#1652F0'}
                  onBlur={e => e.target.style.borderColor = error ? '#FECACA' : '#E2E8F0'}
                />
                {/* Show/hide password toggle */}
                <button
                  type="button"
                  onClick={() => setShowPw(s => !s)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#94A3B8', fontSize: '1rem', padding: 2,
                  }}
                >
                  {showPw ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div style={{
                background: '#FEF2F2', border: '1px solid #FECACA',
                borderRadius: 8, padding: '0.6rem 0.875rem',
                fontSize: '0.8rem', color: '#DC2626', marginBottom: '1.25rem',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}>
                ⚠️ {error}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading || !username || !password}
              style={{
                width: '100%', padding: '0.875rem',
                background: loading ? '#94A3B8' : '#1652F0',
                color: '#fff', border: 'none', borderRadius: 10,
                fontSize: '0.95rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                boxShadow: loading ? 'none' : '0 4px 16px rgba(22,82,240,0.3)',
              }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <span style={{ width: 16, height: 16, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                  Signing in...
                </span>
              ) : 'Sign In →'}
            </button>
          </form>
        </div>


        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.75rem', color: '#94A3B8' }}>
          Built at IES Bootcamp 2026 · REC Limited, Gurugram
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default function App() {
  // view: 'landing' | 'login' | 'app'
  const [view,   setView]   = useState('landing')
  const [module, setModule] = useState(null)
  const [user,   setUser]   = useState(null)

  const launchApp = () => setView('login')

  const handleLogin = (userData) => {
    setUser(userData)
    setModule(null)
    setView('app')
  }

  const handleLogout = () => {
    setUser(null)
    setModule(null)
    setView('login')
  }

  const openModule  = (id) => setModule(id)
  const backToPortal = () => setModule(null)

  if (view === 'landing') return <LandingPage onLaunchApp={launchApp} />
  if (view === 'login')   return <LoginPage   onLogin={handleLogin} />

  const renderModule = () => {
    if (!module)                        return <Dashboard onNavigate={openModule} />
    if (module === 'live')              return <LiveBillTracker />
    if (module === 'optimizer')         return <RateOptimizer />
    if (module === 'dispute')           return <DisputeResolver />
    if (module === 'ev')                return <EVScheduler />
    if (module === 'pdf')               return <PDFUploader onPolicyAdded={() => {}} />
    if (TI_SECTIONS.includes(module))   return <TIPanel initialSection={module} onBack={backToPortal} />
    return <Dashboard onNavigate={openModule} />
  }

  const MODULE_TITLES = {
    live:      'Live Bill Tracker',
    flow:      'Tariff Discovery',
    calculate: 'Generate Bill',
    optimizer: 'Rate Optimizer',
    dispute:   'Bill Dispute Resolver',
    ev:        'EV Smart Charging',
    pdf:       'Upload SERC PDF',
  }

  return (
    <div className="gs-app-wrapper">
      {/* Topbar */}
      <div className="gs-app-topbar">
        <div className="gs-app-topbar-logo">
          <span style={{
            width: 32, height: 32, borderRadius: 9,
            background: 'linear-gradient(135deg,#1652F0,#00C896)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 900, color: '#fff', flexShrink: 0,
          }}>V</span>
          Volt<span>IQ</span>
          {module && (
            <span style={{ marginLeft: '0.75rem', fontSize: '0.8rem', color: '#334155', fontWeight: 500 }}>
              / {MODULE_TITLES[module] || module}
            </span>
          )}
        </div>

        <div className="gs-app-topbar-right">
          {module && (
            <button onClick={backToPortal} style={{
              padding: '0.35rem 0.875rem', borderRadius: 8,
              background: '#F8FAFF', border: '1.5px solid #E2E8F0',
              color: '#64748B', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
            }}>
              ← Dashboard
            </button>
          )}

          <div className="gs-live-badge">
            <span className="gs-live-dot" /> LIVE · nfh.global/testnet-deg
          </div>

          {/* User badge + logout */}
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                background: '#F8FAFF', border: '1.5px solid #E2E8F0',
                borderRadius: 8, padding: '0.3rem 0.75rem',
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: 'linear-gradient(135deg,#1652F0,#00C896)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.65rem', fontWeight: 900, color: '#fff',
                }}>
                  {user.username[0].toUpperCase()}
                </div>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155' }}>
                  {user.username}
                </span>
                <span style={{ fontSize: '0.68rem', color: '#94A3B8' }}>
                  · {user.role}
                </span>
              </div>
              <button onClick={handleLogout} className="gs-back-btn" title="Sign out">
                Sign Out
              </button>
            </div>
          )}

          <button className="gs-back-btn" onClick={() => setView('landing')}>← Home</button>
        </div>
      </div>

      {/* Content */}
      <div className="gs-app-content">
        {renderModule()}
      </div>
    </div>
  )
}
