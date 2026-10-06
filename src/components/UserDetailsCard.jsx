import { FiPhone, FiMail, FiUser } from 'react-icons/fi';
import { getUserDisplayName, countValues } from '../utils/userSummary';

const detailLabel = { color: '#64748b', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' };
const detailValue = { color: '#e2e8f0', fontSize: 13, fontWeight: 600, wordBreak: 'break-word' };
const formatDate = (d) => d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

function DetailRow({ icon, label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span style={{ ...detailLabel, display: 'flex', alignItems: 'center', gap: 4 }}>{icon}{label}</span>
      <span style={detailValue}>{children}</span>
    </div>
  );
}

function ChipList({ items }) {
  if (!items.length) return <span style={{ color: '#64748b', fontWeight: 400 }}>-</span>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
      {items.map(({ name, count }) => (
        <span key={name} style={{
          padding: '3px 8px', borderRadius: 999, fontSize: 11.5, fontWeight: 600,
          background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#f59e0b'
        }}>{name} · {count}</span>
      ))}
    </div>
  );
}

// Everything we know about one account: who they are (from sign-up) and what they have submitted.
export default function UserDetailsCard({ user, property = null, style = null }) {
  const name = getUserDisplayName(user);
  const link = { color: '#38bdf8', textDecoration: 'none' };
  return (
    <div style={{
      marginTop: 10, padding: 12, borderRadius: 10, ...(style || {}),
      background: 'rgba(15, 23, 42, 0.55)', border: '1px solid rgba(255,255,255,0.1)',
      display: 'flex', flexDirection: 'column', gap: 12
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <DetailRow icon={<FiUser size={11} />} label="Name">{name || <span style={{ color: '#64748b', fontWeight: 400 }}>Not provided</span>}</DetailRow>
        <DetailRow icon={<FiPhone size={11} />} label="Mobile"><a href={`tel:${user.username}`} style={link}>{user.username}</a></DetailRow>
        <div style={{ gridColumn: '1 / -1' }}>
          <DetailRow icon={<FiMail size={11} />} label="Email">
            {user.email ? <a href={`mailto:${user.email}`} style={link}>{user.email}</a> : <span style={{ color: '#64748b', fontWeight: 400 }}>Not provided</span>}
          </DetailRow>
        </div>
        <DetailRow label="Joined">{formatDate(user.createdAt)}</DetailRow>
        <DetailRow label="Last active">{formatDate(user.lastSubmissionAt)}</DetailRow>
      </div>

      <div>
        <div style={detailLabel}>Submissions</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 4 }}>
          {[
            ['Total', user.totalProperties, '#f8fafc'],
            ['Approved', user.approvedCount, '#22c55e'],
            ['Pending', user.pendingCount, '#f59e0b'],
            ['Rejected', user.rejectedCount, '#ef4444']
          ].map(([label, value, color]) => (
            <div key={label} style={{
              padding: '6px 4px', borderRadius: 8, textAlign: 'center',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)'
            }}>
              <div style={{ color, fontWeight: 700, fontSize: 15 }}>{value ?? 0}</div>
              <div style={{ color: '#94a3b8', fontSize: 10 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {property && (property.partyName || property.partyPhone || property.brokerName || property.brokerPhone) && (
        <div>
          <div style={detailLabel}>Contacts on this property</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 4 }}>
            {[['Party', property.partyName, property.partyPhone], ['Broker', property.brokerName, property.brokerPhone]].map(([label, who, phone]) => (
              <DetailRow key={label} label={label}>
                {who || <span style={{ color: '#64748b', fontWeight: 400 }}>-</span>}
                {phone && <div><a href={`tel:${phone}`} style={link}>{phone}</a></div>}
              </DetailRow>
            ))}
          </div>
        </div>
      )}

      <div>
        <div style={detailLabel}>Property types</div>
        <ChipList items={countValues(user.types)} />
      </div>
      <div>
        <div style={detailLabel}>Areas</div>
        <ChipList items={countValues(user.locations)} />
      </div>
    </div>
  );
}
