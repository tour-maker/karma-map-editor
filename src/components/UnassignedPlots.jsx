import { useState, useMemo } from 'react';
import { FiMove } from 'react-icons/fi';
import { describeOrigin } from '../utils/areaLog';

const formatDate = (d) => d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';

// The "Unassigned" holding bucket: every plot waiting here, where it used to live, and a way to
// move it (one plot, or all of them) into a real area or sub-area. `destinations` is
// [{ parent, sub }] where sub is '' for a plot that sits directly under its Primary.
export default function UnassignedPlots({ plots, origins, destinations, onMove, isDark }) {
  const [chooser, setChooser] = useState(null); // plot id, 'all', or null
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return destinations.filter(d => !q || `${d.parent} ${d.sub}`.toLowerCase().includes(q));
  }, [destinations, search]);

  const text = isDark ? '#e2e8f0' : '#0f172a';
  const muted = isDark ? '#94a3b8' : '#64748b';

  const choose = async (dest) => {
    if (busy) return;
    setBusy(true);
    try {
      await onMove(chooser === 'all' ? plots.map(p => p.id) : [chooser], dest);
    } finally {
      setBusy(false);
      setChooser(null);
      setSearch('');
    }
  };

  const chooserBox = (
    <div onClick={(e) => e.stopPropagation()} style={{
      marginTop: 6, padding: 8, borderRadius: 10,
      background: isDark ? 'rgba(15, 23, 42, 0.95)' : '#fff', border: '1px solid rgba(56, 189, 248, 0.4)'
    }}>
      <input
        autoFocus
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search areas..."
        style={{
          width: '100%', boxSizing: 'border-box', padding: '6px 9px', borderRadius: 8, marginBottom: 6,
          background: isDark ? 'rgba(30, 41, 59, 0.8)' : '#fff', border: '1px solid rgba(255,255,255,0.18)',
          color: text, fontSize: 12.5, outline: 'none'
        }}
      />
      <div role="listbox" style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, overscrollBehavior: 'contain' }}>
        {filtered.map(d => (
          <div
            key={`${d.parent}::${d.sub}`}
            role="option"
            onClick={() => choose(d)}
            style={{ padding: '7px 10px', borderRadius: 8, cursor: busy ? 'wait' : 'pointer', fontSize: 12.5, color: text, fontWeight: d.sub ? 500 : 700 }}
          >
            {d.sub ? `${d.parent} > ${d.sub}` : d.parent}
          </div>
        ))}
        {filtered.length === 0 && <div style={{ padding: '7px 10px', fontSize: 12, color: muted }}>No areas match</div>}
      </div>
      <button type="button" onClick={() => { setChooser(null); setSearch(''); }} style={{
        marginTop: 6, padding: '5px 10px', borderRadius: 8, border: 'none', background: 'transparent', color: muted, fontSize: 12, cursor: 'pointer'
      }}>Cancel</button>
    </div>
  );

  if (plots.length === 0) {
    return <div style={{ padding: '8px 4px 2px 32px', fontSize: 12, color: muted }}>Nothing is waiting here.</div>;
  }

  return (
    <div style={{ paddingLeft: 32, paddingRight: 6, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 11.5, color: muted, lineHeight: 1.4 }}>
        These plots lost their area when it was deleted. Move each one to a real area or sub-area.
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setChooser(chooser === 'all' ? null : 'all'); setSearch(''); }}
        style={{
          alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999,
          fontSize: 11, fontWeight: 700, cursor: 'pointer', color: '#38bdf8',
          background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.35)'
        }}
      >
        <FiMove size={11} /> Move all {plots.length}
      </button>
      {chooser === 'all' && chooserBox}

      {plots.map(plot => {
        const origin = origins.get(plot.id);
        const d = plot.data || {};
        return (
          <div key={plot.id} style={{ borderTop: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(15,23,42,0.06)', paddingTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: text }}>
                  {d.area ? `${d.area} ${d.areaUnit || ''}`.trim() : 'Plot'}{d.type ? ` - ${d.type}` : ''}
                </div>
                <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>
                  {origin
                    ? `Was in ${describeOrigin(origin)} - removed ${formatDate(origin.at)} by ${origin.by}`
                    : 'Origin not recorded (moved here before history was kept)'}
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setChooser(chooser === plot.id ? null : plot.id); setSearch(''); }}
                style={{
                  flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 999,
                  fontSize: 10.5, fontWeight: 700, cursor: 'pointer', color: '#cbd5e1',
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.16)'
                }}
              >
                <FiMove size={11} /> Move
              </button>
            </div>
            {chooser === plot.id && chooserBox}
          </div>
        );
      })}
    </div>
  );
}
