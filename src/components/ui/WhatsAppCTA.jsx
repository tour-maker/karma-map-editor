import React from 'react';
import { useMapStore } from '../../store/useMapStore';
import toast from 'react-hot-toast';

const WhatsAppIcon = ({ color = "#f59e0b", size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347z"
      fill={color}
    />
    <path
      d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.985-1.39A9.953 9.953 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.95 7.95 0 01-4.148-1.163l-.297-.176-3.08.859.873-2.985-.195-.31A7.957 7.957 0 014 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z"
      fill={color}
    />
  </svg>
);

export default function WhatsAppCTA() {
  const selectedFeatureId = useMapStore(state => state.selectedFeatureId);
  const features = useMapStore(state => state.features);
  const uiHidden = useMapStore(state => state.uiHidden);

  if (uiHidden) return null;

  const handleWhatsAppClick = () => {
    let text = "Hi, I'm interested in your Land Project and would like to know more about the available plots. Please share more details. 👇\nhttps://karma-map-editor.onrender.com/";

    if (selectedFeatureId) {
      const feature = features.find(f => f.id === selectedFeatureId);
      if (feature && feature.data) {
        const name = feature.data.name || feature.data.project || '';
        const tpFp = feature.data.tpNo ? ` (TP ${feature.data.tpNo} / FP ${feature.data.fpNo})` : '';
        if (name) {
          text = `Hi, I'm interested in your Land Project for ${name}${tpFp} and would like to know more about the available plots. Please share more details. 👇\nhttps://karma-map-editor.onrender.com/`;
        }
      }
    }

    const phoneNumber = "919824712471";
    const encodedText = encodeURIComponent(text);
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${phoneNumber}&text=${encodedText}`;

    toast.success('Opening WhatsApp Direct Message...', {
      icon: '💬',
      style: { background: '#0f172a', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)' }
    });

    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="whatsapp-cta-wrapper" style={{
      position: 'absolute',
      bottom: 24,
      right: 20,
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6
    }}>
      <div
        onClick={handleWhatsAppClick}
        title="Direct Message on WhatsApp (+91 9824712471)"
        className="btn-hover-effect whatsapp-cta-button"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
          filter: 'drop-shadow(0 4px 12px rgba(245, 158, 11, 0.35))'
        }}
      >
        <WhatsAppIcon color="#f59e0b" size={48} />
      </div>
      <span className="desktop-only-text" style={{ 
        color: '#ffffff', 
        fontSize: '11px', 
        fontWeight: 600, 
        textShadow: '0 2px 4px rgba(0,0,0,0.8)',
        letterSpacing: '0.5px'
      }}>
        Contact Us
      </span>
    </div>
  );
}
