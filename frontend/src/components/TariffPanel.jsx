import { useState, useEffect } from 'react'
import axios from 'axios'

const API = 'http://localhost:9000/api'

export default function TariffPanel() {
  const [policies, setPolicies] = useState([])
  const [selectedPolicy, setSelectedPolicy] = useState('')
  const [units, setUnits] = useState(250)
  const [nightUsage, setNightUsage] = useState(false)
  const [bill, setBill] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    axios.get(`${API}/tariff/policies`)
      .then(r => {
        setPolicies(r.data)
        if (r.data.length > 0) setSelectedPolicy(r.data[0].policyID)
      })
      .catch(() => setError('Backend not reachable. Run: cd backend && ./gradlew bootRun'))
  }, [])

  const calculateBill = async () => {
    setLoading(true)
    setBill(null)
    try {
      const r = await axios.post(`${API}/tariff/calculate`, {
        policyId: selectedPolicy,
        unitsConsumed: parseFloat(units),
        nightUsage
      })
      setBill(r.data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}

      {/* Policy Display */}
      <div className="card">
        <h2>Tariff Policies — Fetched from SERC</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Policy ID</th>
                <th>Name</th>
                <th>Type</th>
                <th>Program</th>
                <th>Slabs</th>
                <th>Surcharges</th>
              </tr>
            </thead>
            <tbody>
              {policies.map(p => (
                <tr key={p.id}>
                  <td><span className="badge badge-blue">{p.policyID}</span></td>
                  <td>{p.policyName}</td>
                  <td>{p.policyType}</td>
                  <td style={{fontSize:'0.8rem', color:'#718096'}}>{p.programID}</td>
                  <td>{p.energySlabs?.length ?? 0}</td>
                  <td>{p.surchargeTariffs?.length ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slab Details */}
      {policies.map(p => (
        <div className="card" key={p.id}>
          <h2>{p.policyName} — Slab Details</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Slab</th><th>From (kWh)</th><th>To (kWh)</th><th>Rate (INR/kWh)</th></tr>
              </thead>
              <tbody>
                {p.energySlabs?.map(s => (
                  <tr key={s.id}>
                    <td><span className="badge badge-purple">{s.id}</span></td>
                    <td>{s.start ?? 0}</td>
                    <td>{s.end ?? '∞'}</td>
                    <td style={{color:'#68d391', fontWeight:'600'}}>₹{s.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {p.surchargeTariffs?.length > 0 && (
            <>
              <h3 style={{marginTop:'1rem'}}>Surcharges / ToD</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>ID</th><th>Interval</th><th>Value</th><th>Unit</th></tr>
                  </thead>
                  <tbody>
                    {p.surchargeTariffs.map(s => (
                      <tr key={s.id}>
                        <td>{s.id}</td>
                        <td style={{fontSize:'0.8rem'}}>{s.interval?.start} for {s.interval?.duration}</td>
                        <td style={{color: s.value < 0 ? '#68d391' : '#f6e05e'}}>{s.value}</td>
                        <td>{s.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      ))}

      {/* Bill Calculator */}
      <div className="card">
        <h2>Bill Calculator</h2>
        <div className="form-row">
          <div className="form-group">
            <label>Tariff Policy</label>
            <select value={selectedPolicy} onChange={e => setSelectedPolicy(e.target.value)}>
              {policies.map(p => <option key={p.id} value={p.policyID}>{p.policyID} — {p.policyName}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Units Consumed (kWh)</label>
            <input
              type="number" value={units} min={1} max={10000}
              onChange={e => setUnits(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Usage Time</label>
            <label className="checkbox-label">
              <input type="checkbox" checked={nightUsage} onChange={e => setNightUsage(e.target.checked)} />
              Night Usage (23:00–05:00)
            </label>
          </div>
          <button className="btn btn-success" onClick={calculateBill} disabled={loading || !selectedPolicy}>
            {loading ? 'Calculating...' : 'Calculate Bill'}
          </button>
        </div>

        {bill && (
          <div className="bill-result">
            <div style={{textAlign:'center', color:'#a0aec0', fontSize:'0.85rem'}}>
              Policy: <strong style={{color:'#90cdf4'}}>{bill.policyName}</strong> — {bill.unitsConsumed} kWh
            </div>
            <div className="bill-total">₹ {bill.totalAmount.toFixed(2)}</div>

            <div className="bill-row"><span className="label">Base Amount</span><span className="amount">₹{bill.baseAmount.toFixed(2)}</span></div>
            {bill.surchargeAmount !== 0 && (
              <div className="bill-row">
                <span className="label">{bill.surchargeAmount < 0 ? 'Night Discount' : 'Peak Surcharge'}</span>
                <span className="amount" style={{color: bill.surchargeAmount < 0 ? '#68d391' : '#f6e05e'}}>
                  ₹{bill.surchargeAmount.toFixed(2)}
                </span>
              </div>
            )}
            <div className="bill-row" style={{fontWeight:'700', borderTop:'1px solid #718096', paddingTop:'0.6rem'}}>
              <span className="label">Total Payable</span>
              <span className="amount" style={{color:'#68d391'}}>₹{bill.totalAmount.toFixed(2)}</span>
            </div>

            <h3 style={{marginTop:'1rem', marginBottom:'0.5rem'}}>Slab Breakdown</h3>
            <table>
              <thead><tr><th>Slab</th><th>Units</th><th>Rate</th><th>Amount</th></tr></thead>
              <tbody>
                {bill.slabBreakdown?.map(s => (
                  <tr key={s.slabId}>
                    <td><span className="badge badge-blue">{s.slabId}</span></td>
                    <td>{s.units} kWh</td>
                    <td>₹{s.rate}/kWh</td>
                    <td style={{color:'#68d391'}}>₹{s.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
