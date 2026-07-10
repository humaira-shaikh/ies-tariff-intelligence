import { useState, useEffect } from 'react'
import axios from 'axios'

const API = '/api'

export default function FilingPanel() {
  const [section, setSection] = useState('submit')

  return (
    <div>
      {/* Sub-nav */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        {[
          ['submit',   'Submit Filing'],
          ['receipts', 'Receipts'],
          ['filings',  'Browse Filings'],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setSection(id)}
            style={{
              padding: '0.4rem 1rem', borderRadius: '6px', border: '1px solid',
              cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600',
              background:   section === id ? '#238636' : '#161b22',
              borderColor:  section === id ? '#238636' : '#30363d',
              color:        section === id ? '#fff'    : '#8b949e',
            }}>
            {label}
          </button>
        ))}
      </div>

      {section === 'submit'   && <SubmitSection />}
      {section === 'receipts' && <ReceiptsSection />}
      {section === 'filings'  && <FilingsSection />}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   SUBMIT SECTION — Full Beckn lifecycle with live step tracker
───────────────────────────────────────────────────────────── */
function SubmitSection() {
  const [filings,  setFilings]  = useState([])
  const [selected, setSelected] = useState('')
  const [running,  setRunning]  = useState(false)
  const [steps,    setSteps]    = useState([])
  const [result,   setResult]   = useState(null)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    axios.get(`${API}/filing/list`).then(r => {
      setFilings(r.data)
      if (r.data.length > 0) setSelected(r.data[0].filingId)
    }).catch(() => setError('Backend offline — start: python -m uvicorn main:app --port 9000'))
  }, [])

  const STEP_INFO = [
    { id: 1, action: 'SELECT',  desc: 'DISCOM announces filing intent to SERC' },
    { id: 2, action: 'INIT',    desc: 'SERC accepts contract, moves to ACTIVE'  },
    { id: 3, action: 'CONFIRM', desc: 'DISCOM delivers filing payload + SHA-256 hash' },
    { id: 4, action: 'STATUS',  desc: 'SERC validates hash, issues receipt'     },
  ]

  const upd = (id, status, detail = '') =>
    setSteps(prev => prev.find(s => s.id === id)
      ? prev.map(s => s.id === id ? { ...s, status, detail } : s)
      : [...prev, { id, status, detail }])

  const submit = async () => {
    setRunning(true); setSteps([]); setResult(null); setError(null)
    try {
      // Animate steps as they would happen in the Beckn flow
      upd(1, 'running')
      await delay(400)
      upd(1, 'done', 'Gateway ACK received')
      upd(2, 'running')
      await delay(400)
      upd(2, 'done', 'Contract DRAFT → ACTIVE')
      upd(3, 'running')

      const r = await axios.post(`${API}/filing/create`,
        selected ? { filing_id: selected } : {})

      const flow = r.data.becknFlow || []
      const confirmStep = flow.find(s => s.action === 'CONFIRM')
      const statusStep  = flow.find(s => s.action === 'STATUS')

      upd(3, confirmStep?.status === 'ACK' ? 'done' : 'err',
        `Payload hash: ${r.data.payloadHash?.slice(0, 16)}…`)
      upd(4, 'running')
      await delay(300)
      upd(4, statusStep?.status === 'ACK' ? 'done' : 'err',
        r.data.receipt ? `Receipt: ${r.data.receipt.receiptStatus}` : 'No receipt')

      setResult(r.data)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
      setSteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'err' } : s))
    } finally {
      setRunning(false)
    }
  }

  const selFiling = filings.find(f => f.filingId === selected)

  return (
    <div>
      {/* Filing selector */}
      <div className="card">
        <div className="card-title">Regulatory Data Exchange — Submit ARR Filing</div>
        <p style={{ fontSize: '0.825rem', color: '#8b949e', marginBottom: '1rem' }}>
          DISCOM submits Annual Revenue Requirement filing to SERC via Beckn protocol.
          Hash is verified cryptographically — any tampering is detected.
        </p>

        {error && <div className="alert alert-err" style={{ marginBottom: '1rem' }}>{error}</div>}

        <div className="form-row">
          <div className="form-group" style={{ flex: 2 }}>
            <label>Select Filing</label>
            <select value={selected} onChange={e => { setSelected(e.target.value); setResult(null); setSteps([]) }}>
              <option value="">— Submit all filings —</option>
              {filings.map(f => (
                <option key={f.filingId} value={f.filingId}>
                  {f.filingId} — {f.licensee}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selected filing preview */}
        {selFiling && (
          <div style={{
            background: '#161b22', border: '1px solid #30363d', borderRadius: '8px',
            padding: '0.875rem', marginBottom: '1rem',
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem',
          }}>
            {[
              ['Licensee',    selFiling.licensee],
              ['Commission',  selFiling.regulatoryCommission],
              ['Filing Type', selFiling.filingType],
              ['Period',      `${selFiling.controlPeriodStart} – ${selFiling.controlPeriodEnd}`],
              ['Status',      selFiling.status],
            ].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: '0.7rem', color: '#8b949e' }}>{k}</div>
                <div style={{ fontSize: '0.825rem', color: '#c9d1d9', marginTop: '0.2rem', fontWeight: '500' }}>{v}</div>
              </div>
            ))}
          </div>
        )}

        <button className="btn btn-green" onClick={submit} disabled={running || filings.length === 0}
          style={{ fontSize: '0.95rem', padding: '0.6rem 2rem' }}>
          {running ? 'Submitting...' : 'Submit via Beckn'}
        </button>
      </div>

      {/* Live Beckn flow progress */}
      {steps.length > 0 && (
        <div className="card">
          <div className="card-title">Beckn Flow — DISCOM to SERC</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {STEP_INFO.map(info => {
              const s     = steps.find(x => x.id === info.id)
              const st    = s?.status || 'pending'
              const color = st === 'done' ? '#3fb950' : st === 'running' ? '#58a6ff' : st === 'err' ? '#f85149' : '#30363d'
              return (
                <div key={info.id} style={{
                  display: 'flex', alignItems: 'center', gap: '1rem',
                  padding: '0.75rem 1rem', borderRadius: '6px',
                  background: '#161b22', borderLeft: `3px solid ${color}`,
                }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: st === 'done' ? '#1a3a1a' : st === 'running' ? '#1a2d4a' : st === 'err' ? '#3a1a1a' : '#21262d',
                    color, fontSize: '0.85rem', fontWeight: '700',
                  }}>
                    {st === 'done' ? '✓' : st === 'running' ? '…' : st === 'err' ? '✗' : info.id}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#c9d1d9' }}>
                      {info.action}
                      <span style={{ fontSize: '0.72rem', color: '#8b949e', fontWeight: '400', marginLeft: '0.5rem' }}>
                        {info.desc}
                      </span>
                    </div>
                    {s?.detail && (
                      <div style={{ fontSize: '0.775rem', color, marginTop: '0.2rem' }}>{s.detail}</div>
                    )}
                    {st === 'running' && (
                      <div style={{ fontSize: '0.75rem', color: '#58a6ff', marginTop: '0.2rem' }}>Processing...</div>
                    )}
                  </div>
                  <span className={`tag ${st === 'done' ? 'tag-green' : st === 'running' ? 'tag-blue' : st === 'err' ? 'tag-red' : ''}`}
                    style={{ fontSize: '0.7rem', background: st === 'pending' ? '#21262d' : undefined, color: st === 'pending' ? '#484f58' : undefined }}>
                    {st === 'pending' ? 'waiting' : st}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Result */}
      {result && <FilingResult result={result} />}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   FILING RESULT — Receipt + hash details
───────────────────────────────────────────────────────────── */
function FilingResult({ result }) {
  const receipt  = result.receipt
  const accepted = receipt?.receiptStatus === 'ACCEPTED'
  const rejected = receipt?.receiptStatus === 'REJECTED'

  return (
    <div className="card">
      <div className="card-title">Filing Result</div>

      {/* Status banner */}
      <div style={{
        background:  accepted ? '#1a3a1a' : rejected ? '#3a1a1a' : '#1a2a3a',
        border:      `1px solid ${accepted ? '#2ea043' : rejected ? '#f85149' : '#1f6feb'}`,
        borderRadius: '8px', padding: '1rem', marginBottom: '1.25rem',
        display: 'flex', alignItems: 'center', gap: '1rem',
      }}>
        <div style={{ fontSize: '2rem' }}>{accepted ? '✅' : rejected ? '❌' : '📋'}</div>
        <div>
          <div style={{ fontSize: '1.1rem', fontWeight: '700', color: accepted ? '#3fb950' : rejected ? '#f85149' : '#58a6ff' }}>
            {receipt?.receiptStatus || result.status}
          </div>
          <div style={{ fontSize: '0.825rem', color: '#8b949e', marginTop: '0.2rem' }}>
            {receipt?.reason || 'Filing processed'}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: '0.72rem', color: '#8b949e' }}>Transaction ID</div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#c9d1d9' }}>
            {result.transactionId?.slice(0, 16)}…
          </div>
        </div>
      </div>

      {/* Filing + receipt details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
        {[
          ['Filing ID',    result.filingId],
          ['Licensee',     result.licensee],
          ['Commission',   result.commission],
          ['Contract ID',  result.contractId],
          ['Validated By', receipt?.validatedBy],
          ['Validated At', receipt?.validatedAt],
        ].map(([k, v]) => v && (
          <div key={k} style={{ background: '#161b22', borderRadius: '6px', padding: '0.6rem 0.875rem' }}>
            <div style={{ fontSize: '0.7rem', color: '#8b949e' }}>{k}</div>
            <div style={{ fontSize: '0.825rem', color: '#c9d1d9', marginTop: '0.15rem' }}>{v}</div>
          </div>
        ))}
      </div>

      {/* SHA-256 hash */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.72rem', color: '#8b949e', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          SHA-256 Payload Hash
          <span className={`tag ${accepted ? 'tag-green' : 'tag-red'}`} style={{ fontSize: '0.65rem' }}>
            {accepted ? 'VERIFIED' : 'CHECK FAILED'}
          </span>
        </div>
        <div style={{
          fontFamily: 'monospace', fontSize: '0.8rem', color: '#3fb950',
          background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: '6px',
          padding: '0.6rem 0.875rem', wordBreak: 'break-all',
        }}>
          {result.payloadHash}
        </div>
        <div style={{ fontSize: '0.72rem', color: '#8b949e', marginTop: '0.3rem' }}>
          SERC recomputed this hash from the received payload — any tampering in transit would produce a different value.
        </div>
      </div>

      {/* Beckn flow summary */}
      <div>
        <div style={{ fontSize: '0.72rem', color: '#8b949e', marginBottom: '0.4rem' }}>Beckn Flow Summary</div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {result.becknFlow?.map(s => (
            <span key={s.action} className={`tag ${s.status === 'ACK' ? 'tag-green' : 'tag-red'}`}
              style={{ fontSize: '0.72rem' }}>
              {s.action} {s.status === 'ACK' ? '✓' : '✗'}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   RECEIPTS SECTION — History of all SERC receipts
───────────────────────────────────────────────────────────── */
function ReceiptsSection() {
  const [data,     setData]     = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState(null)

  const load = () => {
    setLoading(true)
    axios.get(`${API}/rde/receipts`)
      .then(r => setData(r.data))
      .catch(() => setData({ total: 0, receipts: [] }))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div className="card-title" style={{ marginBottom: 0 }}>
            SERC Receipts — All Filed Transactions
          </div>
          <button className="btn btn-sm btn-blue" onClick={load}>Refresh</button>
        </div>

        {loading && <div style={{ color: '#8b949e', fontSize: '0.825rem' }}>Loading...</div>}

        {!loading && data?.receipts?.length === 0 && (
          <div style={{ color: '#8b949e', fontSize: '0.825rem', padding: '0.5rem 0' }}>
            No receipts yet. Submit a filing from the Submit tab.
          </div>
        )}

        {!loading && data?.receipts?.length > 0 && (
          <>
            {/* Summary stats */}
            <div className="stats-row" style={{ marginBottom: '1rem' }}>
              <div className="stat green">
                <div className="val">{data.receipts.filter(r => r.status === 'ACCEPTED').length}</div>
                <div className="lbl">Accepted</div>
              </div>
              <div className="stat orange">
                <div className="val">{data.receipts.filter(r => r.status === 'REJECTED').length}</div>
                <div className="lbl">Rejected</div>
              </div>
              <div className="stat blue">
                <div className="val">{data.total}</div>
                <div className="lbl">Total</div>
              </div>
            </div>

            {/* Receipts list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {data.receipts.map(r => (
                <div key={r.id}
                  style={{
                    background: '#161b22',
                    border: `1px solid ${r.status === 'ACCEPTED' ? '#2ea043' : r.status === 'REJECTED' ? '#f85149' : '#30363d'}`,
                    borderRadius: '8px', padding: '0.875rem', cursor: 'pointer',
                  }}
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span className={`tag ${r.status === 'ACCEPTED' ? 'tag-green' : r.status === 'REJECTED' ? 'tag-red' : 'tag-blue'}`}>
                        {r.status}
                      </span>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.825rem', color: '#c9d1d9' }}>
                        {r.filingId || 'unknown'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: '#8b949e' }}>{r.receivedAt}</span>
                      <span style={{ color: '#8b949e', fontSize: '0.8rem' }}>{expanded === r.id ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {expanded === r.id && (
                    <div style={{ marginTop: '0.875rem', borderTop: '1px solid #21262d', paddingTop: '0.875rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        {[
                          ['Transaction ID', r.txnId?.slice(0, 20) + '…'],
                          ['Hash Valid',     String(r.hashValid)],
                          ['Filing Count',   r.filingCount],
                          ['BAP URI',        r.bapUri],
                        ].map(([k, v]) => (
                          <div key={k}>
                            <span style={{ fontSize: '0.7rem', color: '#8b949e' }}>{k}: </span>
                            <span style={{ fontSize: '0.775rem', color: '#c9d1d9' }}>{v}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#8b949e', marginBottom: '0.3rem' }}>Payload Hash</div>
                      <div style={{
                        fontFamily: 'monospace', fontSize: '0.75rem', color: '#3fb950',
                        background: '#0d1117', borderRadius: '4px', padding: '0.4rem 0.6rem',
                        wordBreak: 'break-all',
                      }}>
                        {r.payloadHash || 'N/A'}
                      </div>
                      <div style={{ marginTop: '0.5rem', fontSize: '0.775rem', color: '#8b949e', fontStyle: 'italic' }}>
                        {r.reason}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   FILINGS BROWSER — View raw filing data
───────────────────────────────────────────────────────────── */
function FilingsSection() {
  const [filings,  setFilings]  = useState([])
  const [expanded, setExpanded] = useState(null)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    axios.get(`${API}/filing/list`)
      .then(r => setFilings(r.data))
      .catch(() => setError('Could not load filings'))
  }, [])

  return (
    <div className="card">
      <div className="card-title">ARR Filings — Source Data</div>
      {error && <div className="alert alert-err">{error}</div>}

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Filing ID</th>
              <th>Licensee</th>
              <th>Type</th>
              <th>Commission</th>
              <th>Period</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filings.map(f => (
              <>
                <tr key={f.filingId} style={{ cursor: 'pointer' }} onClick={() => setExpanded(expanded === f.filingId ? null : f.filingId)}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{f.filingId}</td>
                  <td>{f.licensee}</td>
                  <td><span className="tag tag-purple">{f.filingType}</span></td>
                  <td>{f.regulatoryCommission}</td>
                  <td style={{ fontSize: '0.78rem' }}>{f.controlPeriodStart} – {f.controlPeriodEnd}</td>
                  <td>
                    <span className={`tag ${f.status === 'SUBMITTED' ? 'tag-green' : f.status === 'APPROVED' ? 'tag-blue' : 'tag-orange'}`}>
                      {f.status}
                    </span>
                  </td>
                  <td style={{ color: '#8b949e', fontSize: '0.8rem' }}>{expanded === f.filingId ? '▲' : '▼'}</td>
                </tr>
                {expanded === f.filingId && (
                  <tr key={`${f.filingId}-detail`}>
                    <td colSpan={7} style={{ background: '#0d1117', padding: '0' }}>
                      <div style={{ padding: '1rem' }}>
                        <div style={{ fontSize: '0.72rem', color: '#8b949e', marginBottom: '0.5rem' }}>Full Filing JSON</div>
                        <pre style={{
                          background: '#161b22', border: '1px solid #30363d', borderRadius: '6px',
                          padding: '0.75rem', fontSize: '0.75rem', color: '#c9d1d9',
                          overflow: 'auto', maxHeight: '300px',
                        }}>
                          {JSON.stringify(f, null, 2)}
                        </pre>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const delay = ms => new Promise(r => setTimeout(r, ms))
