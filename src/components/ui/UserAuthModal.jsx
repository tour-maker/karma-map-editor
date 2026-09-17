import { useState, useRef, useEffect } from 'react';
import { FiX, FiUser, FiArrowRight, FiEye, FiEyeOff } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useMapStore } from '../../store/useMapStore';
import { API_BASE_URL } from '../../config/api';

const USER_TYPES = ['Broker', 'Owner', 'Buyer', 'Investor'];
const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

// --- OTP stubs (UI-only simulation) -----------------------------------------
// Replace these two functions with real SMS provider calls when ready.
// Nothing else in this component needs to change — both simply resolve
// { success: true } after a short delay to simulate a network round trip.
function sendOtp(mobileNumber) {
  console.log(`[stub] sendOtp -> would text an OTP to ${mobileNumber}`);
  return new Promise((resolve) => setTimeout(() => resolve({ success: true }), 700));
}

function verifyOtp(mobileNumber, code) {
  console.log(`[stub] verifyOtp -> would verify code ${code} for ${mobileNumber}`);
  return new Promise((resolve) => setTimeout(() => resolve({ success: true }), 700));
}
// -----------------------------------------------------------------------------

const inputStyle = {
  width: '100%', padding: '11px 14px', borderRadius: 10,
  border: '1px solid rgba(255, 255, 255, 0.15)', background: 'rgba(30, 41, 59, 0.6)',
  color: '#fff', fontSize: 13.5, outline: 'none', boxSizing: 'border-box'
};

const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6 };

export default function UserAuthModal({ onClose, onSuccess, title = 'Sign In', subtitle = 'Sign in to submit and track your property requests.' }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [step, setStep] = useState('form'); // 'form' | 'otp' (signup only)

  // Login fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Sign up fields
  const [userType, setUserType] = useState(USER_TYPES[0]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobile, setMobile] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [email, setEmail] = useState('');
  const [agreed, setAgreed] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // OTP step
  const [otpDigits, setOtpDigits] = useState(Array(OTP_LENGTH).fill(''));
  const [otpBusy, setOtpBusy] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const otpInputRefs = useRef([]);

  const setViewerUsername = useMapStore(state => state.setViewerUsername);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = setInterval(() => setResendSeconds(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendSeconds]);

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setStep('form');
    setOtpDigits(Array(OTP_LENGTH).fill(''));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.error('Please enter a username and password');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/user-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Something went wrong');
        return;
      }

      localStorage.setItem('karmaUserJWT', data.token);
      setViewerUsername(data.username);
      toast.success(`Welcome back, ${data.username}!`);
      onSuccess?.(data.username);
    } catch (err) {
      console.error('Auth error:', err);
      toast.error('Cannot reach server. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterNow = async (e) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('Please enter your first and last name');
      return;
    }
    if (!mobile.trim() || mobile.trim().replace(/\D/g, '').length < 10) {
      toast.error('Please enter a valid mobile number');
      return;
    }
    if (!signupPassword || signupPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (!agreed) {
      toast.error("Please agree to Karma Realtor's T&C to continue");
      return;
    }

    setLoading(true);
    try {
      const result = await sendOtp(mobile.trim());
      if (result.success) {
        setOtpDigits(Array(OTP_LENGTH).fill(''));
        setStep('otp');
        setResendSeconds(RESEND_SECONDS);
        toast.success(`OTP sent to ${mobile.trim()}`);
      } else {
        toast.error('Failed to send OTP. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOtpDigitChange = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    setOtpDigits(prev => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < OTP_LENGTH - 1) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleResendOtp = async () => {
    if (resendSeconds > 0) return;
    setOtpBusy(true);
    try {
      const result = await sendOtp(mobile.trim());
      if (result.success) {
        setResendSeconds(RESEND_SECONDS);
        toast.success('OTP resent');
      } else {
        toast.error('Failed to resend OTP. Please try again.');
      }
    } finally {
      setOtpBusy(false);
    }
  };

  const handleVerifyOtp = async () => {
    const code = otpDigits.join('');
    if (code.length !== OTP_LENGTH) {
      toast.error(`Please enter the ${OTP_LENGTH}-digit code`);
      return;
    }

    setOtpBusy(true);
    try {
      const result = await verifyOtp(mobile.trim(), code);
      if (!result.success) {
        toast.error('Incorrect OTP. Please try again.');
        return;
      }

      // OTP verified — create the account. Mobile number doubles as the account username.
      const res = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: mobile.trim(),
          password: signupPassword,
          userType,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          mobile: mobile.trim(),
          email: email.trim()
        })
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Something went wrong');
        return;
      }

      localStorage.setItem('karmaUserJWT', data.token);
      setViewerUsername(data.username);
      toast.success(`Welcome, ${firstName.trim()}!`);
      onSuccess?.(data.username);
    } catch (err) {
      console.error('Auth error:', err);
      toast.error('Cannot reach server. Make sure the backend is running.');
    } finally {
      setOtpBusy(false);
    }
  };

  const isOtpStep = mode === 'signup' && step === 'otp';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(10, 14, 23, 0.75)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div style={{
        width: '100%', maxWidth: 380,
        background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(11, 17, 30, 0.96) 100%)',
        border: '1px solid rgba(245, 158, 11, 0.3)',
        borderRadius: 20, padding: 28, boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
        color: '#f8fafc', position: 'relative'
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16,
            background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer',
            padding: 4, borderRadius: 6, display: 'flex'
          }}
        >
          <FiX size={18} />
        </button>

        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16
        }}>
          <FiUser size={24} color="#f59e0b" />
        </div>

        {isOtpStep ? (
          <>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#f8fafc' }}>Verify Your Mobile Number</h2>
            <p style={{ margin: '6px 0 20px 0', fontSize: 13, color: '#94a3b8' }}>
              Enter the {OTP_LENGTH}-digit code sent to {mobile.trim()}
            </p>

            <form onSubmit={(e) => { e.preventDefault(); handleVerifyOtp(); }}>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginBottom: 18 }}>
                {otpDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => (otpInputRefs.current[i] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    autoFocus={i === 0}
                    style={{
                      width: 42, height: 48, textAlign: 'center', fontSize: 18, fontWeight: 700,
                      borderRadius: 10, border: '1px solid rgba(255, 255, 255, 0.15)',
                      background: 'rgba(30, 41, 59, 0.6)', color: '#fff', outline: 'none'
                    }}
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={otpBusy}
                style={{
                  width: '100%', padding: '13px', borderRadius: 10, border: 'none',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#000',
                  fontSize: 14, fontWeight: 700, cursor: otpBusy ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)', opacity: otpBusy ? 0.7 : 1
                }}
              >
                {otpBusy ? 'Verifying...' : 'Verify'} <FiArrowRight size={16} />
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12.5, color: '#94a3b8' }}>
              {resendSeconds > 0 ? (
                <span>Resend OTP in {resendSeconds}s</span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={otpBusy}
                  style={{ background: 'none', border: 'none', color: '#f59e0b', fontWeight: 600, cursor: 'pointer', fontSize: 12.5 }}
                >
                  Resend OTP
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setStep('form')}
              style={{ display: 'block', margin: '14px auto 0', background: 'none', border: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}
            >
              ← Back
            </button>
          </>
        ) : (
          <>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#f8fafc' }}>{mode === 'signup' ? 'Create Account' : title}</h2>
            <p style={{ margin: '6px 0 20px 0', fontSize: 13, color: '#94a3b8' }}>
              {mode === 'signup' ? 'Register to submit and track your property requests.' : subtitle}
            </p>

            <div style={{ display: 'flex', gap: 4, background: 'rgba(30, 41, 59, 0.6)', padding: 3, borderRadius: 10, marginBottom: 20 }}>
              <button
                type="button"
                onClick={() => switchMode('login')}
                style={{
                  flex: 1, padding: '8px 0', border: 'none', borderRadius: 8,
                  background: mode === 'login' ? '#f59e0b' : 'transparent',
                  color: mode === 'login' ? '#000' : '#94a3b8',
                  fontSize: 12.5, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => switchMode('signup')}
                style={{
                  flex: 1, padding: '8px 0', border: 'none', borderRadius: 8,
                  background: mode === 'signup' ? '#f59e0b' : 'transparent',
                  color: mode === 'signup' ? '#000' : '#94a3b8',
                  fontSize: 12.5, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                Create Account
              </button>
            </div>

            {mode === 'login' ? (
              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Your mobile number"
                    autoFocus
                    style={inputStyle}
                  />
                  <span style={{ display: 'block', fontSize: 11, color: '#64748b', marginTop: 4 }}>
                    New accounts use your mobile number as the username
                  </span>
                </div>

                <div>
                  <label style={labelStyle}>Password</label>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter Password"
                      style={{ ...inputStyle, padding: '11px 40px 11px 14px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer',
                        display: 'flex', padding: 4
                      }}
                    >
                      {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    marginTop: 6, width: '100%', padding: '13px', borderRadius: 10, border: 'none',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#000',
                    fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)', opacity: loading ? 0.7 : 1
                  }}
                >
                  {loading ? 'Please wait...' : 'Sign In'} <FiArrowRight size={16} />
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegisterNow} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={labelStyle}>User Type</label>
                  <select
                    value={userType}
                    onChange={(e) => setUserType(e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    {USER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>First Name</label>
                    <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" style={inputStyle} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Last Name</label>
                    <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" style={inputStyle} />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Mobile Number</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]{10}"
                    maxLength={10}
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit mobile number"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Password</label>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      style={{ ...inputStyle, padding: '11px 40px 11px 14px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer',
                        display: 'flex', padding: 4
                      }}
                    >
                      {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Email Address (optional)</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} />
                </div>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: '#94a3b8', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    style={{ marginTop: 2, cursor: 'pointer' }}
                  />
                  <span>I agree to terms and condition of Karma Realtor's T&C</span>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    marginTop: 6, width: '100%', padding: '13px', borderRadius: 10, border: 'none',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#000',
                    fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)', opacity: loading ? 0.7 : 1
                  }}
                >
                  {loading ? 'Sending OTP...' : 'Register Now'} <FiArrowRight size={16} />
                </button>

                <div style={{ textAlign: 'center', fontSize: 12.5, color: '#94a3b8' }}>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    style={{ background: 'none', border: 'none', color: '#f59e0b', fontWeight: 600, cursor: 'pointer', fontSize: 12.5 }}
                  >
                    Login here
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
