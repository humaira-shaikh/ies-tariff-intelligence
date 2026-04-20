import { useState, useEffect } from 'react'
import axios from 'axios'

const API = 'http://localhost:9000/api'

export default function FilingPanel() {
  const [filings, setFilings] = useState([])
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState('')

  useEffect(() => {
    axios.get(`${API}/filing/list`)
      .then(r => {
        setFilings(r.data)
        if (r.data.length > 0) setSelected(r.data[0].filingId)
      })
      .catch(() => setError('Backend not reachable. Run: cd backend && ./gradlew bootRun'))
  }, [])

  const createFiling = async () => {
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const r = await axios.post(`${API}/filing/create`, { filingId: selected })
      setResult(r.data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}

      {/* Filing List */}
      <div className="card">
        <h2>ARR Filings — Available Data</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Filing ID</th>
                <th>Licensee</th>
                <th>Type</th>
                <th>Commission</th>
                <th>Period</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filings.map(f => (
                <tr key={f.id}>
                  <td style={{fontFamily:'monospace', fontSize:'0.8rem'}}>{f.filingId}</td>
                  <td>{f.licensee}</td>
                  <td><span className="badge badge-purple">{f.filingType}</span></td>
                  <td>{f.regulatoryCommission}</td>
                  <td>{f.controlPeriodStart} – {f.controlPeriodEnd}</td>
                  <td>
                    <span className={`badge ${f.status === 'SUBMITTED' ? 'badge-green' : 'badge-yellow'}`}>
                      {f.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Filing via Beckn */}
      <div className="card">
        <h2>Create Filing — DISCOM → SERC via Beckn</h2>
        <div className="form-row">
          <div className="form-group">
            <label>Select Filing</label>
            <select value={selected} onChange={e => setSelected(e.target.value)}>
              {filings.map(f => (
                <option key={f.id} value={f.filingId}>{f.filingId} ({f.licensee})</option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" onClick={createFiling} disabled={loading || !selected}>
            {loading ? 'Submitting...' : 'Submit via Beckn'}
          </button>
        </div>

        {loading && <div className="loading"><div className="spinner"/><p>Simulating Beckn flow...</p></div>}

        {result && (
          <div>
            <div className="alert alert-info">
              Filing <strong>{result.filingId}</strong> submitted successfully!
              Contract: <strong>{result.contractId}</strong> — Status: <strong>{result.status}</strong>
            </div>

            <h3>Payload Hash (SHA-256)</h3>
            <div className="hash-box">{result.payloadHash}</div>

            <h3 style={{marginTop:'1rem'}}>Beckn Flow</h3>
            <div className="beckn-flow">
              {result.becknFlow?.map((step, i) => (
                <div key={i} className="flow-step success">
                  <span className="action">{step.action}</span>
                  <span className="f-status">{step.status}</span>
                  <span className="msg">{step.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
