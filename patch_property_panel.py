import re

with open('src/components/PropertyInfoPanel.jsx', 'r') as f:
    code = f.read()

# Add icons
code = code.replace("FiRefreshCw, FiChevronRight, FiCheckCircle", "FiRefreshCw, FiChevronRight, FiCheckCircle, FiEye, FiEyeOff")

# Add showPartyDetails state
code = code.replace(
    "const [isFullscreen, setIsFullscreen] = useState(false);",
    "const [isFullscreen, setIsFullscreen] = useState(false);\n  const [showPartyDetails, setShowPartyDetails] = useState(false);"
)

# Add to formData
target_state = r"""    type: '',
    remarks: ''
  \}\);"""
repl_state = """    type: '',
    remarks: '',
    partyName: '',
    partyPhone: '',
    brokerName: '',
    brokerPhone: ''
  });"""
code = re.sub(target_state, repl_state, code)

target_effect = r"""        type: displayFeature\.data\.type \|\| '',
        remarks: displayFeature\.data\.remarks \|\| ''
      \}\);"""
repl_effect = """        type: displayFeature.data.type || '',
        remarks: displayFeature.data.remarks || '',
        partyName: displayFeature.data.partyName || '',
        partyPhone: displayFeature.data.partyPhone || '',
        brokerName: displayFeature.data.brokerName || '',
        brokerPhone: displayFeature.data.brokerPhone || ''
      });"""
code = re.sub(target_effect, repl_effect, code)

target_save = r"""      type: formData\.type,
      remarks: formData\.remarks
    \};"""
repl_save = """      type: formData.type,
      remarks: formData.remarks,
      partyName: formData.partyName,
      partyPhone: formData.partyPhone,
      brokerName: formData.brokerName,
      brokerPhone: formData.brokerPhone
    };"""
code = re.sub(target_save, repl_save, code)

target_ui = r"""          <div>
            <label style=\{\{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4 \}\}>Remarks</label>"""
repl_ui = """
          {isEdit && (
            <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: 'rgba(30, 41, 59, 0.4)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowPartyDetails(!showPartyDetails)}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b' }}>Party Details (Private)</span>
                <button type="button" style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}>
                  {showPartyDetails ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
              
              {showPartyDetails && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
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
          )}

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>Remarks</label>"""
code = re.sub(target_ui, repl_ui, code)

with open('src/components/PropertyInfoPanel.jsx', 'w') as f:
    f.write(code)

