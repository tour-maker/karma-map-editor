import { useState, useEffect, useRef } from 'react';

export default function SearchableSelect({ value, options, onChange, disabled, placeholder = "Select Location" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);
  
  const filteredOptions = options.filter(opt => opt.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #334155',
          fontSize: 13, color: 'white', background: disabled ? 'rgba(30, 41, 59, 0.4)' : '#0f172a',
          cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          boxSizing: 'border-box'
        }}
      >
        <span style={{ opacity: value ? 1 : 0.6 }}>{value || placeholder}</span>
        <span style={{ fontSize: 10, color: '#94a3b8' }}>▼</span>
      </div>
      
      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999, marginTop: 4,
          background: '#1e293b', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: 8,
          maxHeight: 220, overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
        }}>
          <div style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', position: 'sticky', top: 0, background: '#1e293b' }}>
             <input 
                type="text" 
                autoFocus
                placeholder="Search or type new..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{
                  width: '100%', padding: '6px 8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4,
                  color: '#e2e8f0', outline: 'none', boxSizing: 'border-box', fontSize: 13
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchTerm) {
                    onChange(searchTerm);
                    setIsOpen(false);
                    setSearchTerm('');
                    e.preventDefault();
                  }
                }}
              />
          </div>
          
          {filteredOptions.length === 0 ? (
            <div 
                style={{ padding: '10px 12px', color: '#f59e0b', fontSize: 12, cursor: 'pointer' }}
                onClick={() => {
                  if (searchTerm) {
                    onChange(searchTerm);
                    setIsOpen(false);
                    setSearchTerm('');
                  }
                }}
            >
              Press Enter to add "{searchTerm}"
            </div>
          ) : (
            filteredOptions.map(opt => (
              <div 
                key={opt}
                onClick={() => {
                  onChange(opt);
                  setIsOpen(false);
                  setSearchTerm('');
                }}
                style={{
                  padding: '10px 12px', cursor: 'pointer', fontSize: 13, color: '#cbd5e1',
                  background: value === opt ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseOut={(e) => e.currentTarget.style.background = value === opt ? 'rgba(245, 158, 11, 0.2)' : 'transparent'}
              >
                {opt}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
