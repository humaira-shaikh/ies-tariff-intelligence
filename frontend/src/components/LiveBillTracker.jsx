import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'

const API = '/api'

// Appliance catalog with realistic wattage values
const APPLIANCE_CATALOG = [
  { id: 'ac_15',    name: 'AC 1.5 Ton',        watts: 1500, icon: '❄️',  category: 'Cooling'   },
  { id: 'ac_2',     name: 'AC 2 Ton',           watts: 2000, icon: '❄️',  category: 'Cooling'   },
  { id: 'fan',      name: 'Ceiling Fan',         watts: 75,   icon: '💨',  category: 'Cooling'   },
  { id: 'geyser',   name: 'Geyser (Water Heater)',watts: 2000, icon: '🚿', category: 'Heating'   },
  { id: 'iron',     name: 'Iron',                watts: 1000, icon: '👔',  category: 'Heating'   },
  { id: 'microwave',name: 'Microwave',            watts: 1200, icon: '📦',  category: 'Kitchen'   },
  { id: 'fridge',   name: 'Refrigerator',         watts: 150,  icon: '🧊',  category: 'Kitchen'   },
  { id: 'washing',  name: 'Washing Machine',      watts: 500,  icon: '🫧',  category: 'Appliances'},
  { id: 'tv',       name: 'LED TV 43"',           watts: 80,   icon: '📺',  category: 'Appliances'},
  { id: 'computer', name: 'Desktop Computer',     watts: 200,  icon: '🖥️', category: 'Appliances'},
  { id: 'lights',   name: 'LED Lights (5)',        watts: 100,  icon: '💡',  category: 'Lighting'  },
  { id: 'pump',     name: 'Water Pump',            watts: 750,  icon: '🚰',  category: 'Appliances'},
  { id: 'ev',       name: 'EV Charger',            watts: 7400, icon: '🔋',  category: 'EV'        },
  { id: 'induction',name: 'Induction Cooktop',     watts: 1800, icon: '🍳',  category: 'Kitchen'   },
]

// Define peak / off-peak / solar hour windows (KERC standard)
const TOD_WINDOWS = [
  { label: 'Off-Peak',  hours: [0,1,2,3,4,5],               color: '#059669', mult: 0.8,  desc: 'Cheapest — 20% cheaper' },
  { label: 'Morning Peak', hours: [6,7,8],                   color: '#DC2626', mult: 1.2,  desc: 'Peak — 20% costlier' },
  { label: 'Solar Hours',  hours: [8,9,10,11,12,13,14,15],   color: '#F59E0B', mult: 0.8,  desc: 'Solar — 20% cheaper' },
  { label: 'Normal',       hours: [16,17],                    color: '#64748B', mult: 1.0,  desc: 'Normal rate' },
  { label: 'Evening Peak', hours: [18,19,20,21],              color: '#DC2626', mult: 1.2,  desc: 'Peak — 20% costlier' },
  { label: 'Night Normal', hours: [22,23],                    color: '#64748B', mult: 1.0,  desc: 'Normal rate' },
]

function getTodMultiplier(hour) {
  for (const w of TOD_WINDOWS) {
    if (w.hours.includes(hour)) return { mult: w.mult, label: w.label, desc: w.desc, color: w.color }
  }
  return { mult: 1.0, label: 'Normal', desc: 'Normal rate', color: '#64748B' }
}

// Calculate bill using policy slabs (same logic as backend)
function calcBill(policy, totalKwh) {
  if (!policy?.energySlabs?.length) return { base: 0, slabBreakdown: [] }
  let remaining = totalKwh
  let base = 0
  const slabBreakdown = []
  for (const slab of policy.energySlabs) {
    if (remaining <= 0) break
    const capacity = slab.end != null ? slab.end - slab.start : Infinity
    const used = Math.min(remaining, capacity)
    const amount = used * slab.price
    base += amount
    slabBreakdown.push({ id: slab.id, start: slab.start, end: slab.end, rate: slab.price, units: +used.toFixed(4), amount: +amount.toFixed(4) })
    remaining -= used
  }
  return { base: +base.toFixed(4), slabBreakdown }
}

const CATEGORIES = [...new Set(APPLIANCE_CATALOG.map(a => a.category))]

export default function LiveBillTracker() {
  const [policies,       setPolicies]       = useState([])
  const [policyId,       setPolicyId]       = useState('')
  const [activeAppliances, setActiveAppliances] = useState({}) // id → { startTime, accumulatedKwh }
  const [sessionStart,   setSessionStart]   = useState(null)
  const [tick,           setTick]           = useState(0)      // increments every second
  const [totalKwh,       setTotalKwh]       = useState(0)
  const [bill,           setBill]           = useState({ base: 0, slabBreakdown: [] })
  const [todInfo,        setTodInfo]        = useState(null)
  const [suggestions,    setSuggestions]    = useState([])
  const [catFilter,      setCatFilter]      = useState('All')
  const tickRef = useRef(null)

  // Load policies on mount
  useEffect(() => {
    axios.get(`${API}/tariff/policies`).then(r => {
      setPolicies(r.data)
      const ka = r.data.find(p => p.policyID?.includes('KA-LT2A')) || r.data[0]
      if (ka) setPolicyId(ka.policyID)
    }).catch(() => {})
  }, [])

  // Live tick every second
  useEffect(() => {
    tickRef.current = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(tickRef.current)
  }, [])

  // Recalculate whenever tick or active appliances change
  useEffect(() => {
    const now = Date.now()
    const hour = new Date().getHours()
    const tod = getTodMultiplier(hour)
    setTodInfo(tod)

    // Sum up kWh from all active appliances (including real-time running ones)
    let kwhSum = 0
    Object.entries(activeAppliances).forEach(([id, info]) => {
      const app = APPLIANCE_CATALOG.find(a => a.id === id)
      if (!app) return
      const hoursRunning = (now - info.startTime) / 3600000
      kwhSum += (app.watts / 1000) * hoursRunning + (info.accumulatedKwh || 0)
    })
    kwhSum = +kwhSum.toFixed(6)
    setTotalKwh(kwhSum)

    // Find selected policy
    const policy = policies.find(p => p.policyID === policyId)
    if (policy && kwhSum > 0) {
      const result = calcBill(policy, kwhSum)
      // Apply ToD multiplier on top
      const todAdjusted = +(result.base * tod.mult).toFixed(2)
      setBill({ ...result, todAdjusted, tod })

      // Generate suggestions
      const tips = []
      if ([18,19,20,21].includes(hour)) {
        // Find highest-wattage running appliance
        const running = Object.keys(activeAppliances)
          .map(id => APPLIANCE_CATALOG.find(a => a.id === id))
          .filter(Boolean)
          .sort((a, b) => b.watts - a.watts)
        if (running[0]) {
          const saving = +((running[0].watts / 1000) * 0.2 * (policy.energySlabs?.[0]?.price || 5)).toFixed(2)
          tips.push({ type: 'warning', msg: `Peak hour! Turn off ${running[0].name} → save ₹${saving}/hr` })
        }
      }
      if ([8,9,10,11,12,13,14,15].includes(hour)) {
        tips.push({ type: 'tip', msg: 'Solar hours — cheapest time of day. Run heavy loads now.' })
      }
      if ([0,1,2,3,4,5].includes(hour)) {
        tips.push({ type: 'tip', msg: 'Off-peak hours — 20% cheaper. Great time for EV charging.' })
      }
      setSuggestions(tips)
    } else {
      setBill({ base: 0, todAdjusted: 0, slabBreakdown: [] })
    }
  }, [tick, activeAppliances, policyId, policies])

  const toggleAppliance = useCallback((id) => {
    setActiveAppliances(prev => {
      if (prev[id]) {
        // Turn off — save accumulated time
        const app = APPLIANCE_CATALOG.find(a => a.id === id)
        const hoursRunning = (Date.now() - prev[id].startTime) / 3600000
        const kwhNow = (app.watts / 1000) * hoursRunning + (prev[id].accumulatedKwh || 0)
        const next = { ...prev }
        delete next[id]
        // Add to a "completed" store — keep in total but not running
        return { ...next, [`${id}_done_${Date.now()}`]: { startTime: Date.now(), accumulatedKwh: kwhNow, done: true } }
      } else {
        return { ...prev, [id]: { startTime: Date.now(), accumulatedKwh: 0 } }
      }
    })
  }, [])

  const resetSession = () => {
    setActiveAppliances({})
    setTotalKwh(0)
    setBill({ base: 0, slabBreakdown: [] })
    setSessionStart(null)
  }

  const policy        = policies.find(p => p.policyID === policyId)
  const displayBill   = bill.todAdjusted ?? bill.base
  const runningIds    = Object.keys(activeAppliances).filter(k => !k.includes('_done_'))
  const runningWatts  = runningIds.reduce((s, id) => {
    const app = APPLIANCE_CATALOG.find(a => a.id === id)
    return s + (app?.watts || 0)
  }, 0)

  const filteredAppliances = catFilter === 'All'
    ? APPLIANCE_CATALOG
    : APPLIANCE_CATALOG.filter(a => a.category === catFilter)

  return (
    <div style={{ maxWidth: 1100 }}>

      {/* Header banner */}
      <div style={{
        background: 'linear-gradient(120deg,#DC2626,#EA580C)',
        borderRadius: 14, padding: '1.5rem 2rem', marginBottom: '1.5rem', color: '#fff',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            Live Bill Tracker
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>
            Real-Time Electricity Meter
          </div>
          <div style={{ fontSize: '0.825rem', opacity: 0.8, marginTop: 4 }}>
            Turn on appliances — watch your bill tick up like a taxi meter. Saves when you switch off.
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.72rem', opacity: 0.75, marginBottom: 4 }}>Currently Running</div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>{runningWatts}W</div>
          <div style={{ fontSize: '0.75rem', opacity: 0.75 }}>{(runningWatts / 1000).toFixed(2)} kW</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem' }}>

        {/* Left panel — appliances */}
        <div>

          {/* Policy selector */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>Tariff Policy</label>
                <select value={policyId} onChange={e => setPolicyId(e.target.value)}>
                  {policies.map(p => (
                    <option key={p.policyID} value={p.policyID}>
                      {p.policyID} — {p.policyName?.slice(0, 35)}
                    </option>
                  ))}
                </select>
              </div>
              {policy && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignSelf: 'flex-end' }}>
                  {policy.energySlabs?.slice(0, 4).map((s, i) => {
                    const colors = ['#1652F0','#059669','#EA580C','#DC2626']
                    return (
                      <div key={i} style={{ textAlign: 'center', background: '#F8FAFF', borderRadius: 8, padding: '0.3rem 0.6rem', border: `1px solid ${colors[i%4]}22` }}>
                        <div style={{ fontSize: '0.6rem', color: '#94A3B8' }}>{s.start}–{s.end ?? '∞'}</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: colors[i%4] }}>₹{s.price}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Category filter */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.875rem' }}>
            {['All', ...CATEGORIES].map(c => (
              <button key={c} onClick={() => setCatFilter(c)} style={{
                padding: '0.25rem 0.75rem', borderRadius: 999, border: '1.5px solid',
                fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
                background:  catFilter === c ? '#DC2626' : '#fff',
                borderColor: catFilter === c ? '#DC2626' : '#E2E8F0',
                color:       catFilter === c ? '#fff'    : '#64748B',
                transition: 'all 0.15s',
              }}>{c}</button>
            ))}
          </div>

          {/* Appliance grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px,1fr))', gap: '0.75rem' }}>
            {filteredAppliances.map(app => {
              const isOn = runningIds.includes(app.id)
              // Calculate running time for this appliance
              const info = activeAppliances[app.id]
              const secRunning = info ? Math.floor((Date.now() - info.startTime) / 1000) : 0
              const hrsRunning = secRunning / 3600
              const kwh = isOn ? +(( app.watts / 1000) * hrsRunning).toFixed(4) : 0
              const cost = isOn && policy
                ? +(calcBill(policy, kwh).base * (bill.tod?.mult || 1)).toFixed(3)
                : 0

              return (
                <div key={app.id}
                  onClick={() => toggleAppliance(app.id)}
                  style={{
                    background: isOn ? '#FEF2F2' : '#fff',
                    border: `2px solid ${isOn ? '#DC2626' : '#E2E8F0'}`,
                    borderRadius: 12, padding: '1rem', cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: isOn ? '0 4px 16px rgba(220,38,38,0.15)' : '0 1px 4px rgba(0,0,0,0.04)',
                    position: 'relative',
                  }}>

                  {/* Pulsing dot when ON */}
                  {isOn && (
                    <span style={{
                      position: 'absolute', top: 8, right: 8,
                      width: 8, height: 8, borderRadius: '50%', background: '#DC2626',
                      boxShadow: '0 0 0 3px rgba(220,38,38,0.2)',
                      animation: 'livePulse 1.5s ease-in-out infinite',
                    }} />
                  )}

                  <div style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>{app.icon}</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: isOn ? '#DC2626' : '#1E293B', lineHeight: 1.3 }}>
                    {app.name}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 2 }}>
                    {app.watts}W
                  </div>

                  {isOn && (
                    <div style={{ marginTop: '0.5rem', borderTop: '1px solid #FECACA', paddingTop: '0.5rem' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748B' }}>
                        Running: {Math.floor(secRunning/3600)}h {Math.floor((secRunning%3600)/60)}m {secRunning%60}s
                      </div>
                      <div style={{ fontSize: '0.825rem', fontWeight: 700, color: '#DC2626', marginTop: 2 }}>
                        ₹{cost.toFixed(3)}
                      </div>
                    </div>
                  )}

                  <div style={{
                    marginTop: '0.625rem', textAlign: 'center',
                    padding: '0.3rem', borderRadius: 6,
                    background: isOn ? '#DC2626' : '#F1F5F9',
                    color: isOn ? '#fff' : '#64748B',
                    fontSize: '0.72rem', fontWeight: 700,
                    transition: 'all 0.15s',
                  }}>
                    {isOn ? 'TAP TO OFF' : 'TAP TO ON'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right panel — live meter */}
        <div style={{ position: 'sticky', top: 80 }}>

          {/* Main meter display */}
          <div style={{
            background: '#0F172A', borderRadius: 16, padding: '1.75rem',
            marginBottom: '1rem', textAlign: 'center',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }}>
            <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
              Current Bill
            </div>

            {/* Taxi-meter style counter */}
            <div style={{
              fontSize: '3rem', fontWeight: 900, color: displayBill > 0 ? '#F87171' : '#334155',
              fontFamily: 'monospace', letterSpacing: '-2px',
              transition: 'color 0.3s',
            }}>
              ₹{displayBill.toFixed(3)}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '1rem' }}>
              {[
                { label: 'Units Used', val: `${totalKwh.toFixed(4)} kWh`, color: '#94A3B8' },
                { label: 'Running', val: `${runningIds.length} appliances`, color: '#94A3B8' },
                { label: 'Load', val: `${(runningWatts/1000).toFixed(2)} kW`, color: '#F59E0B' },
                { label: 'Base Bill', val: `₹${(bill.base||0).toFixed(3)}`, color: '#60A5FA' },
              ].map(item => (
                <div key={item.label} style={{ background: '#1E293B', borderRadius: 8, padding: '0.5rem' }}>
                  <div style={{ fontSize: '0.62rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: item.color, marginTop: 2 }}>{item.val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ToD indicator */}
          {todInfo && (
            <div style={{
              background: '#fff', border: `1.5px solid ${todInfo.color}44`,
              borderRadius: 10, padding: '0.875rem', marginBottom: '1rem',
              display: 'flex', alignItems: 'center', gap: '0.75rem',
            }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: todInfo.color,
                boxShadow: `0 0 0 4px ${todInfo.color}33`,
              }} />
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: todInfo.color }}>{todInfo.label}</div>
                <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{todInfo.desc} · {new Date().getHours()}:00 hrs</div>
              </div>
              <div style={{ marginLeft: 'auto', fontSize: '1.1rem', fontWeight: 800, color: todInfo.color }}>
                {todInfo.mult < 1 ? `×${todInfo.mult}` : todInfo.mult > 1 ? `×${todInfo.mult}` : '×1.0'}
              </div>
            </div>
          )}

          {/* Suggestions */}
          {suggestions.map((s, i) => (
            <div key={i} style={{
              background: s.type === 'warning' ? '#FEF2F2' : '#F0FDF4',
              border: `1px solid ${s.type === 'warning' ? '#FECACA' : '#BBF7D0'}`,
              borderRadius: 8, padding: '0.75rem', marginBottom: '0.5rem',
              fontSize: '0.8rem', color: s.type === 'warning' ? '#DC2626' : '#059669',
              fontWeight: 600,
            }}>
              {s.type === 'warning' ? '⚠️' : '💡'} {s.msg}
            </div>
          ))}

          {/* Slab breakdown */}
          {bill.slabBreakdown?.length > 0 && (
            <div className="card" style={{ margin: 0 }}>
              <div className="card-title" style={{ marginBottom: '0.5rem' }}>Slab Breakdown</div>
              {bill.slabBreakdown.map((s, i) => {
                const colors = ['#1652F0','#059669','#7C3AED','#EA580C']
                return (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.4rem 0', borderBottom: '1px solid #F1F5F9', fontSize: '0.8rem',
                  }}>
                    <span style={{ color: colors[i%4], fontWeight: 600 }}>
                      {s.start}–{s.end ?? '∞'} @ ₹{s.rate}
                    </span>
                    <span style={{ color: '#334155' }}>
                      {s.units.toFixed(3)} kWh = <strong>₹{s.amount.toFixed(3)}</strong>
                    </span>
                  </div>
                )
              })}
              {bill.tod && bill.tod.mult !== 1 && (
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '0.4rem 0', fontSize: '0.8rem', fontWeight: 700,
                  color: bill.tod.mult > 1 ? '#DC2626' : '#059669',
                }}>
                  <span>ToD ({bill.tod.label}) ×{bill.tod.mult}</span>
                  <span>₹{displayBill.toFixed(3)}</span>
                </div>
              )}
            </div>
          )}

          {/* Reset button */}
          {totalKwh > 0 && (
            <button onClick={resetSession} style={{
              width: '100%', marginTop: '0.75rem',
              padding: '0.6rem', borderRadius: 8,
              background: '#fff', border: '1.5px solid #E2E8F0',
              color: '#64748B', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
            }}>
              Reset Session
            </button>
          )}
        </div>
      </div>

      {/* Pulse animation for running indicators */}
      <style>{`
        @keyframes livePulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(220,38,38,0.3); }
          50%       { box-shadow: 0 0 0 8px rgba(220,38,38,0); }
        }
      `}</style>
    </div>
  )
}
