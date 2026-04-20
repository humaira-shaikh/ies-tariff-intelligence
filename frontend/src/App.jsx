import { useState } from 'react'
import Dashboard from './components/Dashboard'
import TIPanel   from './components/TIPanel'
import './App.css'

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'ti',        label: 'Tariff Intelligence' },
]

export default function App() {
  const [tab, setTab] = useState('dashboard')
  return (
    <div className="app">
      <header className="app-header">
        <div className="header-top">
          <div>
            <h1>IES Energy Data Exchange</h1>
            <p>Beckn DDM Protocol — Tariff Intelligence (TI)</p>
          </div>
          <div className="header-badge">
            <span className="badge-live">LIVE</span>
            <span className="badge-net">nfh.global/testnet-deg</span>
          </div>
        </div>
        <nav className="tab-nav">
          {TABS.map(t => (
            <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </nav>
      </header>
      <main className="app-main">
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'ti'        && <TIPanel />}
      </main>
    </div>
  )
}
