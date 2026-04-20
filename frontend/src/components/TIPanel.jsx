import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'

const API    = 'http://localhost:9001/api'
// Tariff BPPs — teams serving actual tariff policy data
const TEAMS  = {
  'bpp.example.com':     'http://localhost:9001/bpp/receiver',   // local BPP (no ngrok needed)
  'bpp.renewalytics.in': 'https://comma-appendage-deacon.ngrok-free.dev/bpp/receiver',
}
// renewalytics serves: BRPL, BYPL, TPDDL, NDMC, BESCOM, MSEDCL
const STATES = ['Karnataka','Punjab','Maharashtra','Delhi','Haryana','Rajasthan','Gujarat','Tamil Nadu','Andhra Pradesh','Telangana']
const COMMISSIONS = { Karnataka:'KERC',Punjab:'PSERC',Maharashtra:'MERC',Delhi:'DERC',Haryana:'HERC',Rajasthan:'RERC',Gujarat:'GERC','Tamil Nadu':'TNERC','Andhra Pradesh':'APERC',Telangana:'TSERC' }

export default function TIPanel() {
  const [section, setSection] = useState('flow')
  const [sharedPolicies, setSharedPolicies] = useState([])

  return (
    <div>
      {/* Sub-nav */}
      <div style={{display:'flex', gap:'0.5rem', marginBottom:'1.25rem'}}>
        {[
          ['flow',      'Tariff Discovery'],
          ['calculate', 'Generate Bill'],
          ['generate',  'Generate Policy'],
        ].map(([id,label]) => (
          <button key={id} onClick={() => setSection(id)}
            style={{padding:'0.4rem 1rem', borderRadius:'6px', border:'1px solid', cursor:'pointer', fontSize:'0.8rem', fontWeight:'600',
              background: section===id ? '#1f6feb' : '#161b22',
              borderColor: section===id ? '#1f6feb' : '#30363d',
              color: section===id ? '#fff' : '#8b949e'}}>
            {label}
          </button>
        ))}
      </div>

      {section === 'flow'      && <FlowSection onFetched={setSharedPolicies} />}
      {section === 'calculate' && <CalcSection externalPolicies={sharedPolicies} />}
      {section === 'generate'  && <GenerateSection />}
    </div>
  )
}

/* ── Policy Browser ── */
function PolicyBrowser({ policies }) {
  const [selected, setSelected] = useState(null)

  return (
    <div>
      {/* Grid */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'12px', marginBottom:'1rem'}}>
        {policies.map(p => (
          <div key={p.policyID}
            onClick={() => setSelected(selected?.policyID === p.policyID ? null : p)}
            style={{
              background: selected?.policyID === p.policyID ? '#1a2d4a' : '#161b22',
              border: `1.5px solid ${selected?.policyID === p.policyID ? '#1f6feb' : '#30363d'}`,
              borderRadius:'10px', padding:'16px', cursor:'pointer', transition:'all 0.15s'
            }}>
            <div style={{fontSize:'18px', fontWeight:'700', color:'#58a6ff', marginBottom:'6px'}}>{p.policyID}</div>
            <div style={{fontSize:'12px', color:'#c9d1d9', marginBottom:'8px', lineHeight:'1.4'}}>{p.policyName}</div>
            <div style={{display:'flex', gap:'6px', flexWrap:'wrap'}}>
              <span style={{background:'#0d1117', color:'#8b949e', padding:'2px 6px', borderRadius:'4px', fontSize:'10px'}}>
                {p.energySlabs?.length} slabs
              </span>
              <span style={{background:'#0d1117', color:'#3fb950', padding:'2px 6px', borderRadius:'4px', fontSize:'10px'}}>
                ₹{Math.min(...(p.energySlabs?.map(s=>s.price)||[0]))}–₹{Math.max(...(p.energySlabs?.map(s=>s.price)||[0]))}/kWh
              </span>
            </div>
            <div style={{marginTop:'8px', fontSize:'10px', color:'#58a6ff'}}>
              {selected?.policyID === p.policyID ? '▲ Hide' : '▼ View Details'}
            </div>
          </div>
        ))}
      </div>

      {/* Detail Panel */}
      {selected && (
        <div style={{background:'#0d1117', border:'1.5px solid #1f6feb', borderRadius:'10px', padding:'20px', marginTop:'4px'}}>
          <div style={{display:'flex', justifyContent:'space-between', marginBottom:'16px'}}>
            <div>
              <div style={{fontSize:'18px', fontWeight:'700', color:'#58a6ff'}}>{selected.policyID}</div>
              <div style={{fontSize:'13px', color:'#c9d1d9', marginTop:'3px'}}>{selected.policyName}</div>
              <div style={{fontSize:'11px', color:'#8b949e', marginTop:'2px'}}>Program: {selected.programID}</div>
            </div>
            <button onClick={() => setSelected(null)}
              style={{background:'#161b22', border:'1px solid #30363d', color:'#8b949e',
                borderRadius:'6px', padding:'4px 12px', cursor:'pointer', fontSize:'12px'}}>
              Close ✕
            </button>
          </div>

          {/* Slabs */}
          <div style={{marginBottom:'16px'}}>
            <div style={{fontSize:'11px', fontWeight:'700', color:'#8b949e', letterSpacing:'1px', textTransform:'uppercase', marginBottom:'8px'}}>Energy Rate Slabs</div>
            {selected.energySlabs?.map((s, i) => {
              const colors = ['#58a6ff','#3fb950','#bc8cff','#f0883e','#f85149']
              return (
                <div key={s.id} style={{display:'flex', alignItems:'center', gap:'12px',
                  background:'#161b22', borderRadius:'6px', padding:'10px 14px', marginBottom:'6px',
                  borderLeft:`3px solid ${colors[i%colors.length]}`}}>
                  <div style={{fontSize:'12px', color:'#8b949e', flex:1}}>
                    <strong style={{color:'#c9d1d9'}}>{s.start}</strong> – <strong style={{color:'#c9d1d9'}}>{s.end ?? '∞'}</strong> kWh
                  </div>
                  <div style={{fontSize:'18px', fontWeight:'700', color:colors[i%colors.length]}}>
                    ₹{s.price}<span style={{fontSize:'11px', color:'#8b949e'}}>/kWh</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Surcharges */}
          {selected.surchargeTariffs?.length > 0 && (
            <div>
              <div style={{fontSize:'11px', fontWeight:'700', color:'#8b949e', letterSpacing:'1px', textTransform:'uppercase', marginBottom:'8px'}}>Surcharges / Time-of-Day</div>
              {selected.surchargeTariffs.map(s => (
                <div key={s.id} style={{display:'flex', alignItems:'center', gap:'12px',
                  background:'#161b22', borderRadius:'6px', padding:'10px 14px', marginBottom:'6px',
                  borderLeft:`3px solid ${s.value < 0 ? '#2ea043' : '#d04f00'}`}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:'12px', color:'#c9d1d9', fontWeight:'600'}}>{s.id}</div>
                    <div style={{fontSize:'11px', color:'#8b949e', marginTop:'2px'}}>
                      {s.interval?.start?.replace('T','').replace('Z','')} · {s.interval?.duration?.replace('PT','').replace('H',' hrs')} · {s.recurrence==='P1D'?'Daily':'Monthly'}
                    </div>
                  </div>
                  <div style={{fontSize:'16px', fontWeight:'700', color: s.value < 0 ? '#3fb950' : '#f0883e'}}>
                    {s.value > 0 ? '+' : ''}{s.value} {s.unit === 'PERCENT' ? '%' : '₹/kWh'}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{marginTop:'12px', fontSize:'11px', color:'#484f58'}}>
            Go to Generate Bill tab to calculate bill using this policy
          </div>
        </div>
      )}

      <div style={{marginTop:'12px', fontSize:'0.75rem', color:'#8b949e'}}>
        Click any policy card to see rates
      </div>
    </div>
  )
}

/* ── 0. Full E2E Flow ── */
function FlowSection({ onFetched }) {
  const [target,    setTarget]    = useState('bpp.renewalytics.in')
  const [customUri, setCustomUri] = useState('')
  const [running,   setRunning]   = useState(false)
  const [steps,   setSteps]   = useState([])
  const [result,  setResult]  = useState(null)
  const [error,   setError]   = useState(null)

  const STEP_INFO = [
    { id:1, label:'Discover BPP',     desc:'DeDi registry lookup' },
    { id:2, label:'Fetch via Beckn',  desc:'select→init→confirm→status' },
    { id:3, label:'Extract Policies', desc:'Parse tariff data' },
  ]

  const upd = (id, status, detail='') =>
    setSteps(prev => prev.find(s=>s.id===id)
      ? prev.map(s => s.id===id ? {...s,status,detail} : s)
      : [...prev, {id,status,detail}])

  const run = async () => {
    setRunning(true); setSteps([]); setResult(null); setError(null)
    try {
      upd(1,'running')
      let bppUri, discDetail
      if (target === 'custom') {
        bppUri = customUri
        discDetail = `Custom URL → ${bppUri?.slice(0,50)}...`
      } else {
        const d = await axios.get(`${API}/dashboard/discover`,{params:{subscriber_id:target}}).catch(e=>e.response)
        bppUri = d?.data?.found ? d.data.data?.[0]?.subscriber_url : TEAMS[target]
        discDetail = d?.data?.found ? `Found in DeDi → ${bppUri?.slice(0,50)}...` : `Fallback URL → ${bppUri?.slice(0,50)}...`
      }
      upd(1,'done', discDetail)
      await delay(500)

      upd(2,'running')
      const bppId = target === 'custom' ? (customUri.split('//')[1]?.split('/')[0] || 'custom.bpp') : target
      const f = await axios.post(`${API}/tariff/fetch-external`,{bpp_uri:bppUri,bpp_id:bppId})
      const allAck = f.data.becknFlow?.every(s=>s.status==='ACK')
      upd(2, allAck?'done':'warn', f.data.becknFlow?.map(s=>`${s.action}:${s.status}`).join(' → '))
      await delay(400)

      upd(3,'running')
      const pols = await axios.get(`${API}/tariff/policies`)
      upd(3,'done',`${pols.data.length} policies available: ${pols.data.map(p=>p.policyID).join(', ')}`)
      onFetched(pols.data)
      setResult({policies:pols.data, txn:f.data.transactionId, bppUri, becknFlow:f.data.becknFlow, source:f.data.source})
    } catch(e) { setError(e.response?.data?.detail||e.message) }
    finally { setRunning(false) }
  }

  return (
    <div>
      <div className="card">
        <div className="card-title">End-to-End Tariff Discovery</div>
        <p style={{fontSize:'0.825rem',color:'#8b949e',marginBottom:'1rem'}}>
          One click: Discover BPP (DeDi) → Fetch Policies (Beckn) → Calculate Bill
        </p>
        <div className="form-row">
          <div className="form-group">
            <label>Subscriber ID</label>
            <select value={target} onChange={e=>setTarget(e.target.value)}>
              {Object.keys(TEAMS).map(t=><option key={t} value={t}>{t}</option>)}
              <option value="custom">Custom...</option>
            </select>
          </div>
          {target === 'custom' && (
            <div className="form-group" style={{flex:2}}>
              <label>BPP URI (paste URL here)</label>
              <input value={customUri} onChange={e=>setCustomUri(e.target.value)}
                placeholder="https://xyz.ngrok-free.dev/bpp/receiver"
                style={{minWidth:'350px'}} />
            </div>
          )}
        </div>
        {error && <div className="alert alert-err">{error}</div>}
        <div style={{display:'flex',gap:'0.75rem'}}>
          <button className="btn btn-blue" onClick={run} disabled={running}
            style={{fontSize:'1rem',padding:'0.65rem 2rem'}}>
            {running ? 'Discovering...' : 'Tariff Discovery'}
          </button>
          {(steps.length>0||result)&&!running &&
            <button className="btn btn-sm" style={{background:'#161b22',border:'1px solid #30363d',color:'#8b949e'}}
              onClick={()=>{setSteps([]);setResult(null)}}>Reset</button>}
        </div>
      </div>

      {steps.length>0 && (
        <div className="card">
          <div className="card-title">Flow Progress</div>
          <div style={{display:'flex',flexDirection:'column',gap:'0.6rem'}}>
            {STEP_INFO.map(info => {
              const s = steps.find(x=>x.id===info.id)
              const st = s?.status||'pending'
              const color = st==='done'?'#3fb950':st==='running'?'#58a6ff':st==='warn'?'#f0883e':'#30363d'
              return (
                <div key={info.id} style={{display:'flex',alignItems:'center',gap:'1rem',padding:'0.75rem 1rem',borderRadius:'6px',background:'#161b22',borderLeft:`3px solid ${color}`}}>
                  <div style={{width:'28px',height:'28px',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,background:st==='done'?'#1a3a1a':st==='running'?'#1a2d4a':'#21262d',color,fontSize:'0.85rem',fontWeight:'700'}}>
                    {st==='done'?'✓':st==='running'?'…':info.id}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:'0.875rem',fontWeight:'600',color:'#c9d1d9'}}>
                      Step {info.id}: {info.label} <span style={{fontSize:'0.72rem',color:'#8b949e',fontWeight:'400'}}>{info.desc}</span>
                    </div>
                    {s?.detail && <div style={{fontSize:'0.775rem',color,marginTop:'0.2rem'}}>{s.detail}</div>}
                    {st==='running' && <div style={{fontSize:'0.75rem',color:'#58a6ff',marginTop:'0.2rem'}}>Processing...</div>}
                  </div>
                  <span className={`tag ${st==='done'?'tag-green':st==='running'?'tag-blue':st==='warn'?'tag-orange':'tag-blue'}`} style={{fontSize:'0.7rem'}}>
                    {st==='pending'?'waiting':st}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {result && (
        <div className="card">
          <div className="card-title">Policies Fetched Successfully</div>
          {result.source === 'beckn' ? (
            <div className="alert alert-ok" style={{marginBottom:'1rem'}}>
              <strong>{result.policies.length} policies</strong> received from <strong>{target}</strong> via Beckn DDM
            </div>
          ) : result.becknFlow?.every(s => s.status === 'ERROR') ? (
            <div className="alert alert-err" style={{marginBottom:'1rem'}}>
              Could not reach <strong>{target}</strong> — BPP appears to be offline or the URL has changed.
              <br/><span style={{fontSize:'0.78rem',opacity:0.8}}>
                {result.becknFlow?.[0]?.error ? `Error: ${result.becknFlow[0].error}` : 'Check if the BPP server / ngrok tunnel is active.'}
              </span>
            </div>
          ) : (
            <div className="alert alert-err" style={{marginBottom:'1rem'}}>
              Beckn flow reached <strong>{target}</strong> but it did not return tariff policy data.
              <br/><span style={{fontSize:'0.78rem',opacity:0.8}}>Try selecting a different BPP that serves tariff policies.</span>
            </div>
          )}
          {result.source === 'beckn' && result.policies.length > 0 && (
            <PolicyBrowser policies={result.policies} />
          )}
          <div style={{marginTop:'0.5rem',fontSize:'0.72rem',color:'#484f58',fontFamily:'monospace'}}>TXN: {result.txn}</div>
        </div>
      )}
    </div>
  )
}

const delay = ms => new Promise(r=>setTimeout(r,ms))



/* ── 3. Bill Calculator ── */
const CONSUMER_KW = {
  RESIDENTIAL:  ['residential','domestic','res'],
  COMMERCIAL:   ['commercial','com'],
  INDUSTRIAL:   ['industrial','ind'],
  AGRICULTURAL: ['agricultural','agri'],
}

function CalcSection({ externalPolicies = [] }) {
  const [localPolicies,   setLocalPolicies]   = useState([])
  const [form,            setForm]            = useState({ policyId:'', unitsConsumed:300, nightUsage:false })
  const [billingMonths,   setBillingMonths]   = useState(1)
  const [consumerFilter,  setConsumerFilter]  = useState('ALL')
  const [result,          setResult]          = useState(null)
  const [loading,         setLoading]         = useState(false)
  const [compareLoading,  setCompareLoading]  = useState(false)
  const [comparison,      setComparison]      = useState(null)

  useEffect(() => {
    axios.get(`${API}/tariff/policies`).then(r => setLocalPolicies(r.data))
  }, [])

  // Merge local + externally fetched — external wins on duplicate policyID
  const allPolicies = useMemo(() => {
    const map = new Map()
    localPolicies.forEach(p  => map.set(p.policyID, { ...p,  _src: 'local'    }))
    externalPolicies.forEach(p => map.set(p.policyID, { ...p, _src: 'external' }))
    return Array.from(map.values())
  }, [localPolicies, externalPolicies])

  // Consumer type filter
  const filtered = useMemo(() => {
    if (consumerFilter === 'ALL') return allPolicies
    const kws = CONSUMER_KW[consumerFilter] || []
    return allPolicies.filter(p => {
      const txt = `${p.policyName} ${p.policyID}`.toLowerCase()
      return kws.some(kw => txt.includes(kw))
    })
  }, [allPolicies, consumerFilter])

  // Keep selected policy valid when filter changes
  useEffect(() => {
    if (!filtered.length) return
    if (!filtered.find(p => p.policyID === form.policyId))
      setForm(f => ({ ...f, policyId: filtered[0].policyID }))
  }, [filtered])

  // Set default on first load
  useEffect(() => {
    if (allPolicies.length && !form.policyId)
      setForm(f => ({ ...f, policyId: allPolicies[0].policyID }))
  }, [allPolicies])

  const totalUnits = (form.unitsConsumed || 0) * billingMonths

  const calc = async () => {
    setLoading(true)
    const r = await axios.post(`${API}/tariff/calculate`, {
      ...form,
      unitsConsumed: totalUnits,
    }).catch(e => e.response)
    setResult(r?.data ? { ...r.data, billingMonths } : null)
    setLoading(false)
  }

  const compareAll = async () => {
    setCompareLoading(true); setComparison(null)
    const results = await Promise.all(
      filtered.map(p =>
        axios.post(`${API}/tariff/calculate`, {
          policyId: p.policyID,
          unitsConsumed: totalUnits,
          nightUsage: form.nightUsage,
        }).then(r => ({ ...r.data, _src: p._src })).catch(() => null)
      )
    )
    setComparison(results.filter(Boolean).sort((a, b) => a.totalAmount - b.totalAmount))
    setCompareLoading(false)
  }

  const sel = allPolicies.find(p => p.policyID === form.policyId)

  return (
    <div>
      <div className="card">
        <div className="card-title">Bill Calculator</div>

        {/* Consumer Type Filter */}
        <div style={{marginBottom:'0.875rem'}}>
          <div style={{fontSize:'0.72rem', color:'#8b949e', marginBottom:'0.4rem'}}>Consumer Type</div>
          <div style={{display:'flex', gap:'0.4rem', flexWrap:'wrap'}}>
            {['ALL','RESIDENTIAL','COMMERCIAL','INDUSTRIAL','AGRICULTURAL'].map(t => (
              <button key={t} onClick={() => { setConsumerFilter(t); setResult(null); setComparison(null) }}
                style={{
                  padding:'0.25rem 0.75rem', borderRadius:'20px', border:'1px solid',
                  fontSize:'0.72rem', cursor:'pointer', fontWeight:'600',
                  background:   consumerFilter === t ? '#1f6feb' : '#161b22',
                  borderColor:  consumerFilter === t ? '#1f6feb' : '#30363d',
                  color:        consumerFilter === t ? '#fff'    : '#8b949e',
                }}>
                {t}
              </button>
            ))}
            {externalPolicies.length > 0 && (
              <span className="tag tag-green" style={{fontSize:'0.68rem', alignSelf:'center', marginLeft:'0.5rem'}}>
                +{externalPolicies.length} fetched via Beckn
              </span>
            )}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Tariff Policy</label>
            <select value={form.policyId} onChange={e => { setForm({...form, policyId: e.target.value}); setResult(null) }}>
              {filtered.length === 0
                ? <option value="">No policies match filter</option>
                : filtered.map(p => (
                    <option key={p.policyID} value={p.policyID}>
                      {p._src === 'external' ? '[Beckn] ' : ''}{p.policyID} — {p.policyName}
                    </option>
                  ))
              }
            </select>
          </div>
          <div className="form-group">
            <label>Units / Month (kWh)</label>
            <input type="number" value={form.unitsConsumed} min={1}
              onChange={e => { setForm({...form, unitsConsumed: parseFloat(e.target.value)}); setResult(null) }}
              style={{width:'100px'}} />
          </div>
          <div className="form-group">
            <label>Billing Period</label>
            <select value={billingMonths} onChange={e => { setBillingMonths(parseInt(e.target.value)); setResult(null) }}
              style={{width:'130px'}}>
              <option value={1}>1 Month</option>
              <option value={2}>2 Months</option>
              <option value={3}>3 Months</option>
              <option value={6}>6 Months</option>
              <option value={12}>1 Year (12M)</option>
            </select>
          </div>
          <div className="form-group">
            <label>Time of Use</label>
            <label className="checkbox-row">
              <input type="checkbox" checked={form.nightUsage} onChange={e => setForm({...form, nightUsage: e.target.checked})} />
              Night (23:00–05:00)
            </label>
          </div>
        </div>

        {/* Total units info when billing period > 1 month */}
        {billingMonths > 1 && (
          <div style={{fontSize:'0.775rem', color:'#58a6ff', marginBottom:'0.5rem', padding:'0.4rem 0.75rem', background:'#0d1a2d', borderRadius:'6px', display:'inline-block'}}>
            {form.unitsConsumed} kWh/month × {billingMonths} months = <strong>{totalUnits} kWh</strong> total
          </div>
        )}

        {/* Slab reference with active slab highlight */}
        {sel && (
          <div style={{marginTop:'0.5rem'}}>
            <div style={{fontSize:'0.72rem', color:'#8b949e', marginBottom:'0.4rem'}}>
              Rate slabs
              {sel._src === 'external' && <span className="tag tag-green" style={{fontSize:'0.65rem', marginLeft:'6px'}}>Beckn BPP</span>}
              {sel._src === 'local'    && <span className="tag tag-blue"  style={{fontSize:'0.65rem', marginLeft:'6px'}}>Local BPP</span>}
            </div>
            <div style={{display:'flex', gap:'0.5rem', flexWrap:'wrap'}}>
              {sel.energySlabs?.map(s => {
                const active = totalUnits > s.start && (s.end === null || totalUnits <= s.end)
                return (
                  <span key={s.id}
                    className={`tag ${active ? 'tag-green' : 'tag-purple'}`}
                    style={{fontSize:'0.72rem', fontWeight: active ? '700' : '400'}}>
                    {s.start}–{s.end ?? '∞'} @ ₹{s.price}{active ? ' ◄ you' : ''}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        <div style={{display:'flex', gap:'0.75rem', marginTop:'1rem'}}>
          <button className="btn btn-blue" onClick={calc} disabled={loading || !form.policyId || filtered.length === 0}>
            {loading ? '...' : `Generate Bill${billingMonths > 1 ? ` (${billingMonths}M)` : ''}`}
          </button>
          <button className="btn btn-green" onClick={compareAll} disabled={compareLoading || filtered.length === 0}>
            {compareLoading ? 'Comparing...' : `Compare ${filtered.length} Policies`}
          </button>
        </div>
      </div>

      {result && (
        <div className="card">
          <div className="card-title">
            {result.policyName}
            {result.billingMonths > 1 && (
              <span style={{fontSize:'0.78rem', color:'#8b949e', fontWeight:'400', marginLeft:'0.75rem'}}>
                {result.billingMonths}-month bill
              </span>
            )}
          </div>
          <div className="bill-box">
            <div className="bill-total">₹ {result.totalAmount?.toFixed(2)}</div>
            <div className="bill-row"><span className="lbl">Total units</span><span className="amt">{result.unitsConsumed} kWh</span></div>
            {result.billingMonths > 1 && (
              <div className="bill-row">
                <span className="lbl">Per month</span>
                <span className="amt">₹{(result.totalAmount / result.billingMonths)?.toFixed(2)}</span>
              </div>
            )}
            <div className="bill-row"><span className="lbl">Base amount</span><span className="amt">₹{result.baseAmount?.toFixed(2)}</span></div>
            {result.surchargeAmount !== 0 && (
              <div className="bill-row">
                <span className="lbl">{result.surchargeAmount < 0 ? 'Discount' : 'Surcharge'}</span>
                <span className="amt" style={{color: result.surchargeAmount < 0 ? '#3fb950' : '#f0883e'}}>
                  ₹{result.surchargeAmount?.toFixed(2)}
                </span>
              </div>
            )}
            <div className="bill-row" style={{fontWeight:'700', borderTop:'1px solid #30363d', paddingTop:'0.5rem'}}>
              <span className="lbl">Total Payable</span>
              <span className="amt" style={{color:'#3fb950', fontSize:'1rem'}}>₹{result.totalAmount?.toFixed(2)}</span>
            </div>
          </div>
          <div style={{marginTop:'0.75rem'}}>
            <div style={{fontSize:'0.75rem', color:'#8b949e', marginBottom:'0.4rem'}}>Slab breakdown:</div>
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>Slab</th><th>Units</th><th>Rate</th><th>Amount</th></tr></thead>
                <tbody>
                  {result.slabBreakdown?.map(s => (
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
        </div>
      )}

      {/* Comparison Table */}
      {comparison && (
        <div className="card">
          <div className="card-title">
            Tariff Comparison — {totalUnits} kWh
            {billingMonths > 1 && ` (${billingMonths} months)`}
            {' '}across {filtered.length} policies
            {consumerFilter !== 'ALL' && <span className="tag tag-blue" style={{marginLeft:'0.5rem', fontSize:'0.72rem'}}>{consumerFilter}</span>}
          </div>
          <div className="alert alert-ok" style={{marginBottom:'1rem'}}>
            Cheapest: <strong>{comparison[0]?.policyName}</strong> at ₹{comparison[0]?.totalAmount?.toFixed(2)}
            {comparison.length > 1 && (
              <> — saves ₹{(comparison[comparison.length-1]?.totalAmount - comparison[0]?.totalAmount)?.toFixed(2)} vs most expensive</>
            )}
          </div>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Policy</th>
                  <th>Name</th>
                  <th>Base</th>
                  <th>Surcharge</th>
                  <th>Total Bill</th>
                  <th>Source</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((c, i) => (
                  <tr key={c.policyId}>
                    <td>
                      <span className={`tag ${i===0?'tag-green':i===comparison.length-1?'tag-red':'tag-blue'}`}>
                        #{i+1}
                      </span>
                    </td>
                    <td><span className="tag tag-blue">{c.policyId}</span></td>
                    <td style={{fontSize:'0.8rem', color:'#c9d1d9'}}>{c.policyName?.slice(0,30)}</td>
                    <td style={{color:'#8b949e'}}>₹{c.baseAmount?.toFixed(2)}</td>
                    <td style={{color: c.surchargeAmount<0?'#3fb950':c.surchargeAmount>0?'#f0883e':'#484f58'}}>
                      {c.surchargeAmount !== 0 ? `₹${c.surchargeAmount?.toFixed(2)}` : '—'}
                    </td>
                    <td style={{fontWeight:'700', color: i===0?'#3fb950':i===comparison.length-1?'#f85149':'#c9d1d9', fontSize:'1rem'}}>
                      ₹{c.totalAmount?.toFixed(2)}
                    </td>
                    <td>
                      <span className={`tag ${c._src === 'external' ? 'tag-green' : 'tag-blue'}`} style={{fontSize:'0.65rem'}}>
                        {c._src === 'external' ? 'Beckn' : 'Local'}
                      </span>
                    </td>
                    <td>
                      {i === 0 && <span className="tag tag-green">Cheapest</span>}
                      {i === comparison.length-1 && <span className="tag tag-red">Expensive</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{marginTop:'0.875rem', fontSize:'0.75rem', color:'#8b949e'}}>
            Policies fetched via Beckn DDM · Data source: machine-readable tariff BPP
          </div>
        </div>
      )}
    </div>
  )
}

/* ── 4. Generate Policy ── */
function GenerateSection() {
  const [form, setForm]   = useState({ state:'Karnataka', commission:'KERC', policyId:'', policyName:'', consumerType:'DOMESTIC', fyYear:'2025-26', saveToFile:true })
  const [slabs, setSlabs] = useState([{start:0,end:100,price:''},{start:101,end:300,price:''},{start:301,end:null,price:''}])
  const [surcharges, setSurcharges] = useState([])
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState(null)

  const upd = (k,v) => { const u={...form,[k]:v}; if(k==='state') u.commission=COMMISSIONS[v]||''; setForm(u) }
  const updSlab = (i,k,v) => { const s=[...slabs]; s[i]={...s[i],[k]:v===''?null:parseFloat(v)||v}; setSlabs(s) }
  const addSlab = () => setSlabs([...slabs,{start:(slabs.at(-1)?.end||0)+1,end:null,price:''}])
  const rmSlab  = i  => setSlabs(slabs.filter((_,x)=>x!==i))
  const addSurcharge = () => setSurcharges([...surcharges,{id:'',value:'',unit:'PERCENT',startTime:'T00:00:00Z',duration:'PT24H',recurrence:'P1M'}])
  const updSurcharge = (i,k,v) => { const s=[...surcharges]; s[i]={...s[i],[k]:v}; setSurcharges(s) }
  const rmSurcharge  = i => setSurcharges(surcharges.filter((_,x)=>x!==i))

  const generate = async () => {
    if (!form.policyId||!form.policyName) return setError('Policy ID and Name are required')
    if (slabs.some(s=>!s.price)) return setError('Enter price for all slabs')
    setLoading(true); setError(null); setResult(null)
    try {
      const r = await axios.post(`${API}/tariff/generate`, {
        ...form,
        energySlabs: slabs.map(s=>({start:s.start,end:s.end===''?null:s.end,price:parseFloat(s.price)})),
        surcharges: surcharges.map(s=>({...s,value:parseFloat(s.value)})).filter(s=>s.id&&s.value)
      })
      setResult(r.data)
    } catch(e) { setError(e.response?.data?.detail||e.message) }
    finally { setLoading(false) }
  }

  return (
    <div>
      <div className="card">
        <div className="card-title">Generate Tariff Policy Pack</div>
        {error && <div className="alert alert-err">{error}</div>}

        <div className="form-row">
          <div className="form-group">
            <label>State</label>
            <select value={form.state} onChange={e=>upd('state',e.target.value)}>
              {STATES.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Commission</label>
            <input value={form.commission} onChange={e=>upd('commission',e.target.value)} style={{width:'80px'}} />
          </div>
          <div className="form-group">
            <label>Consumer Type</label>
            <select value={form.consumerType} onChange={e=>upd('consumerType',e.target.value)}>
              {['DOMESTIC','COMMERCIAL','INDUSTRIAL','AGRICULTURAL'].map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>FY Year</label>
            <input value={form.fyYear} onChange={e=>upd('fyYear',e.target.value)} style={{width:'80px'}} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Policy ID</label>
            <input value={form.policyId} onChange={e=>upd('policyId',e.target.value.toUpperCase())} placeholder="KA-DOM-1" style={{width:'110px'}} />
          </div>
          <div className="form-group" style={{flex:2}}>
            <label>Policy Name</label>
            <input value={form.policyName} onChange={e=>upd('policyName',e.target.value)} placeholder="Karnataka Domestic Standard FY2025-26" style={{minWidth:'300px'}} />
          </div>
        </div>

        {/* Slabs */}
        <div style={{fontSize:'0.75rem', color:'#8b949e', marginBottom:'0.4rem', marginTop:'0.25rem'}}>Energy Slabs (Rs/kWh)</div>
        <div className="tbl-wrap" style={{marginBottom:'0.5rem'}}>
          <table>
            <thead><tr><th>#</th><th>Start</th><th>End</th><th>Price ₹/kWh</th><th></th></tr></thead>
            <tbody>
              {slabs.map((s,i)=>(
                <tr key={i}>
                  <td><span className="tag tag-blue">s{i+1}</span></td>
                  <td><input type="number" value={s.start} style={{width:'70px'}} onChange={e=>updSlab(i,'start',e.target.value)} /></td>
                  <td><input type="number" value={s.end??''} placeholder="∞" style={{width:'70px'}} onChange={e=>updSlab(i,'end',e.target.value)} /></td>
                  <td><input type="number" value={s.price} placeholder="0.00" style={{width:'70px'}} onChange={e=>updSlab(i,'price',e.target.value)} /></td>
                  <td>{slabs.length>1 && <button className="btn btn-sm" style={{background:'#3a1a1a',color:'#f85149',border:'none'}} onClick={()=>rmSlab(i)}>×</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="btn btn-sm" style={{background:'#161b22',border:'1px solid #30363d',color:'#8b949e'}} onClick={addSlab}>+ Add Slab</button>

        {/* Surcharges */}
        {surcharges.length > 0 && (
          <div style={{marginTop:'1rem'}}>
            <div style={{fontSize:'0.75rem', color:'#8b949e', marginBottom:'0.4rem'}}>Surcharges / ToD</div>
            {surcharges.map((s,i)=>(
              <div key={i} style={{display:'flex',gap:'0.5rem',flexWrap:'wrap',alignItems:'flex-end',background:'#161b22',padding:'0.6rem',borderRadius:'6px',marginBottom:'0.4rem'}}>
                <div className="form-group"><label>ID</label><input value={s.id} placeholder="peak-surcharge" onChange={e=>updSurcharge(i,'id',e.target.value)} style={{width:'130px'}} /></div>
                <div className="form-group"><label>Value</label><input type="number" value={s.value} onChange={e=>updSurcharge(i,'value',e.target.value)} style={{width:'65px'}} /></div>
                <div className="form-group"><label>Unit</label><select value={s.unit} onChange={e=>updSurcharge(i,'unit',e.target.value)}><option value="PERCENT">%</option><option value="INR_PER_KWH">₹/kWh</option></select></div>
                <button className="btn btn-sm" style={{background:'#3a1a1a',color:'#f85149',border:'none'}} onClick={()=>rmSurcharge(i)}>Remove</button>
              </div>
            ))}
          </div>
        )}
        <button className="btn btn-sm" style={{background:'#161b22',border:'1px solid #30363d',color:'#8b949e',marginTop:'0.5rem'}} onClick={addSurcharge}>+ Add Surcharge</button>

        <div style={{marginTop:'1rem',display:'flex',alignItems:'center',gap:'1rem'}}>
          <label className="checkbox-row">
            <input type="checkbox" checked={form.saveToFile} onChange={e=>upd('saveToFile',e.target.checked)} />
            <span style={{fontSize:'0.825rem',color:'#8b949e'}}>Save & serve via BPP automatically</span>
          </label>
          <button className="btn btn-green" onClick={generate} disabled={loading} style={{marginLeft:'auto'}}>
            {loading ? 'Generating...' : 'Generate Policy Pack'}
          </button>
        </div>
      </div>

      {result && (
        <div className="card">
          <div className="alert alert-ok">
            <strong>{result.policyId}</strong> — {result.policy.policyName}
            {result.saved && <span style={{marginLeft:'0.75rem', fontSize:'0.8rem'}}>Saved & live on BPP</span>}
          </div>
          <div className="stats-row" style={{marginBottom:'0.875rem'}}>
            <div className="stat green"><div className="val">{result.policy.energySlabs.length}</div><div className="lbl">Slabs</div></div>
            <div className="stat purple"><div className="val">{result.policy.surchargeTariffs.length}</div><div className="lbl">Surcharges</div></div>
          </div>
          <details>
            <summary style={{cursor:'pointer',color:'#58a6ff',fontSize:'0.825rem'}}>View JSON</summary>
            <div className="json-box" style={{marginTop:'0.5rem'}}>{JSON.stringify(result.policy, null, 2)}</div>
          </details>
        </div>
      )}
    </div>
  )
}
