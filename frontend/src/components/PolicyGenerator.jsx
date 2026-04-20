import { useState } from 'react'
import axios from 'axios'

const API = 'http://localhost:9000/api'

const STATES = ['Karnataka','Punjab','Maharashtra','Delhi','Haryana','Rajasthan','Gujarat','Tamil Nadu','Andhra Pradesh','Telangana']
const COMMISSIONS = { Karnataka:'KERC', Punjab:'PSERC', Maharashtra:'MERC', Delhi:'DERC', Haryana:'HERC', Rajasthan:'RERC', Gujarat:'GERC', 'Tamil Nadu':'TNERC', 'Andhra Pradesh':'APERC', Telangana:'TSERC' }

export default function PolicyGenerator() {
  const [form, setForm] = useState({
    state: 'Karnataka', commission: 'KERC',
    policyId: '', policyName: '',
    consumerType: 'DOMESTIC', fyYear: '2025-26',
    saveToFile: true
  })
  const [slabs, setSlabs] = useState([
    { start: 0, end: 100, price: '' },
    { start: 101, end: 300, price: '' },
    { start: 301, end: null, price: '' }
  ])
  const [surcharges, setSurcharges] = useState([])
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const updateForm = (k, v) => {
    const upd = { ...form, [k]: v }
    if (k === 'state') upd.commission = COMMISSIONS[v] || ''
    setForm(upd)
  }

  const updateSlab = (i, k, v) => {
    const s = [...slabs]
    s[i] = { ...s[i], [k]: v === '' ? null : parseFloat(v) || v }
    setSlabs(s)
  }

  const addSlab = () => setSlabs([...slabs, { start: (slabs.at(-1)?.end || 0) + 1, end: null, price: '' }])
  const removeSlab = (i) => setSlabs(slabs.filter((_, idx) => idx !== i))

  const addSurcharge = () => setSurcharges([...surcharges, {
    id: '', value: '', unit: 'PERCENT',
    startTime: 'T00:00:00Z', duration: 'PT24H', recurrence: 'P1M'
  }])
  const updateSurcharge = (i, k, v) => {
    const s = [...surcharges]
    s[i] = { ...s[i], [k]: v }
    setSurcharges(s)
  }
  const removeSurcharge = (i) => setSurcharges(surcharges.filter((_, idx) => idx !== i))

  const generate = async () => {
    if (!form.policyId || !form.policyName) {
      setError('Policy ID and Name are required')
      return
    }
    if (slabs.some(s => !s.price)) {
      setError('Please enter price for all slabs')
      return
    }
    setLoading(true); setError(null); setResult(null)
    try {
      const r = await axios.post(`${API}/tariff/generate`, {
        ...form,
        energySlabs: slabs.map(s => ({
          start: s.start,
          end: s.end === '' ? null : s.end,
          price: parseFloat(s.price)
        })),
        surcharges: surcharges.map(s => ({
          ...s,
          value: parseFloat(s.value)
        })).filter(s => s.id && s.value)
      })
      setResult(r.data)
    } catch(e) {
      setError(e.response?.data?.detail || e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="card">
        <h2>Policy Generator — Create Tariff Policy Pack</h2>

        {error && <div className="alert alert-error">{error}</div>}

        {/* Basic Info */}
        <div className="form-row">
          <div className="form-group">
            <label>State</label>
            <select value={form.state} onChange={e => updateForm('state', e.target.value)}>
              {STATES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Commission</label>
            <input value={form.commission} onChange={e => updateForm('commission', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Consumer Type</label>
            <select value={form.consumerType} onChange={e => updateForm('consumerType', e.target.value)}>
              {['DOMESTIC','COMMERCIAL','INDUSTRIAL','AGRICULTURAL'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>FY Year</label>
            <input value={form.fyYear} onChange={e => updateForm('fyYear', e.target.value)} placeholder="2025-26" style={{width:'100px'}} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Policy ID</label>
            <input value={form.policyId} onChange={e => updateForm('policyId', e.target.value.toUpperCase())} placeholder="KA-DOM-1" />
          </div>
          <div className="form-group" style={{flex:2}}>
            <label>Policy Name</label>
            <input value={form.policyName} onChange={e => updateForm('policyName', e.target.value)} placeholder="Karnataka Domestic Standard FY2025-26" style={{minWidth:'320px'}} />
          </div>
        </div>

        {/* Energy Slabs */}
        <h3 style={{marginTop:'1.5rem', marginBottom:'0.75rem'}}>Energy Slabs (Rs/kWh)</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Slab</th><th>Start (units)</th><th>End (units)</th><th>Price (Rs/kWh)</th><th></th></tr>
            </thead>
            <tbody>
              {slabs.map((s, i) => (
                <tr key={i}>
                  <td><span className="badge badge-blue">s{i+1}</span></td>
                  <td>
                    <input type="number" value={s.start} style={{width:'80px'}}
                      onChange={e => updateSlab(i, 'start', e.target.value)} />
                  </td>
                  <td>
                    <input type="number" value={s.end ?? ''} placeholder="infinity"  style={{width:'80px'}}
                      onChange={e => updateSlab(i, 'end', e.target.value)} />
                  </td>
                  <td>
                    <input type="number" value={s.price} placeholder="0.00" style={{width:'80px'}}
                      onChange={e => updateSlab(i, 'price', e.target.value)} />
                  </td>
                  <td>
                    {slabs.length > 1 && (
                      <button className="btn btn-primary" style={{padding:'0.2rem 0.5rem', fontSize:'0.75rem'}}
                        onClick={() => removeSlab(i)}>x</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="btn btn-primary" style={{marginTop:'0.5rem', fontSize:'0.8rem'}} onClick={addSlab}>
          + Add Slab
        </button>

        {/* Surcharges */}
        <h3 style={{marginTop:'1.5rem', marginBottom:'0.75rem'}}>Surcharges / ToD (Optional)</h3>
        {surcharges.map((s, i) => (
          <div key={i} style={{display:'flex', gap:'0.5rem', flexWrap:'wrap', marginBottom:'0.5rem', alignItems:'flex-end', background:'#2d3748', padding:'0.75rem', borderRadius:'6px'}}>
            <div className="form-group">
              <label>ID</label>
              <input value={s.id} placeholder="peak-surcharge" onChange={e => updateSurcharge(i,'id',e.target.value)} style={{width:'130px'}} />
            </div>
            <div className="form-group">
              <label>Value</label>
              <input type="number" value={s.value} placeholder="-10" onChange={e => updateSurcharge(i,'value',e.target.value)} style={{width:'70px'}} />
            </div>
            <div className="form-group">
              <label>Unit</label>
              <select value={s.unit} onChange={e => updateSurcharge(i,'unit',e.target.value)}>
                <option value="PERCENT">PERCENT</option>
                <option value="INR_PER_KWH">INR/kWh</option>
              </select>
            </div>
            <div className="form-group">
              <label>Start Time</label>
              <input value={s.startTime} onChange={e => updateSurcharge(i,'startTime',e.target.value)} style={{width:'110px'}} />
            </div>
            <div className="form-group">
              <label>Duration</label>
              <input value={s.duration} placeholder="PT4H" onChange={e => updateSurcharge(i,'duration',e.target.value)} style={{width:'70px'}} />
            </div>
            <button className="btn btn-primary" style={{padding:'0.4rem 0.75rem'}} onClick={() => removeSurcharge(i)}>Remove</button>
          </div>
        ))}
        <button className="btn btn-primary" style={{fontSize:'0.8rem'}} onClick={addSurcharge}>
          + Add Surcharge
        </button>

        {/* Options */}
        <div style={{marginTop:'1rem'}}>
          <label className="checkbox-label">
            <input type="checkbox" checked={form.saveToFile} onChange={e => updateForm('saveToFile', e.target.checked)} />
            Save to policies.jsonld (automatically served via BPP)
          </label>
        </div>

        <div style={{marginTop:'1.25rem'}}>
          <button className="btn btn-success" onClick={generate} disabled={loading} style={{fontSize:'1rem', padding:'0.75rem 2rem'}}>
            {loading ? 'Generating...' : 'Generate Policy Pack'}
          </button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="card">
          <h2>Policy Generated!</h2>
          <div className="alert alert-info">
            <strong>{result.policyId}</strong> — {result.policy.policyName}
            {result.saved && <span style={{marginLeft:'1rem', color:'#68d391'}}>Saved to BPP!</span>}
          </div>

          <div className="stats-grid" style={{marginBottom:'1rem'}}>
            <div className="stat-box green">
              <div className="value" style={{fontSize:'1rem'}}>{result.policyId}</div>
              <div className="label">Policy ID</div>
            </div>
            <div className="stat-box">
              <div className="value">{result.policy.energySlabs.length}</div>
              <div className="label">Energy Slabs</div>
            </div>
            <div className="stat-box purple">
              <div className="value">{result.policy.surchargeTariffs.length}</div>
              <div className="label">Surcharges</div>
            </div>
          </div>

          {/* Slab preview */}
          <h3>Slab Breakdown</h3>
          <div className="table-wrap" style={{marginBottom:'1rem'}}>
            <table>
              <thead><tr><th>Slab</th><th>Units</th><th>Rate</th></tr></thead>
              <tbody>
                {result.policy.energySlabs.map(s => (
                  <tr key={s.id}>
                    <td><span className="badge badge-blue">{s.id}</span></td>
                    <td>{s.start} – {s.end ?? 'inf'} kWh</td>
                    <td style={{color:'#68d391', fontWeight:'600'}}>Rs.{s.price}/kWh</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* BPP URL */}
          <div className="alert alert-info">
            <strong>BPP URL:</strong> {result.bppUrl}<br/>
            <strong>Program ID:</strong> {result.programId}
          </div>

          {/* JSON Preview */}
          <details style={{marginTop:'1rem'}}>
            <summary style={{cursor:'pointer', color:'#63b3ed', padding:'0.5rem 0'}}>View Full JSON</summary>
            <div className="hash-box" style={{marginTop:'0.5rem', maxHeight:'300px', overflowY:'auto', fontSize:'0.7rem'}}>
              {JSON.stringify(result.policy, null, 2)}
            </div>
          </details>
        </div>
      )}
    </div>
  )
}
