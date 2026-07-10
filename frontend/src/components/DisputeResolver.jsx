import { useState, useEffect } from 'react'
import axios from 'axios'

const API = '/api'

export default function DisputeResolver() {
  const [policies,    setPolicies]    = useState([])
  const [policyId,    setPolicyId]    = useState('')
  const [unitsConsumed,setUnits]      = useState('')
  const [billedAmount,setBilledAmount]= useState('')
  const [nightUsage,  setNightUsage]  = useState(false)
  const [result,      setResult]      = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)

  useEffect(() => {
    axios.get(`${API}/tariff/policies`).then(r => {
      setPolicies(r.data)
      if (r.data.length) setPolicyId(r.data[0].policyID)
    }).catch(() => {})
  }, [])

  const resolve = async () => {
    if (!policyId || !unitsConsumed || !billedAmount) {
      setError('Please fill in all fields'); return
    }
    setLoading(true); setError(null); setResult(null)
    try {
      const r = await axios.post(`${API}/tariff/calculate`, {
        policyId, unitsConsumed: parseFloat(unitsConsumed), nightUsage,
      })
      const expected   = r.data.totalAmount
      const billed     = parseFloat(billedAmount)
      const diff       = Math.abs(billed - expected)
      const pct        = ((diff / expected) * 100).toFixed(1)
      const overcharged = billed > expected + 0.5
      const undercharged= billed < expected - 0.5
      setResult({ ...r.data, billed, expected, diff, pct, overcharged, undercharged })
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    } finally { setLoading(false) }
  }

  const VERDICT_CONFIG = {
    overcharged:  { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', icon: '❌', title: 'OVERCHARGED', sub: 'Your bill is higher than the correct tariff calculation.' },
    undercharged: { color: '#EA580C', bg: '#FFF7ED', border: '#FED7AA', icon: '⚠️', title: 'UNDERCHARGED', sub: 'Your bill is lower than expected — possible meter issue.' },
    correct:      { color: '#059669', bg: '#F0FDF4', border: '#BBF7D0', icon: '✅', title: 'CORRECT BILL', sub: 'Your bill matches the official SERC tariff exactly.' },
  }
  const verdict = result ? (result.overcharged ? 'overcharged' : result.undercharged ? 'undercharged' : 'correct') : null
  const vc = verdict ? VERDICT_CONFIG[verdict] : null

  return (
    <div style={{ maxWidth: 900 }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(120deg,#DC2626,#EA580C)',
        borderRadius: 14, padding: '1.5rem 2rem', marginBottom: '1.5rem', color: '#fff',
      }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Bill Dispute Resolver</div>
        <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>Verify Your Electricity Bill</div>
        <div style={{ fontSize: '0.825rem', opacity: 0.8, marginTop: 4 }}>
          Check if your DISCOM billed you correctly using the official SERC tariff policy.
          40% of consumer complaints are billing disputes — resolve yours in seconds.
        </div>
      </div>

      {/* Input form */}
      <div className="card">
        <div className="card-title">Enter Your Bill Details</div>
        {error && <div className="alert alert-err">{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label>Tariff Policy (from your bill / SERC)</label>
            <select value={policyId} onChange={e => { setPolicyId(e.target.value); setResult(null) }}>
              {policies.map(p => (
                <option key={p.policyID} value={p.policyID}>{p.policyID} — {p.policyName}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Units Consumed (kWh)</label>
            <input type="number" value={unitsConsumed} placeholder="e.g. 250"
              onChange={e => { setUnits(e.target.value); setResult(null) }} />
          </div>
          <div className="form-group">
            <label>Amount Billed by DISCOM (₹)</label>
            <input type="number" value={billedAmount} placeholder="e.g. 1250.00"
              onChange={e => { setBilledAmount(e.target.value); setResult(null) }} />
          </div>
          <div className="form-group">
            <label>Usage Pattern</label>
            <label className="checkbox-row">
              <input type="checkbox" checked={nightUsage} onChange={e => { setNightUsage(e.target.checked); setResult(null) }} />
              Night usage (23:00–05:00)
            </label>
          </div>
        </div>

        <button className="btn btn-blue" onClick={resolve} disabled={loading}
          style={{ background: '#DC2626', padding: '0.6rem 2rem', fontSize: '0.95rem' }}>
          {loading ? 'Verifying...' : 'Verify My Bill →'}
        </button>
      </div>

      {/* Result */}
      {result && vc && (
        <>
          {/* Verdict banner */}
          <div style={{
            background: vc.bg, border: `1.5px solid ${vc.border}`,
            borderRadius: 14, padding: '1.5rem 2rem', marginBottom: '1.25rem',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <span style={{ fontSize: '2.5rem' }}>{vc.icon}</span>
              <div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: vc.color }}>{vc.title}</div>
                <div style={{ fontSize: '0.85rem', color: '#374151', marginTop: 4 }}>{vc.sub}</div>
              </div>
            </div>
            {result.overcharged && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#DC2626' }}>₹{result.diff.toFixed(2)}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748B' }}>overcharged ({result.pct}% above correct)</div>
              </div>
            )}
          </div>

          {/* Comparison */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 12, padding: '1.25rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Correct Amount (SERC tariff)
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#059669' }}>₹{result.expected.toFixed(2)}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: 6 }}>{result.policyName}</div>
            </div>
            <div style={{
              background: result.overcharged ? '#FEF2F2' : '#F0FDF4',
              border: `1.5px solid ${result.overcharged ? '#FECACA' : '#BBF7D0'}`,
              borderRadius: 12, padding: '1.25rem', textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Amount Billed by DISCOM
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: result.overcharged ? '#DC2626' : '#059669' }}>
                ₹{result.billed.toFixed(2)}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: 6 }}>
                {result.overcharged ? `₹${result.diff.toFixed(2)} more than correct` : 'Within correct range'}
              </div>
            </div>
          </div>

          {/* Slab breakdown proof */}
          <div className="card">
            <div className="card-title">Slab-by-Slab Proof of Correct Calculation</div>
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>Slab</th><th>Units Applied</th><th>Rate (₹/kWh)</th><th>Amount</th></tr></thead>
                <tbody>
                  {result.slabBreakdown?.map(s => (
                    <tr key={s.slabId}>
                      <td><span className="tag tag-blue">{s.slabId}</span></td>
                      <td>{s.units} kWh</td>
                      <td>₹{s.rate}</td>
                      <td style={{ fontWeight: 700, color: '#059669' }}>₹{s.amount?.toFixed(2)}</td>
                    </tr>
                  ))}
                  {result.surchargeAmount !== 0 && (
                    <tr>
                      <td><span className="tag tag-orange">surcharge</span></td>
                      <td colSpan={2}>ToD / Night rebate</td>
                      <td style={{ color: result.surchargeAmount < 0 ? '#059669' : '#EA580C', fontWeight: 700 }}>
                        ₹{result.surchargeAmount?.toFixed(2)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {result.overcharged && (
              <div style={{ marginTop: '1.25rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '1rem' }}>
                <div style={{ fontWeight: 700, color: '#DC2626', marginBottom: 6 }}>📋 What to do next</div>
                <div style={{ fontSize: '0.825rem', color: '#374151', lineHeight: 1.7 }}>
                  1. File a billing complaint with your DISCOM consumer portal<br />
                  2. Attach this verification report showing the correct amount = ₹{result.expected.toFixed(2)}<br />
                  3. Reference policy: <strong>{result.policyId}</strong> (official SERC tariff order)<br />
                  4. Claim refund of ₹{result.diff.toFixed(2)} for overcharging
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
