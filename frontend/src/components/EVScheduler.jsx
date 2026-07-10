import { useState, useEffect } from 'react'
import axios from 'axios'

const API = '/api'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const EV_MODELS = [
  { name: 'Tata Nexon EV',    capacity: 30.2, efficiency: 5.5 },
  { name: 'MG ZS EV',         capacity: 50.3, efficiency: 6.2 },
  { name: 'Hyundai Kona EV',  capacity: 39.2, efficiency: 5.8 },
  { name: 'Ather 450X',       capacity: 2.9,  efficiency: 1.4 },
  { name: 'Ola S1 Pro',       capacity: 3.97, efficiency: 1.6 },
  { name: 'Custom',           capacity: 0,    efficiency: 0   },
]

function getHourCost(policy, hour) {
  if (!policy?.energySlabs) return 0
  // Base rate = first slab price (approximate for scheduling)
  const baseRate = policy.energySlabs[0]?.price || 5
  let multiplier = 1

  for (const s of policy.surchargeTariffs || []) {
    const startHour = parseInt(s.interval?.start?.replace('T','') || '0')
    const durationH = parseInt(s.interval?.duration?.replace('PT','').replace('H','') || '0')
    const endHour   = (startHour + durationH) % 24

    let inWindow = false
    if (startHour < endHour) {
      inWindow = hour >= startHour && hour < endHour
    } else {
      inWindow = hour >= startHour || hour < endHour
    }

    if (inWindow) {
      if (s.unit === 'PERCENT') multiplier += (s.value || 0) / 100
      else if (s.unit === 'INR_PER_KWH') return baseRate + (s.value || 0)
    }
  }
  return parseFloat((baseRate * multiplier).toFixed(3))
}

function getCostColor(cost, min, max) {
  if (max === min) return '#059669'
  const t = (cost - min) / (max - min)
  if (t < 0.33) return '#059669'
  if (t < 0.66) return '#F59E0B'
  return '#DC2626'
}

export default function EVScheduler() {
  const [policies,      setPolicies]      = useState([])
  const [policyId,      setPolicyId]      = useState('')
  const [evModel,       setEvModel]       = useState(EV_MODELS[0].name)
  const [customCapacity,setCustomCapacity]= useState(40)
  const [chargeFrom,    setChargeFrom]    = useState(0)
  const [chargeTo,      setChargeTo]      = useState(100)
  const [schedule,      setSchedule]      = useState(null)

  useEffect(() => {
    axios.get(`${API}/tariff/policies`).then(r => {
      setPolicies(r.data)
      // Prefer a Karnataka policy (has ToD data)
      const ka = r.data.find(p => p.policyID?.startsWith('KA') && p.surchargeTariffs?.length > 0) || r.data[0]
      if (ka) setPolicyId(ka.policyID)
    }).catch(() => {})
  }, [])

  const selectedPolicy = policies.find(p => p.policyID === policyId)
  const selectedModel  = EV_MODELS.find(m => m.name === evModel) || EV_MODELS[0]
  const capacity       = evModel === 'Custom' ? customCapacity : selectedModel.capacity
  const chargeNeeded   = capacity * ((chargeTo - chargeFrom) / 100)

  const hourlyRates = HOURS.map(h => ({
    hour: h,
    cost: getHourCost(selectedPolicy, h),
    label: `${String(h).padStart(2,'0')}:00`,
  }))
  const minRate  = Math.min(...hourlyRates.map(h => h.cost))
  const maxRate  = Math.max(...hourlyRates.map(h => h.cost))

  // Find cheapest 6-hour window
  let bestWindow = null, bestCost = Infinity
  for (let start = 0; start < 24; start++) {
    const hours = Array.from({ length: 6 }, (_, i) => (start + i) % 24)
    const avgCost = hours.reduce((s, h) => s + hourlyRates[h].cost, 0) / 6
    if (avgCost < bestCost) {
      bestCost = avgCost
      bestWindow = { start, hours, avgCost }
    }
  }

  const cheapestCost  = (bestWindow?.avgCost || minRate) * chargeNeeded
  const expensiveCost = maxRate * chargeNeeded
  const saving        = expensiveCost - cheapestCost

  const compute = () => setSchedule({ hourlyRates, bestWindow, cheapestCost, expensiveCost, saving })

  return (
    <div style={{ maxWidth: 1000 }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(120deg,#059669,#0284C7)',
        borderRadius: 14, padding: '1.5rem 2rem', marginBottom: '1.5rem', color: '#fff',
      }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>EV Smart Charging</div>
        <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>Optimal EV Charging Scheduler</div>
        <div style={{ fontSize: '0.825rem', opacity: 0.8, marginTop: 4 }}>
          Uses real-time ToD surcharge data from SERC tariff policies to find the cheapest charging window.
        </div>
      </div>

      {/* Input */}
      <div className="card">
        <div className="card-title">Configure Your EV</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div className="form-group">
            <label>Tariff Policy (your state)</label>
            <select value={policyId} onChange={e => { setPolicyId(e.target.value); setSchedule(null) }}>
              {policies.map(p => <option key={p.policyID} value={p.policyID}>{p.policyID} — {p.policyName?.slice(0,24)}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>EV Model</label>
            <select value={evModel} onChange={e => { setEvModel(e.target.value); setSchedule(null) }}>
              {EV_MODELS.map(m => <option key={m.name} value={m.name}>{m.name}{m.capacity ? ` (${m.capacity} kWh)` : ''}</option>)}
            </select>
          </div>
          {evModel === 'Custom' && (
            <div className="form-group">
              <label>Battery Capacity (kWh)</label>
              <input type="number" value={customCapacity} min={1} max={200}
                onChange={e => { setCustomCapacity(Number(e.target.value)); setSchedule(null) }} />
            </div>
          )}
          <div className="form-group">
            <label>Charge From %</label>
            <input type="number" value={chargeFrom} min={0} max={90}
              onChange={e => { setChargeFrom(Number(e.target.value)); setSchedule(null) }} style={{ width: 80 }} />
          </div>
          <div className="form-group">
            <label>Charge To %</label>
            <input type="number" value={chargeTo} min={10} max={100}
              onChange={e => { setChargeTo(Number(e.target.value)); setSchedule(null) }} style={{ width: 80 }} />
          </div>
        </div>
        <div style={{ fontSize: '0.78rem', color: '#64748B', marginBottom: '1rem' }}>
          {capacity > 0 && <>Charging <strong>{chargeFrom}% → {chargeTo}%</strong> = <strong>{chargeNeeded.toFixed(1)} kWh</strong> needed</>}
        </div>
        <button onClick={compute} disabled={!selectedPolicy} className="btn btn-green"
          style={{ padding: '0.6rem 1.75rem', fontSize: '0.95rem' }}>
          Find Best Charging Window →
        </button>
      </div>

      {schedule && (
        <>
          {/* Savings banner */}
          <div style={{
            background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 12,
            padding: '1.25rem 1.5rem', marginBottom: '1.25rem',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#059669' }}>
                ⚡ Best window: {String(schedule.bestWindow.start).padStart(2,'0')}:00 – {String((schedule.bestWindow.start + 6) % 24).padStart(2,'0')}:00
              </div>
              <div style={{ fontSize: '0.8rem', color: '#374151', marginTop: 4 }}>
                Cost at this window: <strong>₹{schedule.cheapestCost.toFixed(2)}</strong> &nbsp;·&nbsp;
                vs peak: <strong>₹{schedule.expensiveCost.toFixed(2)}</strong>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#059669' }}>₹{schedule.saving.toFixed(2)}</div>
              <div style={{ fontSize: '0.72rem', color: '#64748B' }}>saved per charge cycle</div>
            </div>
          </div>

          {/* 24-hour chart */}
          <div className="card">
            <div className="card-title">24-Hour Tariff Rate Chart — {policyId}</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: 120, marginBottom: '0.5rem' }}>
              {schedule.hourlyRates.map(h => {
                const isBest = schedule.bestWindow.hours.includes(h.hour)
                const ht     = ((h.cost - minRate) / (maxRate - minRate || 1)) * 80 + 20
                return (
                  <div key={h.hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <div style={{
                      width: '100%', height: ht,
                      background: isBest ? '#059669' : getCostColor(h.cost, minRate, maxRate),
                      borderRadius: '3px 3px 0 0', opacity: isBest ? 1 : 0.65,
                      border: isBest ? '1.5px solid #047857' : 'none',
                      transition: 'all 0.2s',
                      cursor: 'default',
                    }} title={`${h.label}: ₹${h.cost}/kWh`} />
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#94A3B8' }}>
              {[0,3,6,9,12,15,18,21].map(h => <span key={h}>{String(h).padStart(2,'0')}:00</span>)}
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', fontSize: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 12, height: 12, background: '#059669', borderRadius: 2, display: 'inline-block' }} />
                Best window (₹{minRate?.toFixed(2)}/kWh)
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 12, height: 12, background: '#DC2626', borderRadius: 2, display: 'inline-block' }} />
                Peak hours (₹{maxRate?.toFixed(2)}/kWh)
              </div>
            </div>
          </div>

          {/* Hourly breakdown */}
          <div className="card">
            <div className="card-title">Per-Hour Cost for {chargeNeeded.toFixed(1)} kWh Charge</div>
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>Time</th><th>Rate ₹/kWh</th><th>Cost for {chargeNeeded.toFixed(1)} kWh</th><th>Window</th></tr></thead>
                <tbody>
                  {schedule.hourlyRates.map(h => {
                    const isBest = schedule.bestWindow.hours.includes(h.hour)
                    const chargeCost = h.cost * chargeNeeded
                    return (
                      <tr key={h.hour} style={{ background: isBest ? '#F0FDF4' : undefined }}>
                        <td style={{ fontFamily: 'monospace', fontWeight: isBest ? 700 : 400 }}>{h.label}</td>
                        <td style={{ color: getCostColor(h.cost, minRate, maxRate), fontWeight: 600 }}>₹{h.cost.toFixed(3)}</td>
                        <td style={{ fontWeight: isBest ? 700 : 400, color: isBest ? '#059669' : '#334155' }}>₹{chargeCost.toFixed(2)}</td>
                        <td>{isBest && <span className="tag tag-green">Best ✓</span>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: '1rem', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '0.875rem' }}>
              <div style={{ fontWeight: 700, color: '#1652F0', marginBottom: 4 }}>📱 Set Your Charger Timer</div>
              <div style={{ fontSize: '0.825rem', color: '#374151' }}>
                Plug in tonight and set your charger to start at <strong>{String(schedule.bestWindow.start).padStart(2,'0')}:00</strong>.
                You'll save ₹{schedule.saving.toFixed(2)} compared to charging at peak hours.
                Based on <strong>{policyId}</strong> from SERC via Beckn.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
