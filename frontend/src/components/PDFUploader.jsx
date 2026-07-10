import { useState, useRef } from 'react'
import axios from 'axios'

const API = '/api'

export default function PDFUploader({ onPolicyAdded }) {
  const [dragging,   setDragging]   = useState(false)
  const [uploading,  setUploading]  = useState(false)
  const [result,     setResult]     = useState(null)
  const [error,      setError]      = useState(null)
  const fileRef                     = useRef()

  const upload = async (file) => {
    if (!file || !file.name.endsWith('.pdf')) {
      setError('Please upload a PDF file'); return
    }
    setUploading(true); setError(null); setResult(null)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const r = await axios.post(`${API}/tariff/upload-pdf`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setResult(r.data)
      if (r.data.saved && onPolicyAdded) onPolicyAdded(r.data)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    } finally { setUploading(false) }
  }

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) upload(file)
  }

  return (
    <div style={{ maxWidth: 900 }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(120deg,#0F172A,#1652F0)',
        borderRadius: 14, padding: '1.5rem 2rem', marginBottom: '1.5rem', color: '#fff',
      }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>PDF → IES Policy</div>
        <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>Upload Real SERC Tariff PDF</div>
        <div style={{ fontSize: '0.825rem', opacity: 0.8, marginTop: 4 }}>
          Upload any SERC tariff order PDF. We extract the energy slabs and convert them into a machine-readable IES policy — instantly available via your BPP.
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? '#1652F0' : '#CBD5E1'}`,
          borderRadius: 16, padding: '3rem 2rem', textAlign: 'center',
          background: dragging ? '#EFF6FF' : '#F8FAFF',
          cursor: 'pointer', transition: 'all 0.2s',
          marginBottom: '1.5rem',
        }}>
        <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }}
          onChange={e => { if (e.target.files[0]) upload(e.target.files[0]) }} />
        <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📄</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1E293B', marginBottom: '0.4rem' }}>
          Drop SERC Tariff PDF here
        </div>
        <div style={{ fontSize: '0.875rem', color: '#64748B', marginBottom: '1rem' }}>
          or click to browse · PDF files only · Max 50 MB
        </div>
        <div style={{
          display: 'inline-block', padding: '0.5rem 1.5rem',
          background: '#1652F0', color: '#fff', borderRadius: 8,
          fontSize: '0.875rem', fontWeight: 600,
        }}>
          {uploading ? '⏳ Parsing PDF...' : 'Choose File'}
        </div>
      </div>

      {/* Supported formats info */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { icon: '🏛️', title: 'SERC Orders',   desc: 'Karnataka KERC, Punjab PSERC, Delhi DERC, Maharashtra MERC and more' },
          { icon: '📊', title: 'Tariff Tables',  desc: 'Slab structure auto-extracted. Handles units, kWh, ₹/unit formats' },
          { icon: '⚡', title: 'Instant Publish', desc: 'Parsed policy saved to BPP immediately — discoverable via Beckn' },
        ].map(item => (
          <div key={item.title} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: '1rem' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>{item.icon}</div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1E293B', marginBottom: '0.3rem' }}>{item.title}</div>
            <div style={{ fontSize: '0.78rem', color: '#64748B', lineHeight: 1.5 }}>{item.desc}</div>
          </div>
        ))}
      </div>

      {error && <div className="alert alert-err">{error}</div>}

      {/* Result */}
      {result && (
        <div className="card">
          {/* Status banner */}
          <div style={{
            background: result.totalPoliciesAdded > 0 ? '#F0FDF4' : '#FFF7ED',
            border: `1px solid ${result.totalPoliciesAdded > 0 ? '#BBF7D0' : '#FED7AA'}`,
            borderRadius: 10, padding: '1rem', marginBottom: '1.25rem',
            display: 'flex', gap: '1rem', alignItems: 'center',
          }}>
            <span style={{ fontSize: '2rem' }}>{result.totalPoliciesAdded > 0 ? '✅' : '⚠️'}</span>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: result.totalPoliciesAdded > 0 ? '#059669' : '#EA580C' }}>
                {result.totalPoliciesAdded > 0
                  ? `${result.totalPoliciesAdded} ${result.totalPoliciesAdded === 1 ? 'Policy' : 'Policies'} Parsed & Published to BPP`
                  : 'Parsed — Policies already exist (not duplicated)'}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: 4 }}>
                {result.totalSlabsFound > 0
                  ? `${result.totalSlabsFound} energy slabs extracted · ${result.strategies?.tableRows || 0} table rows scanned`
                  : 'Tariff table appears to be in image format — use Policy Generator to enter rates manually'}
              </div>
            </div>
          </div>

          {/* Saved policy IDs */}
          {result.savedPolicies?.length > 0 && (
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
                Policies Added to BPP
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {result.savedPolicies.map(id => (
                  <span key={id} className="tag tag-green" style={{ fontSize: '0.78rem', fontFamily: 'monospace' }}>{id}</span>
                ))}
              </div>
            </div>
          )}

          {/* Parsed details */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {[
              ['State',           result.state],
              ['Commission',      result.commission],
              ['FY Year',         result.fyYear],
              ['Consumer Type',   result.consumerType],
              ['Slabs (primary)', `${result.slabsFound}`],
              ['Category Policies', `${result.multiPolicies || 0}`],
            ].map(([k,v]) => (
              <div key={k} style={{ background: '#F8FAFF', borderRadius: 8, padding: '0.6rem 0.875rem' }}>
                <div style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k}</div>
                <div style={{ fontSize: '0.875rem', color: '#1E293B', marginTop: '0.15rem', fontWeight: 600 }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Extracted slabs */}
          {result.policy?.energySlabs?.length > 0 && (
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
                Extracted Energy Slabs
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {result.policy.energySlabs.map((s, i) => {
                  const colors = ['#1652F0','#059669','#7C3AED','#EA580C','#DC2626']
                  return (
                    <div key={i} style={{
                      background: '#F8FAFF', border: `1.5px solid ${colors[i%5]}33`,
                      borderRadius: 8, padding: '0.5rem 0.875rem', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '0.65rem', color: '#94A3B8' }}>{s.start}–{s.end ?? '∞'} kWh</div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: colors[i%5] }}>₹{s.price}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {result.policy?.energySlabs?.length === 0 && (
            <div className="alert alert-info">
              No slab data extracted automatically. The PDF may use a non-standard format or be a scanned image.
              Use the <strong>Policy Generator</strong> to manually enter the slabs from the PDF.
            </div>
          )}

          {/* Text preview */}
          <div>
            <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginBottom: '0.4rem', fontWeight: 700, textTransform: 'uppercase' }}>
              Extracted Text Preview
            </div>
            <div style={{
              fontFamily: 'monospace', fontSize: '0.72rem', color: '#475569',
              background: '#F8FAFF', border: '1px solid #E2E8F0', borderRadius: 8,
              padding: '0.75rem', maxHeight: 150, overflowY: 'auto', whiteSpace: 'pre-wrap',
            }}>
              {result.textPreview || 'No text extracted'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
