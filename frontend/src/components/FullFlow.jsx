import { useState } from 'react'
import axios from 'axios'

const API = 'http://localhost:9000/api'

const TEAMS = {
  'flockenergy.tech':    'https://5c41-117-250-7-33.ngrok-free.app/bpp/receiver',
  'bpp.renewalytics.in': 'https://comma-appendage-deacon.ngrok-free.dev/bpp/receiver',
  'bpp.example.com':     'https://appraiser-mascot-possible.ngrok-free.dev/bpp/receiver',
}

const STEP_INFO = [
  { id: 1, label: 'Discover BPP',       desc: 'DeDi registry lookup' },
  { id: 2, label: 'Fetch via Beckn',    desc: 'select→init→confirm→status' },
  { id: 3, label: 'Extract Policies',   desc: 'Parse tariff data' },
  { id: 4, label: 'Calculate Bill',     desc: 'Apply slabs + surcharges' },
]

export default function FullFlow() {
  const [target,    setTarget]    = useState('bpp.renewalytics.in')
  const [units,     setUnits]     = useState(250)
  const [night,     setNight]     = useState(false)
  const [running,   setRunning]   = useState(false)
  const [steps,     setSteps]     = useState([])   // {id, status, detail}
  const [result,    setResult]    = useState(null)
  const [error,     setError]     = useState(null)

  const updateStep = (id, status, detail='') =>
    setSteps(prev => {
      const exists = prev.find(s => s.id === id)
      if (exists) return prev.map(s => s.id===id ? {...s,status,detail} : s)
      return [...prev, {id, status, detail}]
    })

  const runFlow = async () => {
    setRunning(true); setSteps([]); setResult(null); setError(null)

    try {
      // ── STEP 1: Discover ──────────────────────────────────────────
      updateStep(1, 'running')
      const disc = await axios.get(`${API}/dashboard/discover`, { params:{subscriber_id: target} }).catch(e=>e.response)
      const bppUri = disc?.data?.found
        ? disc.data.data?.[0]?.subscriber_url
        : TEAMS[target]
      const source = disc?.data?.found ? 'Found in DeDi' : 'Fallback URL (not in DeDi yet)'
      updateStep(1, 'done', `${source} → ${bppUri?.slice(0,45)}...`)
      await delay(600)

      // ── STEP 2: Fetch via Beckn ───────────────────────────────────
      updateStep(2, 'running')
      const fetch_ = await axios.post(`${API}/tariff/fetch-external`, {
        bpp_uri: bppUri, bpp_id: target
      })
      const flow   = fetch_.data.becknFlow || []
      const allAck = flow.every(s => s.status === 'ACK')
      const actions = flow.map(s => `${s.action}:${s.status}`).join(' → ')
      updateStep(2, allAck ? 'done' : 'warn', actions)
      await delay(400)

      // ── STEP 3: Extract Policies ──────────────────────────────────
      updateStep(3, 'running')
      const localPols = await axios.get(`${API}/tariff/policies`)
      const policies  = localPols.data
      const polNames  = policies.map(p => p.policyID).join(', ')
      updateStep(3, 'done', `${policies.length} policies: ${polNames}`)
      await delay(400)

      // ── STEP 4: Calculate Bill ────────────────────────────────────
      updateStep(4, 'running')
      const bill = await axios.post(`${API}/tariff/calculate`, {
        policyId: policies[0]?.policyID,
        unitsConsumed: units,
        nightUsage: night
      })
      updateStep(4, 'done',
        `${bill.data.policyName} | ${units} kWh = ₹${bill.data.totalAmount?.toFixed(2)}`)

      setResult({ policies, bill: bill.data, txn: fetch_.data.transactionId, bppUri })

    } catch(e) {
      setError(e.response?.data?.detail || e.message)
    } finally {
      setRunning(false)
    }
  }

  const reset = () => { setSteps([]); setResult(null); setError(null) }

  return (
    <div>
      {/* Config */}
      <div className="card">
        <div className="card-title">End-to-End Beckn Flow</div>
        <p style={{fontSize:'0.825rem',color:'#8b949e',marginBottom:'1rem'}}>
          One click — Discover BPP → Fetch Policies → Calculate Bill
        </p>

        <div className="form-row">
          <div className="form-group">
            <label>Target BPP</label>
            <select value={target} onChange={e => setTarget(e.target.value)}>
              {Object.keys(TEAMS).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Units (kWh)</label>
            <input type="number" value={units} min={1} style={{width:'90px'}}
              onChange={e => setUnits(parseFloat(e.target.value))} />
          </div>
          <div className="form-group">
            <label>Time</label>
            <label className="checkbox-row">
              <input type="checkbox" checked={night} onChange={e => setNight(e.target.checked)} />
              Night use
            </label>
          </div>
        </div>

        {error && <div className="alert alert-err" style={{marginBottom:'0.75rem'}}>{error}</div>}

        <div style={{display:'flex', gap:'0.75rem'}}>
          <button className="btn btn-blue" onClick={runFlow} disabled={running}
            style={{fontSize:'1rem', padding:'0.65rem 2rem', minWidth:'200px'}}>
            {running ? 'Discovering...' : 'Tariff Discovery'}
          </button>
          {(steps.length > 0 || result) && !running &&
            <button className="btn btn-sm" style={{background:'#161b22',border:'1px solid #30363d',color:'#8b949e'}} onClick={reset}>Reset</button>
          }
        </div>
      </div>

      {/* Step Progress */}
      {steps.length > 0 && (
        <div className="card">
          <div className="card-title">Flow Progress</div>
          <div style={{display:'flex', flexDirection:'column', gap:'0.6rem'}}>
            {STEP_INFO.map(info => {
              const s = steps.find(x => x.id === info.id)
              const status = s?.status || 'pending'
              return (
                <div key={info.id} style={{
                  display:'flex', alignItems:'center', gap:'1rem',
                  padding:'0.75rem 1rem', borderRadius:'6px', background:'#161b22',
                  borderLeft: `3px solid ${status==='done'?'#3fb950':status==='running'?'#58a6ff':status==='warn'?'#f0883e':'#30363d'}`
                }}>
                  {/* Icon */}
                  <div style={{width:'28px', height:'28px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                    background: status==='done'?'#1a3a1a':status==='running'?'#1a2d4a':status==='warn'?'#3a2a1a':'#21262d',
                    color: status==='done'?'#3fb950':status==='running'?'#58a6ff':status==='warn'?'#f0883e':'#484f58',
                    fontSize:'0.85rem', fontWeight:'700'
                  }}>
                    {status==='done' ? '✓' : status==='running' ? '…' : status==='warn' ? '!' : info.id}
                  </div>

                  {/* Content */}
                  <div style={{flex:1}}>
                    <div style={{display:'flex', alignItems:'center', gap:'0.5rem'}}>
                      <span style={{fontSize:'0.875rem', fontWeight:'600', color:'#c9d1d9'}}>
                        Step {info.id}: {info.label}
                      </span>
                      <span style={{fontSize:'0.72rem', color:'#8b949e'}}>{info.desc}</span>
                    </div>
                    {s?.detail && (
                      <div style={{fontSize:'0.775rem', color: status==='done'?'#3fb950':status==='warn'?'#f0883e':'#8b949e', marginTop:'0.2rem', fontFamily: s.detail.includes('http') ? 'monospace' : 'inherit'}}>
                        {s.detail}
                      </div>
                    )}
                    {status==='running' && (
                      <div style={{fontSize:'0.75rem', color:'#58a6ff', marginTop:'0.2rem'}}>Processing...</div>
                    )}
                  </div>

                  {/* Status badge */}
                  <span className={`tag ${status==='done'?'tag-green':status==='running'?'tag-blue':status==='warn'?'tag-orange':'tag-blue'}`} style={{fontSize:'0.7rem'}}>
                    {status==='pending'?'waiting':status}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Final Result */}
      {result && (
        <div className="card">
          <div className="card-title">Result</div>

          {/* Bill */}
          <div style={{background:'#161b22', borderRadius:'8px', padding:'1.25rem', marginBottom:'1rem'}}>
            <div style={{textAlign:'center', color:'#8b949e', fontSize:'0.8rem', marginBottom:'0.25rem'}}>
              {result.bill.policyName} — {units} kWh
            </div>
            <div style={{fontSize:'2.5rem', fontWeight:'700', color:'#3fb950', textAlign:'center'}}>
              ₹ {result.bill.totalAmount?.toFixed(2)}
            </div>
            <div style={{display:'flex', justifyContent:'center', gap:'2rem', marginTop:'0.75rem'}}>
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:'0.72rem', color:'#8b949e'}}>Base</div>
                <div style={{color:'#c9d1d9', fontWeight:'600'}}>₹{result.bill.baseAmount?.toFixed(2)}</div>
              </div>
              {result.bill.surchargeAmount !== 0 && (
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:'0.72rem', color:'#8b949e'}}>Surcharge</div>
                  <div style={{color: result.bill.surchargeAmount < 0 ? '#3fb950':'#f0883e', fontWeight:'600'}}>
                    ₹{result.bill.surchargeAmount?.toFixed(2)}
                  </div>
                </div>
              )}
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:'0.72rem', color:'#8b949e'}}>Total</div>
                <div style={{color:'#3fb950', fontWeight:'700'}}>₹{result.bill.totalAmount?.toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* Slab breakdown */}
          <div style={{marginBottom:'1rem'}}>
            <div style={{fontSize:'0.75rem', color:'#8b949e', marginBottom:'0.4rem'}}>Slab Breakdown</div>
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>Slab</th><th>Units</th><th>Rate</th><th>Amount</th></tr></thead>
                <tbody>
                  {result.bill.slabBreakdown?.map(s => (
                    <tr key={s.slabId}>
                      <td><span className="tag tag-blue">{s.slabId}</span></td>
                      <td>{s.units} kWh</td>
                      <td>₹{s.rate}/kWh</td>
                      <td style={{color:'#3fb950'}}>₹{s.amount?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Policies available */}
          <div>
            <div style={{fontSize:'0.75rem', color:'#8b949e', marginBottom:'0.4rem'}}>
              All Policies Available ({result.policies.length})
            </div>
            <div style={{display:'flex', gap:'0.4rem', flexWrap:'wrap'}}>
              {result.policies.map(p => (
                <span key={p.policyID} className="tag tag-purple" style={{fontSize:'0.75rem'}}>
                  {p.policyID}
                </span>
              ))}
            </div>
          </div>

          {/* TXN */}
          <div style={{marginTop:'0.875rem', padding:'0.6rem 0.875rem', background:'#0d1117', borderRadius:'4px', fontSize:'0.72rem', color:'#484f58'}}>
            TXN: <span style={{fontFamily:'monospace', color:'#8b949e'}}>{result.txn}</span>
            {' · '}BPP: <span style={{fontFamily:'monospace', color:'#8b949e'}}>{result.bppUri?.slice(0,50)}...</span>
          </div>
        </div>
      )}
    </div>
  )
}

const delay = ms => new Promise(r => setTimeout(r, ms))
