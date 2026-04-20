import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import axios from 'axios'

const API = 'http://localhost:9000/api'

export default function PolicyDetail() {
  const { policyId } = useParams()
  const navigate     = useNavigate()
  const [policy, setPolicy] = useState(null)
  const [bill,   setBill]   = useState(null)
  const [units,  setUnits]  = useState(300)
  const [night,  setNight]  = useState(false)

  useEffect(() => {
    axios.get(`${API}/tariff/policies`).then(r => {
      const found = r.data.find(p => p.policyID === policyId)
      setPolicy(found)
    })
  }, [policyId])

  const calculate = async () => {
    const r = await axios.post(`${API}/tariff/calculate`, {
      policyId: policyId, unitsConsumed: units, nightUsage: night
    })
    setBill(r.data)
  }

  if (!policy) return (
    <div style={{background:'#0a0e1a',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{color:'#8b949e'}}>Loading...</div>
    </div>
  )

  return (
    <div style={{background:'#0a0e1a', minHeight:'100vh', fontFamily:'Segoe UI,sans-serif', color:'#e2e8f0'}}>

      {/* Header */}
      <div style={{background:'#0d1117', borderBottom:'1px solid #1e2d3d', padding:'16px 40px', display:'flex', alignItems:'center', gap:'16px'}}>
        <button onClick={() => navigate(-1)}
          style={{background:'#161b22', border:'1px solid #30363d', color:'#8b949e',
            borderRadius:'6px', padding:'6px 14px', cursor:'pointer', fontSize:'13px'}}>
          ← Back
        </button>
        <div>
          <div style={{fontSize:'11px', color:'#484f58', letterSpacing:'1px', textTransform:'uppercase'}}>Tariff Policy Detail</div>
          <div style={{fontSize:'18px', fontWeight:'700', color:'#58a6ff'}}>{policy.policyID} — {policy.policyName}</div>
        </div>
      </div>

      <div style={{maxWidth:'900px', margin:'0 auto', padding:'30px 40px'}}>

        {/* Meta info */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'16px', marginBottom:'24px'}}>
          {[
            ['Policy ID',    policy.policyID],
            ['Program',      policy.programID],
            ['Type',         policy.policyType],
            ['Created',      policy.createdDateTime?.slice(0,10)],
            ['Valid From',   policy.samplingInterval?.slice(2,12) || '—'],
            ['Total Slabs',  policy.energySlabs?.length],
          ].map(([k,v]) => (
            <div key={k} style={{background:'#161b22', borderRadius:'8px', padding:'14px 16px', border:'1px solid #1e2d3d'}}>
              <div style={{fontSize:'11px', color:'#8b949e', marginBottom:'4px'}}>{k}</div>
              <div style={{fontSize:'14px', color:'#c9d1d9', fontWeight:'600'}}>{v}</div>
            </div>
          ))}
        </div>

        {/* Energy Slabs */}
        <div style={{background:'#0d1117', border:'1px solid #1e2d3d', borderRadius:'10px', padding:'24px', marginBottom:'20px'}}>
          <div style={{fontSize:'13px', fontWeight:'700', color:'#8b949e', letterSpacing:'1px', textTransform:'uppercase', marginBottom:'16px'}}>
            Energy Rate Slabs
          </div>

          {/* Visual bar */}
          <div style={{display:'flex', height:'8px', borderRadius:'4px', overflow:'hidden', marginBottom:'20px'}}>
            {policy.energySlabs?.map((s, i) => {
              const colors = ['#1f6feb','#2ea043','#6e40c9','#d04f00','#c9252d']
              return <div key={s.id} style={{flex:1, background:colors[i % colors.length]}} />
            })}
          </div>

          <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
            {policy.energySlabs?.map((s, i) => {
              const colors = ['#58a6ff','#3fb950','#bc8cff','#f0883e','#f85149']
              return (
                <div key={s.id} style={{display:'flex', alignItems:'center', gap:'16px',
                  background:'#161b22', borderRadius:'8px', padding:'12px 16px',
                  borderLeft:`3px solid ${colors[i % colors.length]}`}}>
                  <div style={{minWidth:'24px', fontSize:'13px', color:'#484f58', fontWeight:'700'}}>#{i+1}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:'13px', color:'#c9d1d9'}}>
                      <strong>{s.start}</strong> – <strong>{s.end ?? '∞'}</strong> kWh
                    </div>
                    <div style={{fontSize:'11px', color:'#8b949e', marginTop:'2px'}}>
                      {s.end ? `First ${s.end} units in this range` : 'All units above this'}
                    </div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:'20px', fontWeight:'700', color:colors[i%colors.length]}}>
                      ₹{s.price}
                    </div>
                    <div style={{fontSize:'11px', color:'#8b949e'}}>per kWh</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Surcharges */}
        {policy.surchargeTariffs?.length > 0 && (
          <div style={{background:'#0d1117', border:'1px solid #1e2d3d', borderRadius:'10px', padding:'24px', marginBottom:'20px'}}>
            <div style={{fontSize:'13px', fontWeight:'700', color:'#8b949e', letterSpacing:'1px', textTransform:'uppercase', marginBottom:'16px'}}>
              Surcharges / Time-of-Day Adjustments
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
              {policy.surchargeTariffs.map(s => (
                <div key={s.id} style={{display:'flex', alignItems:'center', gap:'16px',
                  background:'#161b22', borderRadius:'8px', padding:'12px 16px',
                  borderLeft:`3px solid ${s.value < 0 ? '#2ea043' : '#d04f00'}`}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:'13px', color:'#c9d1d9', fontWeight:'600'}}>{s.id}</div>
                    <div style={{fontSize:'11px', color:'#8b949e', marginTop:'3px'}}>
                      Time: {s.interval?.start?.replace('T','').replace('Z','')} · Duration: {s.interval?.duration?.replace('PT','').replace('H',' hrs')} · {s.recurrence==='P1D'?'Daily':'Monthly'}
                    </div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:'18px', fontWeight:'700', color: s.value < 0 ? '#3fb950' : '#f0883e'}}>
                      {s.value > 0 ? '+' : ''}{s.value} {s.unit === 'PERCENT' ? '%' : '₹/kWh'}
                    </div>
                    <div style={{fontSize:'11px', color:'#8b949e'}}>{s.value < 0 ? 'Discount' : 'Surcharge'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Bill Calculator */}
        <div style={{background:'#0d1117', border:'1px solid #238636', borderRadius:'10px', padding:'24px'}}>
          <div style={{fontSize:'13px', fontWeight:'700', color:'#8b949e', letterSpacing:'1px', textTransform:'uppercase', marginBottom:'16px'}}>
            Quick Bill Calculator
          </div>
          <div style={{display:'flex', gap:'12px', alignItems:'flex-end', flexWrap:'wrap'}}>
            <div>
              <div style={{fontSize:'12px', color:'#8b949e', marginBottom:'4px'}}>Units Consumed (kWh)</div>
              <input type="number" value={units} min={1} onChange={e=>setUnits(parseFloat(e.target.value))}
                style={{background:'#161b22', border:'1px solid #30363d', borderRadius:'6px',
                  color:'#e2e8f0', padding:'8px 12px', fontSize:'14px', width:'120px', outline:'none'}} />
            </div>
            <div>
              <div style={{fontSize:'12px', color:'#8b949e', marginBottom:'4px'}}>Time</div>
              <label style={{display:'flex', alignItems:'center', gap:'6px', cursor:'pointer', fontSize:'13px', color:'#8b949e'}}>
                <input type="checkbox" checked={night} onChange={e=>setNight(e.target.checked)} />
                Night use
              </label>
            </div>
            <button onClick={calculate}
              style={{background:'#238636', border:'none', color:'#fff',
                borderRadius:'6px', padding:'9px 20px', cursor:'pointer', fontSize:'14px', fontWeight:'600'}}>
              Calculate Bill
            </button>
          </div>

          {bill && (
            <div style={{marginTop:'16px', background:'#161b22', borderRadius:'8px', padding:'16px'}}>
              <div style={{textAlign:'center', fontSize:'32px', fontWeight:'700', color:'#3fb950', marginBottom:'12px'}}>
                ₹ {bill.totalAmount?.toFixed(2)}
              </div>
              <div style={{display:'flex', gap:'12px', justifyContent:'center', marginBottom:'12px'}}>
                <span style={{fontSize:'12px', color:'#8b949e'}}>Base: <strong style={{color:'#c9d1d9'}}>₹{bill.baseAmount?.toFixed(2)}</strong></span>
                {bill.surchargeAmount !== 0 && <span style={{fontSize:'12px', color:'#8b949e'}}>Surcharge: <strong style={{color: bill.surchargeAmount<0?'#3fb950':'#f0883e'}}>₹{bill.surchargeAmount?.toFixed(2)}</strong></span>}
              </div>
              <table style={{width:'100%', borderCollapse:'collapse', fontSize:'12px'}}>
                <thead><tr style={{borderBottom:'1px solid #30363d'}}>
                  <th style={{textAlign:'left', padding:'6px', color:'#8b949e'}}>Slab</th>
                  <th style={{textAlign:'left', padding:'6px', color:'#8b949e'}}>Units</th>
                  <th style={{textAlign:'left', padding:'6px', color:'#8b949e'}}>Rate</th>
                  <th style={{textAlign:'right', padding:'6px', color:'#8b949e'}}>Amount</th>
                </tr></thead>
                <tbody>
                  {bill.slabBreakdown?.map(s => (
                    <tr key={s.slabId} style={{borderBottom:'1px solid #21262d'}}>
                      <td style={{padding:'6px', color:'#58a6ff'}}>{s.slabId}</td>
                      <td style={{padding:'6px', color:'#c9d1d9'}}>{s.units} kWh</td>
                      <td style={{padding:'6px', color:'#c9d1d9'}}>₹{s.rate}/kWh</td>
                      <td style={{padding:'6px', color:'#3fb950', textAlign:'right'}}>₹{s.amount?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
