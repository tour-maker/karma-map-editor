import re

with open('src/components/PropertyInfoPanel.jsx', 'r') as f:
    code = f.read()

# 1. Remove the current Party Details block
target_remove = r"""          \{isEdit && \(
            <div style=\{\{ marginTop: 8, padding: 12, borderRadius: 12, background: 'rgba\(30, 41, 59, 0\.4\)', border: '1px solid rgba\(255, 255, 255, 0\.1\)' \}\}>
              <div style=\{\{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' \}\} onClick=\{\(\) => setShowPartyDetails\(!showPartyDetails\)\}>
                <span style=\{\{ fontSize: 13, fontWeight: 700, color: '#f59e0b' \}\}>Party Details \(Private\)</span>
                <button type="button" style=\{\{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex' \}\}>
                  \{showPartyDetails \? <FiEyeOff size=\{16\} /> : <FiEye size=\{16\} />\}
                </button>
              </div>
              
              \{showPartyDetails && \(
                <div style=\{\{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 \}\}>
                  <div style=\{\{ display: 'flex', gap: 10 \}\}>
                    <div style=\{\{ flex: 1 \}\}>
                      <label style=\{\{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 4 \}\}>Party Name</label>
                      <input
                        type="text"
                        value=\{formData\.partyName\}
                        onChange=\{\(e\) => handleChange\('partyName', e\.target\.value\)\}
                        placeholder="Name"
                        style=\{\{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid rgba\(255,255,255,0\.1\)', fontSize: 12, color: '#fff', background: 'rgba\(15, 23, 42, 0\.5\)', outline: 'none', boxSizing: 'border-box' \}\}
                      />
                    </div>
                    <div style=\{\{ flex: 1 \}\}>
                      <label style=\{\{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 4 \}\}>Party Phone</label>
                      <input
                        type="text"
                        value=\{formData\.partyPhone\}
                        onChange=\{\(e\) => handleChange\('partyPhone', e\.target\.value\)\}
                        placeholder="Phone No"
                        style=\{\{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid rgba\(255,255,255,0\.1\)', fontSize: 12, color: '#fff', background: 'rgba\(15, 23, 42, 0\.5\)', outline: 'none', boxSizing: 'border-box' \}\}
                      />
                    </div>
                  </div>
                  <div style=\{\{ display: 'flex', gap: 10 \}\}>
                    <div style=\{\{ flex: 1 \}\}>
                      <label style=\{\{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 4 \}\}>Broker Name</label>
                      <input
                        type="text"
                        value=\{formData\.brokerName\}
                        onChange=\{\(e\) => handleChange\('brokerName', e\.target\.value\)\}
                        placeholder="Broker"
                        style=\{\{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid rgba\(255,255,255,0\.1\)', fontSize: 12, color: '#fff', background: 'rgba\(15, 23, 42, 0\.5\)', outline: 'none', boxSizing: 'border-box' \}\}
                      />
                    </div>
                    <div style=\{\{ flex: 1 \}\}>
                      <label style=\{\{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 4 \}\}>Broker Phone</label>
                      <input
                        type="text"
                        value=\{formData\.brokerPhone\}
                        onChange=\{\(e\) => handleChange\('brokerPhone', e\.target\.value\)\}
                        placeholder="Phone No"
                        style=\{\{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid rgba\(255,255,255,0\.1\)', fontSize: 12, color: '#fff', background: 'rgba\(15, 23, 42, 0\.5\)', outline: 'none', boxSizing: 'border-box' \}\}
                      />
                    </div>
                  </div>
                </div>
              \)\}
            </div>
          \)\}

"""
code = re.sub(target_remove, "", code)

# 2. Add it after the Remarks field
target_remarks = r"""          <div>
            <label style=\{\{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4 \}\}>Remarks</label>
            <textarea
              value=\{formData\.remarks\}
              onChange=\{\(e\) => handleChange\('remarks', e\.target\.value\)\}
              disabled=\{!isEdit\}
              rows=\{3\}
              style=\{\{
                width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba\(99,102,241,0\.35\)',
                fontSize: 13, color: '#e2e8f0', background: isEdit \? 'rgba\(30, 41, 59, 0\.8\)' : 'rgba\(30, 41, 59, 0\.4\)',
                outline: 'none', boxSizing: 'border-box', resize: 'vertical'
              \}\}
            />
          </div>"""

repl_party_details = """          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>Remarks</label>
            <textarea
              value={formData.remarks}
              onChange={(e) => handleChange('remarks', e.target.value)}
              disabled={!isEdit}
              rows={3}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.35)',
                fontSize: 13, color: '#e2e8f0', background: isEdit ? 'rgba(30, 41, 59, 0.8)' : 'rgba(30, 41, 59, 0.4)',
                outline: 'none', boxSizing: 'border-box', resize: 'vertical'
              }}
            />
          </div>
          
          {isEdit && (
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <button 
                type="button" 
                onClick={() => setShowPartyDetails(!showPartyDetails)}
                title="Private Details"
                style={{ 
                  background: 'none', border: 'none', cursor: 'pointer', display: 'flex', 
                  alignItems: 'center', justifyContent: 'center', padding: '4px',
                  color: showPartyDetails ? '#f59e0b' : 'rgba(148, 163, 184, 0.4)', 
                  transition: 'color 0.2s'
                }}
              >
                {showPartyDetails ? <FiEye size={14} /> : <FiEyeOff size={14} />}
              </button>
              
              {showPartyDetails && (
                <div style={{ 
                  marginTop: 4, padding: 12, borderRadius: 12, background: 'rgba(15, 23, 42, 0.6)', 
                  border: '1px solid rgba(245, 158, 11, 0.2)', width: '100%', boxSizing: 'border-box',
                  display: 'flex', flexDirection: 'column', gap: 10 
                }}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>Party Name</label>
                      <input
                        type="text"
                        value={formData.partyName}
                        onChange={(e) => handleChange('partyName', e.target.value)}
                        placeholder="Name"
                        style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', fontSize: 12, color: '#fff', background: 'rgba(15, 23, 42, 0.5)', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>Party Phone</label>
                      <input
                        type="text"
                        value={formData.partyPhone}
                        onChange={(e) => handleChange('partyPhone', e.target.value)}
                        placeholder="Phone No"
                        style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', fontSize: 12, color: '#fff', background: 'rgba(15, 23, 42, 0.5)', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>Broker Name</label>
                      <input
                        type="text"
                        value={formData.brokerName}
                        onChange={(e) => handleChange('brokerName', e.target.value)}
                        placeholder="Broker"
                        style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', fontSize: 12, color: '#fff', background: 'rgba(15, 23, 42, 0.5)', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>Broker Phone</label>
                      <input
                        type="text"
                        value={formData.brokerPhone}
                        onChange={(e) => handleChange('brokerPhone', e.target.value)}
                        placeholder="Phone No"
                        style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', fontSize: 12, color: '#fff', background: 'rgba(15, 23, 42, 0.5)', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}"""

code = re.sub(target_remarks, repl_party_details, code)

with open('src/components/PropertyInfoPanel.jsx', 'w') as f:
    f.write(code)

