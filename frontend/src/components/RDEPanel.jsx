import { useState, useEffect } from 'react'
import axios from 'axios'

const API = 'http://localhost:9000/api'

export default function RDEPanel() {
  const [tab, setTab] = useState('create')
  return (
    <div>
      <div style={{display:'flex', gap:'0.5rem', marginBottom:'1.25rem'}}>
        {[['create','1. Create Filing (DISCOM)'],['consume','2. Consume Filing (SERC)']].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{padding:'0.4rem 1rem', borderRadius:'6px', border:'1px solid', cursor:'pointer', fontSize:'0.8rem', fontWeight:'600',
              background: tab===id ? '#1f6feb' : '#161b22',
              borderColor: tab===id ? '#1f6feb' : '#30363d',
              color: tab===id ? '#fff' : '#8b949e'}}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'create'  && <CreateFiling />}
      {tab === 'consume' && <ConsumeFiling />}
    </div>
  )
}

function CreateFiling() {
  const [filings, setFilings]   = useState([])
  const [selected, setSelected] = useState('')
  const [result, setResult]     = useState(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  useEffect(() => {
    axios.get(`${API}/filing/list`).then(r => {
      setFilings(r.data)
      if (r.data.length) setSelected(r.data[0].filingId)
    }).catch(() => setError('Backend offline'))
  }, [])

  const submit = async () => {
    setLoading(true); setResult(null); setError(null)
    try {
      const r = await axios.post(`${API}/filing/create`, { filing_id: selected })
      setResult(r.data)
    } catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const sel = filings.find(f => f.filingId === selected)

  return (
    <div>
      {error && <div className="alert alert-err">{error}</div>}

      {/* Filing list */}
      <div className="card">
        <div className="card-title">ARR Filings — Available</div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Filing ID</th><th>Licensee</th><th>Type</th><th>Commission</th><th>Period</th><th>Status</th></tr></thead>
            <tbody>
              {filings.map(f => (
                <tr key={f.id}>
                  <td style={{fontFamily:'monospace',fontSize:'0.75rem'}}>{f.filingId}</td>
                  <td style={{fontSize:'0.8rem'}}>{f.licensee}</td>
                  <td><span className="tag tag-purple">{f.filingType}</span></td>
                  <td style={{fontSize:'0.8rem'}}>{f.regulatoryCommission}</td>
                  <td style={{fontSize:'0.75rem',color:'#8b949e'}}>{f.controlPeriodStart} – {f.controlPeriodEnd}</td>
                  <td><span className={`tag ${f.status==='SUBMITTED' ? 'tag-green' : 'tag-orange'}`}>{f.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Submit filing */}
      <div className="card">
        <div className="card-title">Submit Filing — DISCOM to SERC via Beckn</div>
        <div className="form-row">
          <div className="form-group" style={{flex:1}}>
            <label>Select Filing</label>
            <select value={selected} onChange={e => setSelected(e.target.value)}>
              {filings.map(f => <option key={f.id} value={f.filingId}>{f.filingId} ({f.licensee})</option>)}
            </select>
          </div>
          <button className="btn btn-blue" onClick={submit} disabled={loading || !selected}>
            {loading ? 'Submitting...' : 'Submit via Beckn'}
          </button>
        </div>

        {/* Selected filing preview */}
        {sel && (
          <div style={{display:'flex',gap:'2rem',marginTop:'0.5rem',padding:'0.75rem',background:'#161b22',borderRadius:'6px'}}>
            {[['Licensee',sel.licensee],['Commission',sel.regulatoryCommission],['Type',sel.filingType],['Currency',sel.currency]].map(([k,v])=>(
              <div key={k}><div style={{fontSize:'0.7rem',color:'#8b949e'}}>{k}</div><div style={{fontSize:'0.825rem',color:'#c9d1d9',marginTop:'0.2rem'}}>{v}</div></div>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <div className="card" style={{textAlign:'center'}}>
          <div className="spinner" />
          <p style={{color:'#8b949e',fontSize:'0.825rem'}}>Running Beckn lifecycle: select → init → confirm → status</p>
        </div>
      )}

      {result && (
        <div className="card">
          <div className={`alert ${result.status==='CONFIRMED' ? 'alert-ok' : 'alert-info'}`}>
            <strong>{result.filingId}</strong> — {result.status}
            <span style={{marginLeft:'0.75rem',fontSize:'0.8rem',color:'#8b949e'}}>Contract: {result.contractId}</span>
          </div>

          {/* Beckn Flow */}
          <div className="card-title">Beckn Flow</div>
          <div className="flow" style={{marginBottom:'1rem'}}>
            {result.becknFlow?.map((s, i) => (
              <div key={i} className={`flow-item ${s.received ? 'ok' : s.status==='TIMEOUT' ? 'wait' : 'err'}`}>
                <span className="flow-action">{s.action}</span>
                <span className="flow-status" style={{color: s.received ? '#3fb950' : '#f0883e'}}>{s.status}</span>
                <span className="flow-msg">{s.received ? 'Acknowledged' : s.status}</span>
              </div>
            ))}
          </div>

          {/* Hash */}
          <div>
            <div style={{fontSize:'0.72rem',color:'#8b949e',marginBottom:'0.3rem'}}>Payload Hash (SHA-256)</div>
            <div className="disc-url" style={{fontSize:'0.72rem'}}>{result.payloadHash}</div>
          </div>

          {/* Details */}
          <div style={{display:'flex',gap:'2rem',marginTop:'0.875rem',padding:'0.75rem',background:'#161b22',borderRadius:'6px'}}>
            {[['Licensee',result.licensee],['Commission',result.commission],['TXN ID',result.transactionId?.slice(0,16)+'...']].map(([k,v])=>(
              <div key={k}><div style={{fontSize:'0.7rem',color:'#8b949e'}}>{k}</div><div style={{fontSize:'0.8rem',color:'#c9d1d9',marginTop:'0.2rem',fontFamily:k==='TXN ID'?'monospace':'inherit'}}>{v}</div></div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Consume Filing (SERC Role) ── */
function ConsumeFiling() {
  const [receipts, setReceipts] = useState([])
  const [loading,  setLoading]  = useState(false)
  const [testResult, setTestResult] = useState(null)

  const load = () => {
    axios.get(`${API}/rde/receipts`).then(r => setReceipts(r.data.receipts || []))
  }

  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t) }, [])

  const testReceive = async () => {
    setLoading(true); setTestResult(null)
    try {
      // Simulate a DISCOM sending a filing to us (SERC)
      const payload = [{
        filingId: 'TEST/ARR/SERC/2025-26',
        licensee: 'Test DISCOM',
        filingType: 'ARR',
        status: 'SUBMITTED'
      }]
      const hash = await computeHash(payload)
      const r = await axios.post(`${API}/rde/receive`, {
        context: {
          action: 'confirm', version: '2.0.0',
          transactionId: 'test-' + Date.now(),
          bapUri: 'http://localhost:9000/callback',
          bppId: 'bpp.example.com'
        },
        message: {
          contract: {
            id: 'test-contract-001',
            commitments: [{
              id: 'c1',
              commitmentAttributes: {
                '@type': 'DatasetItem',
                'dataset:payloadHash': hash,
                dataPayload: payload
              }
            }]
          }
        }
      })
      setTestResult(r.data.receipt)
      load()
    } catch(e) { setTestResult({ error: e.message }) }
    finally { setLoading(false) }
  }

  return (
    <div>
      {/* Info */}
      <div className="card">
        <div className="card-title">Consume Filing — SERC Role</div>
        <p style={{fontSize:'0.825rem', color:'#8b949e', marginBottom:'1rem'}}>
          SERC receives ARR filings from DISCOMs via Beckn. Validates payload hash, stores receipt.
        </p>

        <div style={{background:'#161b22', borderRadius:'6px', padding:'1rem', marginBottom:'1rem'}}>
          <div style={{fontSize:'0.75rem', color:'#8b949e', marginBottom:'0.5rem'}}>Our Filing Receiver Endpoint</div>
          <div className="disc-url">POST https://appraiser-mascot-possible.ngrok-free.dev/api/rde/receive</div>
          <div style={{fontSize:'0.75rem', color:'#8b949e', marginTop:'0.75rem'}}>
            DISCOMs can send ARR filings here. We validate SHA-256 hash and send receipt back.
          </div>
        </div>

        <div style={{display:'flex', gap:'0.75rem', alignItems:'center'}}>
          <button className="btn btn-blue" onClick={testReceive} disabled={loading}>
            {loading ? 'Testing...' : 'Test — Simulate Filing Receipt'}
          </button>
          <button className="btn btn-sm" style={{background:'#161b22', border:'1px solid #30363d', color:'#8b949e'}} onClick={load}>
            Refresh
          </button>
        </div>

        {testResult && !testResult.error && (
          <div className={`alert ${testResult.status === 'ACCEPTED' ? 'alert-ok' : 'alert-err'}`} style={{marginTop:'0.75rem'}}>
            <strong>Test Result:</strong> Filing {testResult.status} — {testResult.reason}
            {testResult.hashValid !== null && (
              <span style={{marginLeft:'0.75rem'}}>Hash: {testResult.hashValid ? 'Valid' : 'Invalid'}</span>
            )}
          </div>
        )}
      </div>

      {/* Receipts */}
      <div className="card">
        <div className="sec-header">
          <div className="card-title" style={{marginBottom:0}}>
            Received Filings ({receipts.length})
          </div>
          <span style={{fontSize:'0.75rem', color:'#8b949e'}}>Auto-refresh every 5s</span>
        </div>

        {receipts.length === 0 ? (
          <div style={{color:'#8b949e', fontSize:'0.825rem', padding:'1rem 0', textAlign:'center'}}>
            No filings received yet. Waiting for DISCOMs to submit...
          </div>
        ) : (
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr><th>Filing ID</th><th>Status</th><th>Hash Valid</th><th>Received At</th><th>Reason</th></tr>
              </thead>
              <tbody>
                {receipts.map(r => (
                  <tr key={r.id}>
                    <td style={{fontFamily:'monospace', fontSize:'0.78rem'}}>{r.filingId}</td>
                    <td>
                      <span className={`tag ${r.status==='ACCEPTED'?'tag-green':r.status==='REJECTED'?'tag-red':'tag-orange'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td>
                      <span className={`tag ${r.hashValid===true?'tag-green':r.hashValid===false?'tag-red':'tag-orange'}`}>
                        {r.hashValid===true ? 'Valid' : r.hashValid===false ? 'Invalid' : 'Not checked'}
                      </span>
                    </td>
                    <td style={{fontSize:'0.78rem', color:'#8b949e'}}>{r.receivedAt?.slice(11,19)} UTC</td>
                    <td style={{fontSize:'0.75rem', color:'#8b949e'}}>{r.reason?.slice(0,50)}</td>
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

function sortedStringify(obj) {
  if (Array.isArray(obj)) return '[' + obj.map(sortedStringify).join(',') + ']'
  if (obj !== null && typeof obj === 'object') {
    const keys = Object.keys(obj).sort()
    return '{' + keys.map(k => JSON.stringify(k) + ':' + sortedStringify(obj[k])).join(',') + '}'
  }
  return JSON.stringify(obj)
}

async function computeHash(payload) {
  const str  = sortedStringify(payload)
  const data = new TextEncoder().encode(str)
  const buf  = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('')
}
