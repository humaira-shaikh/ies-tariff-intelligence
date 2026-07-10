import { useState, useEffect } from 'react'
import axios from 'axios'

const API = '/api'

const PRODUCTS = [
  {
    id: 'flow',      icon: '🛰️', title: 'Tariff Discovery',    subtitle: 'Beckn End-to-End',
    desc: 'Discover tariff policies from any SERC via Beckn. DeDi lookup → SELECT → INIT → CONFIRM → STATUS in one click.',
    color: '#1652F0', bg: '#EFF6FF', border: '#BFDBFE', tags: ['Beckn','DeDi','ONIX'],
    badge: 'Live', badgeColor: '#059669', badgeBg: '#F0FDF4',
  },
  {
    id: 'calculate', icon: '🧮', title: 'Generate Bill',         subtitle: 'Bill Calculator',
    desc: 'Calculate electricity bill for any consumer. Slab-by-slab breakdown with clause-level traceability and multi-policy comparison.',
    color: '#0284C7', bg: '#F0F9FF', border: '#BAE6FD', tags: ['Bill Calc','ToD','Compare'],
    badge: 'Consumer', badgeColor: '#0284C7', badgeBg: '#F0F9FF',
  },
  {
    id: 'optimizer', icon: '💡', title: 'Rate Optimizer',        subtitle: 'Cost Intelligence',
    desc: 'Find the cheapest tariff plan for your usage. Compares all policies across all states — see exactly how much you can save.',
    color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', tags: ['Multi-State','Savings','Analytics'],
    badge: 'New', badgeColor: '#7C3AED', badgeBg: '#F5F3FF',
  },
]

export default function Dashboard({ onNavigate }) {
  const [summary,  setSummary]  = useState(null)
  const [visitors, setVisitors] = useState(null)
  const [hovered,  setHovered]  = useState(null)

  useEffect(() => {
    const load = () => {
      axios.get(`${API}/dashboard/summary`).then(r => setSummary(r.data)).catch(() => {})
      axios.get(`${API}/dashboard/visitors`).then(r => setVisitors(r.data)).catch(() => {})
    }
    load()
    const t = setInterval(load, 10000)
    return () => clearInterval(t)
  }, [])

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>

      {/* ── Welcome banner ── */}
      <div style={{
        background: 'linear-gradient(120deg, #1652F0 0%, #0284C7 60%, #00C896 100%)',
        borderRadius: 16, padding: '2rem 2.5rem', marginBottom: '2rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        color: '#fff',
      }}>
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, opacity: 0.8, marginBottom: '0.4rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            VoltIQ · Tariff Intelligence Platform
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>
            Welcome to the Dashboard
          </h2>
          <p style={{ margin: '0.4rem 0 0', opacity: 0.85, fontSize: '0.9rem' }}>
            Select a module below to get started · Live on nfh.global/testnet-deg
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', textAlign: 'center' }}>
          {[
            { val: summary?.totalPolicies ?? '—', lbl: 'Policies' },
            { val: summary?.totalPrograms ?? '—', lbl: 'Programs' },
            { val: 'LIVE', lbl: 'Status' },
          ].map(s => (
            <div key={s.lbl}>
              <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{s.val}</div>
              <div style={{ fontSize: '0.72rem', opacity: 0.75 }}>{s.lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Product cards ── */}
      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94A3B8', marginBottom: '1rem' }}>
          Select a Module
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.25rem' }}>
          {PRODUCTS.map(p => (
            <div
              key={p.id}
              onClick={() => onNavigate(p.id)}
              onMouseEnter={() => setHovered(p.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                background: '#fff',
                border: `1.5px solid ${hovered === p.id ? p.color : '#E2E8F0'}`,
                borderRadius: 14, padding: '1.75rem',
                cursor: 'pointer',
                transition: 'all 0.25s',
                transform: hovered === p.id ? 'translateY(-4px)' : 'none',
                boxShadow: hovered === p.id ? `0 12px 36px ${p.color}22` : '0 1px 4px rgba(0,0,0,0.05)',
                position: 'relative', overflow: 'hidden',
              }}>
              {/* Top accent line */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                background: `linear-gradient(90deg, ${p.color}, ${p.color}88)`,
                opacity: hovered === p.id ? 1 : 0,
                transition: 'opacity 0.25s',
              }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div style={{
                  width: 50, height: 50, borderRadius: 12,
                  background: p.bg, border: `1px solid ${p.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.5rem',
                }}>
                  {p.icon}
                </div>
                <span style={{
                  padding: '0.2rem 0.6rem', borderRadius: 999,
                  background: p.badgeBg, color: p.badgeColor,
                  fontSize: '0.7rem', fontWeight: 700,
                }}>
                  {p.badge}
                </span>
              </div>

              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: p.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>
                {p.subtitle}
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.6rem', letterSpacing: '-0.3px' }}>
                {p.title}
              </h3>
              <p style={{ fontSize: '0.825rem', color: '#64748B', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                {p.desc}
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1.25rem' }}>
                {p.tags.map(t => (
                  <span key={t} style={{
                    padding: '0.15rem 0.5rem', borderRadius: 4,
                    background: p.bg, color: p.color,
                    fontSize: '0.7rem', fontWeight: 600,
                    border: `1px solid ${p.border}`,
                  }}>{t}</span>
                ))}
              </div>

              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderTop: '1px solid #F1F5F9', paddingTop: '1rem',
              }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: p.color }}>
                  Open Module
                </span>
                <span style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: hovered === p.id ? p.color : p.bg,
                  color: hovered === p.id ? '#fff' : p.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.9rem', fontWeight: 700,
                  transition: 'all 0.2s',
                }}>
                  →
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── System status row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginTop: '1.5rem' }}>

        {/* BPP endpoint */}
        <div className="card" style={{ margin: 0 }}>
          <div className="card-title">BPP — Live Endpoint</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
            <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>Online</span>
          </div>
          <div className="disc-url" style={{ marginBottom: '0.875rem' }}>
            http://localhost:9000/bpp/receiver
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            {[
              ['subscriber_id', 'bpp.example.com'],
              ['Network', 'nfh.global/testnet-deg'],
              ['Protocol', 'Beckn v2.0'],
              ['Use Case', 'Tariff Intelligence'],
            ].map(([k, v]) => (
              <div key={k} style={{ background: '#F8FAFF', borderRadius: 6, padding: '0.5rem 0.6rem' }}>
                <div style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k}</div>
                <div style={{ fontSize: '0.78rem', color: '#334155', marginTop: '0.15rem', fontWeight: 500 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Live connections */}
        <div className="card" style={{ margin: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
            <div className="card-title" style={{ margin: 0 }}>Live Connections</div>
            <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>auto-refreshes every 10s</span>
          </div>
          {visitors?.visitors?.filter(v => v.ip !== '127.0.0.1').length > 0 ? (
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>IP</th><th>Team</th><th>Requests</th></tr></thead>
                <tbody>
                  {visitors.visitors.filter(v => v.ip !== '127.0.0.1').map(v => (
                    <tr key={v.ip}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{v.ip}</td>
                      <td><span className="tag tag-blue">{v.team}</span></td>
                      <td><span className="tag tag-green">{v.total_requests}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '2rem', color: '#94A3B8', textAlign: 'center',
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📡</div>
              <div style={{ fontSize: '0.825rem', fontWeight: 500 }}>No external connections yet</div>
              <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Share your BPP URL with other teams</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
