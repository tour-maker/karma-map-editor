import { RiShareBoxLine } from 'react-icons/ri';
import React, { useState, useEffect } from 'react';
import { useMapStore } from '../../store/useMapStore';
import { FiShare2, FiSliders, FiX, FiHelpCircle, FiVolume2, FiVolumeX, FiCamera, FiMaximize, FiMinimize } from 'react-icons/fi';
import toast from 'react-hot-toast';
import HelpInstructionOverlay from './HelpInstructionOverlay';

const loadHtml2Canvas = () => {
  return new Promise((resolve, reject) => {
    if (window.html2canvas) return resolve(window.html2canvas);
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.onload = () => resolve(window.html2canvas);
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

const WhatsAppIcon = ({ color = "#f59e0b", size = 22 }) => (
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

export default function RightActionDock() {
  const setSelectedFeatureId = useMapStore(state => state.setSelectedFeatureId);
  const setIsInfoPanelOpen = useMapStore(state => state.setIsInfoPanelOpen);
  const uiHidden = useMapStore(state => state.uiHidden);

  const [isOpen, setIsOpen] = useState(false);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  if (uiHidden) return null;

  const handleWhatsAppClick = () => {
    const selectedFeatureId = useMapStore.getState().selectedFeatureId;
    const features = useMapStore.getState().features;

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

  const handleShare = async () => {
    const features = useMapStore.getState().features;
    const selectedFeatureId = useMapStore.getState().selectedFeatureId;
    const selectedFeature = features.find(f => f.id === selectedFeatureId);

    const shareUrl = new URL(window.location.href);

    if (selectedFeature) {
      shareUrl.searchParams.set('feature', selectedFeature.id);
      const d = selectedFeature.data || {};
      const title = d.name || d.location || `Polygon ${selectedFeature.id}`;
      const tpFp = [
        d.tpNo || d.tp ? `TP: ${d.tpNo || d.tp}` : '',
        d.opNo || d.op ? `OP: ${d.opNo || d.op}` : '',
        d.fpNo || d.fp ? `FP: ${d.fpNo || d.fp}` : ''
      ].filter(Boolean).join(' | ');

      const areaStr = d.area ? `${d.area} sq. yard` : '';
      const locationStr = d.location ? `${d.location}${d.parentLocation ? `, ${d.parentLocation}` : ''}` : 'Surat';
      const categoryStr = d.type ? d.type.toUpperCase() : 'LAND';

      const shareText = `📍 *Karma Realtors - Selected Plot Details*\n\n` +
        `🏢 *Title*: ${title}\n` +
        `📍 *Location*: ${locationStr}\n` +
        (tpFp ? `📐 *TP/OP/FP*: ${tpFp}\n` : '') +
        (areaStr ? `📏 *Area*: ${areaStr}\n` : '') +
        `🏷️ *Category*: ${categoryStr}\n\n` +
        `🔗 *View on Interactive Map*:\n${shareUrl.toString()}`;

      if (navigator.share) {
        try {
          await navigator.share({
            title: `Karma Realtors - ${title}`,
            text: shareText,
            url: shareUrl.toString()
          });
          toast.success('Polygon info shared! 🚀', {
            style: { background: '#0f172a', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)' }
          });
          return;
        } catch (e) {
          if (e.name === 'AbortError') return;
        }
      }

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareText);
        toast.success('Selected polygon info & link copied to clipboard! 📋', {
          style: { background: '#0f172a', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)' }
        });
      }
    } else {
      const generalShareText = `Karma Realtors - Exclusive Land Project
Explore our exclusive Land Project with custom filters like Sq Yard & Wingha. Choose your ideal plot based on category. Take a virtual tour now 👇
https://karma-map-editor.onrender.com/`;

      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Karma Realtors - Exclusive Land Project',
            text: generalShareText
          });
          toast.success('Project details & tour link shared! 🚀', {
            style: { background: '#0f172a', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)' }
          });
          return;
        } catch (e) {
          if (e.name === 'AbortError') return;
        }
      }
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(generalShareText);
        toast.success('Project details & tour link copied to clipboard! 📋', {
          style: { background: '#0f172a', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)' }
        });
      }
    }
  };

  const handleToggleOpen = () => {
    setIsOpen(prev => !prev);
  };

  const handleToggleAudio = () => {
    setIsAudioOn(prev => !prev);
    toast(isAudioOn ? 'Audio muted' : 'Audio enabled', {
      icon: isAudioOn ? '🔇' : '🔊'
    });
  };

  // Bulletproof Direct Screenshot Capture (Zero toast notifications in screenshot, clean map output!)
  const handleCaptureScreenshot = async () => {
    try {
      // 1. Dismiss any existing active toasts so zero toasts appear in the screenshot
      toast.dismiss();

      // 2. Temporarily hide UI overlays visually via CSS class (Map stays 100% mounted & live!)
      document.body.classList.add('hide-ui-for-screenshot');

      // Wait 100ms for CSS transition & toast removal
      await new Promise(r => setTimeout(r, 100));

      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-');
      const filename = `karma-map-screenshot-${dateStr}_${timeStr}.png`;

      // 3. Render clean map using html2canvas directly
      const html2canvas = await loadHtml2Canvas();
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        allowTaint: true,
        scale: window.devicePixelRatio || 2,
        backgroundColor: '#0a0e17',
        logging: false
      });

      // Composite any Google Maps canvas layers directly
      const ctx = canvas.getContext('2d');
      const mapCanvases = document.querySelectorAll('.gm-style canvas, #map canvas');
      mapCanvases.forEach(srcCanvas => {
        try {
          const rect = srcCanvas.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            ctx.drawImage(
              srcCanvas,
              rect.left * (canvas.width / window.innerWidth),
              rect.top * (canvas.height / window.innerHeight),
              rect.width * (canvas.width / window.innerWidth),
              rect.height * (canvas.height / window.innerHeight)
            );
          }
        } catch (e) {
          // ignore individual canvas draw warning
        }
      });

      // 4. Download PNG file
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // 5. Restore UI controls back to screen FIRST
      document.body.classList.remove('hide-ui-for-screenshot');

      // 6. Show success toast AFTER UI is restored and screenshot is saved!
      toast.success('map screenshot taken', {
        style: { background: '#0f172a', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)' }
      });

    } catch (error) {
      console.error('Screenshot capture error:', error);
      document.body.classList.remove('hide-ui-for-screenshot');
      toast.error('Failed to capture screenshot. Try again.');
    }
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error('Error entering fullscreen:', err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  return (
    <>
      <style>{`
        @keyframes slideDownFade {
          0% { opacity: 0; transform: translateY(-12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <button
        type="button"
        className="mobile-share-floating-btn btn-hover-effect"
        onClick={handleShare}
        title="Share map view"
      >
        <RiShareBoxLine size={26} />
      </button>

      {/* Outer Dock Container Anchored at Top 38% (NO transform: translateY(-50%) so top buttons NEVER move when opening!) */}
      <div
        className="responsive-right-dock"
        style={{
          position: 'absolute',
          right: 0,
          top: '38%',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
          userSelect: 'none'
        }}
      >
        {/* Top Floating Glass Capsule (STATIONARY - NEVER MOVES ON CLICK!) */}
        <div
          style={{
            background: 'rgba(10, 14, 23, 0.70)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.22)',
            borderRadius: 20,
            padding: '12px 10px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.65)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14
          }}
        >
          {/* Share Button */}
          <button
            type="button"
            onClick={handleShare}
            title="Share map view"
            className="btn-hover-effect mobile-hidden"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
              transition: 'transform 0.2s ease'
            }}
          >
            <FiShare2 size={22} color="#f59e0b" />
          </button>

          {/* Toggle Options Panel Button: FiSliders (Gold) ↔ FiX (White) */}
          <button
            type="button"
            onClick={handleToggleOpen}
            title={isOpen ? "Close options panel" : "Open options panel"}
            className="btn-hover-effect"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
              transition: 'transform 0.2s ease'
            }}
          >
            {isOpen ? (
              <FiX size={24} color="#ffffff" />
            ) : (
              <FiSliders size={22} color="#f59e0b" />
            )}
          </button>

          {/* WhatsApp Direct Message Button (Mobile Combined Only) */}
          <button
            type="button"
            onClick={handleWhatsAppClick}
            title="Direct Message on WhatsApp (+91 9824712471)"
            className="btn-hover-effect mobile-only-whatsapp-btn"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
              transition: 'transform 0.2s ease'
            }}
          >
            <WhatsAppIcon color="#f59e0b" size={24} />
          </button>
        </div>

        {/* Main Vertical Glass Action Capsule (Slides DOWN underneath top capsule without moving top buttons!) */}
        {isOpen && (
          <div
            className="responsive-right-dock-popout"
            style={{
              background: 'rgba(10, 14, 23, 0.70)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              borderRight: 'none',
              borderRadius: '20px 0 0 20px',
              padding: '14px 10px',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.65)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 18,
              animation: 'slideDownFade 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Help / Guide Button */}
            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              title="Help & Keyboard Shortcuts"
              className="btn-hover-effect"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 22,
                fontWeight: 800,
                color: '#f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 4,
                lineHeight: 1
              }}
            >
              ?
            </button>

            {/* Audio / Mute Button */}
            <button
              type="button"
              onClick={handleToggleAudio}
              title={isAudioOn ? "Mute audio" : "Enable audio"}
              className="btn-hover-effect"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 4
              }}
            >
              {isAudioOn ? (
                <FiVolume2 size={22} color="#f59e0b" />
              ) : (
                <FiVolumeX size={22} color="#94a3b8" />
              )}
            </button>

            {/* Camera / Snapshot Button */}
            <button
              type="button"
              onClick={handleCaptureScreenshot}
              title="Capture Map Screenshot"
              className="btn-hover-effect"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 4
              }}
            >
              <FiCamera size={22} color="#f59e0b" />
            </button>

            {/* Fullscreen / Maximize Button */}
            <button
              type="button"
              onClick={handleToggleFullscreen}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Mode"}
              className="btn-hover-effect"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 4
              }}
            >
              {isFullscreen ? (
                <FiMinimize size={20} color="#f59e0b" />
              ) : (
                <FiMaximize size={20} color="#f59e0b" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Help Instructions Overlay */}
      {showHelpModal && (
        <HelpInstructionOverlay onClose={() => setShowHelpModal(false)} />
      )}
    </>
  );
}
