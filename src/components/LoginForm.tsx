'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, ShieldCheck, Loader2, BookOpen } from 'lucide-react';

interface LoginFormProps {
  onManualEntry: () => void;
}

export default function LoginForm({ onManualEntry }: LoginFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // All fields on one form now
  const [usn, setUsn] = useState('');
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');
  const [verificationType, setVerificationType] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '']);
  const otpRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
  const months = [
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 30 }, (_, i) => String(currentYear - i));

  const verificationTypes = [
    { value: 'father', label: "Father's Phone (Last 4 digits)" },
    { value: 'mother', label: "Mother's Phone (Last 4 digits)" },
    { value: 'guardian', label: "Guardian's Phone (Last 4 digits)" },
  ];

  const handleOtpChange = useCallback((index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    if (value && !/^\d$/.test(value)) return;

    const newDigits = [...otpDigits];
    newDigits[index] = value;
    setOtpDigits(newDigits);

    // Auto-focus next input
    if (value && index < 3) {
      otpRefs[index + 1].current?.focus();
    }
  }, [otpDigits, otpRefs]);

  const handleOtpKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
  }, [otpDigits, otpRefs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setStep(2); // Show loading state

    try {
      // Use the new single-step Puppeteer API
      const res = await fetch('/api/auth/login-full', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usn: usn.toUpperCase(),
          dobDay,
          dobMonth,
          dobYear,
          verificationType,
          digits: otpDigits,
        }),
      });

      const data = await res.json();
      console.log('✓ Login response:', data);

      if (data.success && data.courses) {
        console.log('  Courses:', data.courses.length);
        console.log('  Profile:', data.profile);

        // Store in sessionStorage and redirect
        sessionStorage.setItem('gradebuddy_profile', JSON.stringify(data.profile));
        sessionStorage.setItem('gradebuddy_courses', JSON.stringify(data.courses));
        router.push('/dashboard');
      } else {
        console.error('❌ Failed:', data);
        setError(data.message || 'Login failed. Please check your credentials.');
        setStep(1);
      }
    } catch (err) {
      console.error('Network error:', err);
      setError('Network error. Please try again.');
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-card glass-card glow-border">
      {/* Step Indicator - simplified to 2 steps */}
      <div className="login-step-indicator">
        <div className={`step-dot ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`} />
        <div className={`step-line ${step > 1 ? 'completed' : ''}`} />
        <div className={`step-dot ${step >= 2 ? 'active' : ''}`} />
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Single Form with all fields */}
      {step === 1 && (
        <form onSubmit={handleSubmit} className="animate-fade-in">
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <LogIn size={28} color="var(--accent-primary)" style={{ marginBottom: '0.5rem' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Login to Contineo</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              Enter your portal credentials and verification code
            </p>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="usn-input">USN</label>
            <input
              id="usn-input"
              type="text"
              className="form-input"
              placeholder="e.g. 4NI23IS251"
              value={usn}
              onChange={e => setUsn(e.target.value.toUpperCase())}
              required
              autoComplete="username"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Date of Birth</label>
            <div className="form-row">
              <select
                className="form-input form-select"
                value={dobDay}
                onChange={e => setDobDay(e.target.value)}
                required
                id="dob-day"
              >
                <option value="">Day</option>
                {days.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select
                className="form-input form-select"
                value={dobMonth}
                onChange={e => setDobMonth(e.target.value)}
                required
                id="dob-month"
              >
                <option value="">Month</option>
                {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <select
                className="form-input form-select"
                value={dobYear}
                onChange={e => setDobYear(e.target.value)}
                required
                id="dob-year"
              >
                <option value="">Year</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="verification-type">Verification Type</label>
            <select
              id="verification-type"
              className="form-input form-select"
              value={verificationType}
              onChange={e => setVerificationType(e.target.value)}
              required
            >
              <option value="">Select an option</option>
              {verificationTypes.map(vt => (
                <option key={vt.value} value={vt.value}>{vt.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Enter Last 4 Digits</label>
            <div className="otp-inputs">
              {otpDigits.map((digit, i) => (
                <input
                  key={i}
                  ref={otpRefs[i]}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  className="otp-input"
                  value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  id={`otp-digit-${i + 1}`}
                />
              ))}
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading || !usn || !dobDay || !dobMonth || !dobYear || !verificationType || otpDigits.some(d => !d)}
          >
            {loading ? (
              <>
                <span className="spinner" />
                Logging in & Fetching Marks...
              </>
            ) : (
              <>
                <LogIn size={18} />
                Login & Fetch Marks
              </>
            )}
          </button>
        </form>
      )}

      {/* Loading State */}
      {step === 2 && (
        <div className="loading-overlay animate-fade-in">
          <Loader2 size={40} color="var(--accent-primary)" style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ fontWeight: 600 }}>Logging in to Contineo...</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Handling reCAPTCHA and fetching your CIE marks
          </p>
          <div className="loading-dots">
            <span /><span /><span />
          </div>
        </div>
      )}

      {/* Manual Entry Option */}
      {step !== 2 && (
        <div className="manual-entry-toggle">
          <button onClick={onManualEntry}>
            <BookOpen size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
            Enter marks manually instead
          </button>
        </div>
      )}
    </div>
  );
}
