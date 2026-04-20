import { useState, useEffect } from 'react'
import axios from 'axios'

const API = 'http://localhost:9000/api'

export default function Dashboard() {
  const [summary, setSummary]   = useState(null)
  const [visitors, setVisitors] = useState(null)
  const [error, setError]       = useState(null)

  const load = () => {
    axios.get(`${API}/dashboard/summary`)
      .then(r => setSummary(r.data))
      .catch(() => setError('Backend offline. Run: cd C:\\ies-bootcamp\\backend && python -m uvicorn main:app --port 9000'))

    axios.get(`${API}/dashboard/visitors`)
      .then(r => setVisitors(r.data))
      .catch(() => {})
  }

  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t) }, [])

  if (error) return (
    <div className="card">
      <div className="alert alert-err">{error}</div>
    </div>
  )

  return (
    <div>
      {/* Stats */}
      <div className="card">
        <div className="card-title">System Overview</div>
        <div className="stats-row">
          <div className="stat blue"><div className="val">{summary?.totalPolicies ?? '—'}</div><div className="lbl">Tariff Policies</div></div>
<div className="stat purple"><div className="val">{summary?.totalPrograms ?? '—'}</div><div className="lbl">Programs</div></div>
          <div className="stat orange"><div className="val">{visitors?.total_unique_visitors ?? '—'}</div><div className="lbl">Teams Connected</div></div>
        </div>
      </div>

      {/* Our BPP */}
      <div className="card">
        <div className="card-title">Our BPP — Live Endpoint</div>
        <div className="form-row" style={{marginBottom:0}}>
          <div style={{flex:1}}>
            <div style={{fontSize:'0.75rem', color:'#8b949e', marginBottom:'0.3rem'}}>BPP Endpoint (share with other teams)</div>
            <div className="disc-url">https://appraiser-mascot-possible.ngrok-free.dev/bpp/receiver</div>
          </div>
        </div>
        <div className="form-row" style={{marginTop:'0.75rem', marginBottom:0, gap:'2rem'}}>
          {[
            ['subscriber_id', 'bpp.example.com'],
            ['Network', 'nfh.global/testnet-deg'],
            ['Use Case', 'Tariff Intelligence (TI)'],
          ].map(([k,v]) => (
            <div key={k}>
              <div style={{fontSize:'0.72rem', color:'#8b949e'}}>{k}</div>
              <div style={{fontSize:'0.825rem', color:'#c9d1d9', marginTop:'0.2rem'}}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Visitors */}
      <div className="card">
        <div className="sec-header">
          <div className="card-title" style={{marginBottom:0}}>Live Connections</div>
          <button className="btn btn-blue btn-sm" onClick={load}>Refresh</button>
        </div>
        {visitors?.visitors?.length ? (
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>IP</th><th>Team</th><th>Requests</th><th>Endpoints Hit</th></tr></thead>
              <tbody>
                {visitors.visitors.filter(v => v.ip !== '127.0.0.1').map(v => (
                  <tr key={v.ip}>
                    <td style={{fontFamily:'monospace', fontSize:'0.78rem'}}>{v.ip}</td>
                    <td><span className="tag tag-blue">{v.team}</span></td>
                    <td><span className="tag tag-green">{v.total_requests}</span></td>
                    <td style={{fontSize:'0.75rem', color:'#8b949e'}}>{v.paths_visited.slice(0,3).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{color:'#8b949e', fontSize:'0.825rem', padding:'0.5rem 0'}}>No external connections yet</div>
        )}
      </div>
    </div>
  )
}
