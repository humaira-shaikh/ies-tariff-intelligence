import { useState, useEffect } from 'react'
import axios from 'axios'

const API = '/api'

// Quick profile presets — each has a consumer type that drives policy filtering
const CONSUMER_PROFILES = [
  { label: 'Small Household',   units: 80,   type: 'DOMESTIC',     icon: '🏠' },
  { label: 'Average Household', units: 200,  type: 'DOMESTIC',     icon: '🏡' },
  { label: 'Large Household',   units: 450,  type: 'DOMESTIC',     icon: '🏘️' },
  { label: 'Small Shop',        units: 350,  type: 'COMMERCIAL',   icon: '🏪' },
  { label: 'Restaurant',        units: 1800, type: 'COMMERCIAL',   icon: '🍽️' },
  { label: 'Small Factory',     units: 5000, type: 'INDUSTRIAL',   icon: '🏭' },
]

// Consumer type tabs — maps to consumerType field in policies
const CONSUMER_TYPES = [
  { id: 'DOMESTIC',     label: 'Residential', desc: 'Households, flats, apartments',    icon: '🏠', color: '#1652F0' },
  { id: 'COMMERCIAL',   label: 'Commercial',  desc: 'Shops, offices, restaurants',      icon: '🏪', color: '#059669' },
  { id: 'INDUSTRIAL',   label: 'Industrial',  desc: 'Factories, manufacturing units',   icon: '🏭', color: '#7C3AED' },
  { id: 'AGRICULTURAL', label: 'Agriculture', desc: 'Pump sets, irrigation, farms',     icon: '🌾', color: '#EA580C' },
  { id: 'ALL',          label: 'All',         desc: 'Compare across all categories',    icon: '📊', color: '#64748B' },
]

export default function RateOptimizer() {
  const [allPolicies,   setAllPolicies]   = useState([])
  const [units,         setUnits]         = useState(250)
  const [nightUsage,    setNightUsage]    = useState(false)
  const [consumerType,  setConsumerType]  = useState('DOMESTIC')
  const [results,       setResults]       = useState([])
  const [loading,       setLoading]       = useState(false)
  const [ran,           setRan]           = useState(false)
  const [profile,       setProfile]       = useState(null)
  const [includeBPL,    setIncludeBPL]    = useState(false)

  useEffect(() => {
    axios.get(`${API}/tariff/policies`).then(r => setAllPolicies(r.data)).catch(() => {})
  }, [])

  // Filter policies based on selected consumer type and BPL toggle
  const filteredPolicies = allPolicies.filter(p => {
    const pType = p.consumerType || 'DOMESTIC'
    if (consumerType !== 'ALL' && pType !== consumerType) return false
    // Exclude BPL policies from residential unless explicitly included
    if (p.isBPL && !includeBPL) return false
    return true
  })

  // Calculate bill using policy slabs
  const calcBill = (policy, u, night) => {
    const slabs = policy.energySlabs || []
    let rem = u, base = 0
    for (const s of slabs) {
      if (rem <= 0) break
      const cap = s.end != null ? s.end - s.start : Infinity
      const used = Math.min(rem, cap)
      base += used * s.price
      rem -= used
    }
    let sur = 0
    for (const s of policy.surchargeTariffs || []) {
      if (night && s.id?.includes('night')) sur -= base * ((s.value || 0) / 100)
      else if (!night && s.id?.includes('peak') && s.unit === 'INR_PER_KWH') sur += u * (s.value || 0)
    }
    return {
      base:      Math.round(base * 100) / 100,
      surcharge: Math.round(sur  * 100) / 100,
      total:     Math.round((base + sur) * 100) / 100,
    }
  }

  const run = () => {
    setLoading(true)
    setTimeout(() => {
      const res = filteredPolicies
        .map(p => ({ ...p, bill: calcBill(p, units, nightUsage) }))
        .filter(p => p.bill.total > 0)
        .sort((a, b) => a.bill.total - b.bill.total)
      setResults(res)
      setLoading(false)
      setRan(true)
    }, 400)
  }

  // Reset results when filter changes
  const changeType = (type) => {
    setConsumerType(type)
    setRan(false)
    setResults([])
    setProfile(null)
  }

  const best    = results[0]
  const worst   = results[results.length - 1]
  const savings = best && worst ? worst.bill.total - best.bill.total : 0
  const activeType = CONSUMER_TYPES.find(t => t.id === consumerType)

  const TYPE_COLORS = { DOMESTIC:'#1652F0', COMMERCIAL:'#059669', INDUSTRIAL:'#7C3AED', AGRICULTURAL:'#EA580C', ALL:'#64748B' }
  const RANK_COLORS = { 0:'#059669', 1:'#1652F0', 2:'#7C3AED' }

  return (
    <div style={{ maxWidth: 1050 }}>

      {/* Header */}
      <div style={{
        background: `linear-gradient(120deg, ${activeType?.color || '#7C3AED'}, #1652F0)`,
        borderRadius: 14, padding: '1.5rem 2rem', marginBottom: '1.5rem', color: '#fff',
        transition: 'background 0.4s',
      }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
          Consumer Rate Optimizer
        </div>
        <div style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.3px' }}>
          Find Your Cheapest Tariff Plan
        </div>
        <div style={{ fontSize: '0.825rem', opacity: 0.8, marginTop: 4 }}>
          {filteredPolicies.length} policies eligible for {activeType?.label} · Sorted cheapest first
        </div>
      </div>

      {/* Consumer Type Selector */}
      <div className="card">
        <div className="card-title">Who Are You?</div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: consumerType === 'DOMESTIC' ? '0.875rem' : 0 }}>
          {CONSUMER_TYPES.map(t => (
            <button key={t.id} onClick={() => changeType(t.id)} style={{
              padding: '0.75rem 1.25rem', borderRadius: 10, border: '2px solid',
              cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left', minWidth: 140,
              background:   consumerType === t.id ? t.color : '#fff',
              borderColor:  consumerType === t.id ? t.color : '#E2E8F0',
              color:        consumerType === t.id ? '#fff'  : '#334155',
              boxShadow:    consumerType === t.id ? `0 4px 14px ${t.color}44` : 'none',
            }}>
              <div style={{ fontSize: '1.25rem', marginBottom: 3 }}>{t.icon}</div>
              <div style={{ fontSize: '0.825rem', fontWeight: 700 }}>{t.label}</div>
              <div style={{ fontSize: '0.68rem', opacity: consumerType === t.id ? 0.85 : 0.6, marginTop: 2 }}>{t.desc}</div>
            </button>
          ))}
        </div>

        {/* BPL toggle — only shown for residential */}
        {consumerType === 'DOMESTIC' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.875rem', background: '#FFF7ED', borderRadius: 8, border: '1px solid #FED7AA' }}>
            <input type="checkbox" id="bplToggle" checked={includeBPL}
              onChange={e => { setIncludeBPL(e.target.checked); setRan(false); setResults([]) }} />
            <label htmlFor="bplToggle" style={{ fontSize: '0.8rem', color: '#92400E', cursor: 'pointer', fontWeight: 500 }}>
              Include BPL (Below Poverty Line) schemes — only eligible if officially registered under BPL
            </label>
          </div>
        )}
      </div>

      {/* Usage input */}
      <div className="card">
        <div className="card-title">Your Monthly Usage</div>

        {/* Quick profiles — filtered to current consumer type */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600, marginBottom: '0.5rem' }}>
            Quick Profiles
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {CONSUMER_PROFILES
              .filter(p => consumerType === 'ALL' || p.type === consumerType)
              .map(p => (
                <button key={p.label}
                  onClick={() => { setUnits(p.units); setProfile(p.label); changeType(p.type); setRan(false); setResults([]) }}
                  style={{
                    padding: '0.4rem 0.875rem', borderRadius: 8, border: '1.5px solid',
                    fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                    background:  profile === p.label ? activeType?.color : '#fff',
                    borderColor: profile === p.label ? activeType?.color : '#E2E8F0',
                    color:       profile === p.label ? '#fff' : '#334155',
                  }}>
                  {p.icon} {p.label}
                  <span style={{ opacity: 0.7, fontSize: '0.7rem', marginLeft: 4 }}>({p.units} kWh)</span>
                </button>
              ))
            }
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group">
            <label>Monthly Units (kWh)</label>
            <input type="number" value={units} min={1} max={50000}
              onChange={e => { setUnits(Number(e.target.value)); setRan(false); setResults([]) }}
              style={{ width: 130 }} />
          </div>
          <div className="form-group">
            <label>Time of Use</label>
            <label className="checkbox-row">
              <input type="checkbox" checked={nightUsage}
                onChange={e => { setNightUsage(e.target.checked); setRan(false); setResults([]) }} />
              Night usage (23:00–05:00)
            </label>
          </div>
          <button onClick={run} disabled={loading || !filteredPolicies.length} className="btn btn-blue"
            style={{ padding: '0.55rem 1.75rem', fontSize: '0.9rem', background: activeType?.color }}>
            {loading ? 'Comparing...' : `Compare ${filteredPolicies.length} Policies →`}
          </button>
        </div>
      </div>

      {/* Savings banner */}
      {ran && savings > 0 && (
        <div style={{
          background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 12,
          padding: '1.25rem 1.5rem', marginBottom: '1.25rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#059669' }}>
              💡 You could save up to ₹{savings.toFixed(2)}/month
            </div>
            <div style={{ fontSize: '0.8rem', color: '#374151', marginTop: 4 }}>
              Best: <strong>{best?.policyID}</strong> at ₹{best?.bill.total.toFixed(2)}
              &nbsp;·&nbsp;
              Worst: <strong>{worst?.policyID}</strong> at ₹{worst?.bill.total.toFixed(2)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#059669' }}>₹{savings.toFixed(0)}</div>
            <div style={{ fontSize: '0.72rem', color: '#64748B' }}>max saving/month</div>
          </div>
        </div>
      )}

      {ran && results.length === 0 && (
        <div className="alert alert-info">
          No {activeType?.label} policies match your criteria. Try selecting "All" or adding more policies via Upload SERC PDF.
        </div>
      )}

      {/* Results table */}
      {ran && results.length > 0 && (
        <div className="card">
          <div className="card-title">
            {activeType?.label} Policies Ranked — {units} kWh/month
            {nightUsage && <span className="tag tag-blue" style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}>Night Rate</span>}
          </div>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Policy</th>
                  <th>Name</th>
                  <th>State</th>
                  <th>Slabs</th>
                  <th>Base</th>
                  <th>Surcharge</th>
                  <th>Total Bill</th>
                  <th>vs Cheapest</th>
                </tr>
              </thead>
              <tbody>
                {results.map((p, i) => {
                  const diff       = p.bill.total - best.bill.total
                  const rankColor  = RANK_COLORS[i] || '#334155'
                  // Infer state from policyID prefix
                  const stateMap   = { KA:'Karnataka', MH:'Maharashtra', DS:'Punjab', DL:'Delhi', RJ:'Rajasthan' }
                  const stateCode  = p.policyID?.split('-')[0]
                  const state      = stateMap[stateCode] || stateCode

                  return (
                    <tr key={p.policyID}>
                      <td>
                        <span className={`tag ${i===0?'tag-green':i===results.length-1?'tag-red':'tag-blue'}`}>
                          #{i+1}{i===0?' ★':''}
                        </span>
                      </td>
                      <td style={{ fontFamily:'monospace', fontSize:'0.8rem', fontWeight:700, color: activeType?.color }}>
                        {p.policyID}
                        {p.isBPL && <span className="tag tag-orange" style={{ fontSize:'0.62rem', marginLeft:4 }}>BPL</span>}
                      </td>
                      <td style={{ fontSize:'0.8rem', color:'#475569', maxWidth:200 }}>
                        {p.policyName?.slice(0,32)}
                      </td>
                      <td>
                        <span className="tag tag-purple" style={{ fontSize:'0.7rem' }}>{state}</span>
                      </td>
                      <td style={{ color:'#94A3B8', fontSize:'0.78rem' }}>
                        {p.energySlabs?.length} slabs
                      </td>
                      <td>₹{p.bill.base.toFixed(2)}</td>
                      <td style={{ color: p.bill.surcharge < 0 ? '#059669' : p.bill.surcharge > 0 ? '#EA580C' : '#94A3B8' }}>
                        {p.bill.surcharge !== 0 ? `₹${p.bill.surcharge.toFixed(2)}` : '—'}
                      </td>
                      <td style={{ fontWeight:800, fontSize:'1rem',
                        color: i===0 ? '#059669' : i===results.length-1 ? '#DC2626' : '#1E293B' }}>
                        ₹{p.bill.total.toFixed(2)}
                      </td>
                      <td>
                        {i === 0
                          ? <span className="tag tag-green">Cheapest ✓</span>
                          : <span style={{ fontSize:'0.8rem', color:'#DC2626', fontWeight:600 }}>+₹{diff.toFixed(2)}</span>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Explanation note */}
          <div style={{ marginTop:'0.875rem', fontSize:'0.75rem', color:'#94A3B8', lineHeight:1.6 }}>
            <strong>Note:</strong> Only {activeType?.label} category policies are shown.
            {consumerType === 'DOMESTIC' && !includeBPL && ' BPL schemes are excluded — enable the toggle above if you are BPL registered.'}
            {' '}Rates sourced from official SERC tariff orders via IES Beckn BPP.
          </div>
        </div>
      )}
    </div>
  )
}
