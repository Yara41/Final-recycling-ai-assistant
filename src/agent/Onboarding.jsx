import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Building2, GraduationCap, Briefcase, Presentation, ShieldCheck } from 'lucide-react';
import { createProfile, getProfile, listUniversities, redeemInvite, signInStaff } from '../lib/session.js';
import { strings } from './strings.js';

const ROLES = [
  { id: 'student', Icon: GraduationCap },
  { id: 'faculty', Icon: Presentation },
  { id: 'staff', Icon: Briefcase },
];

// First visit: pick university and role (anonymous session already exists).
// University team members sign in with email and activate their invite code.
export default function Onboarding({ lang, onDone }) {
  const s = strings(lang);
  const [unis, setUnis] = useState(null);
  const [uni, setUni] = useState(null);
  const [role, setRole] = useState(null);
  const [faculty, setFaculty] = useState('');
  const [name, setName] = useState('');
  const [mode, setMode] = useState('member'); // member | staff
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    listUniversities().then(setUnis).catch(() => setError(s.genericError));
  }, [s.genericError]);

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e?.code === 'invalid_invite' ? s.invalidInvite : s.genericError);
    } finally {
      setBusy(false);
    }
  };

  const start = () => run(async () => {
    const profile = await createProfile({ universityId: uni.id, role, faculty: faculty || null, displayName: name || null });
    onDone(profile);
  });

  const staffSignIn = () => run(async () => {
    await signInStaff(email.trim(), password);
    const existing = await getProfile();
    if (existing && ['facilities', 'admin'].includes(existing.role)) onDone(existing);
    else setSignedIn(true);
  });

  const activate = () => run(async () => {
    await redeemInvite(code);
    onDone(await getProfile());
  });

  const Back = lang === 'en' ? ArrowLeft : ArrowRight;

  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <img src="/logo.png" alt="EcoWasteAI" className="onboarding-logo" />
        <h1>{mode === 'staff' ? s.staffTitle : s.welcomeTitle}</h1>
        {mode === 'member' && <p className="onboarding-sub">{s.welcomeSub}</p>}

        {mode === 'member' && !uni && (
          <>
            <h2>{s.chooseUni}</h2>
            {!unis && <p className="onboarding-muted">{s.loading}</p>}
            <div className="choice-list">
              {(unis ?? []).map((u) => (
                <button key={u.id} type="button" className="choice" onClick={() => setUni(u)}>
                  <Building2 size={18} /> {u.name}
                </button>
              ))}
            </div>
            <button type="button" className="onboarding-link" onClick={() => setMode('staff')}><ShieldCheck size={15} /> {s.staffLink}</button>
          </>
        )}

        {mode === 'member' && uni && (
          <>
            <button type="button" className="onboarding-back" onClick={() => { setUni(null); setRole(null); }}><Back size={15} /> {uni.name}</button>
            <h2>{s.chooseRole}</h2>
            <div className="choice-row">
              {ROLES.map((r) => (
                <button key={r.id} type="button" className={`choice ${role === r.id ? 'selected' : ''}`} aria-pressed={role === r.id} onClick={() => setRole(r.id)}>
                  <r.Icon size={18} /> {s[r.id]}
                </button>
              ))}
            </div>
            <input className="onboarding-input" value={faculty} onChange={(e) => setFaculty(e.target.value)} placeholder={s.facultyField} maxLength={120} />
            <input className="onboarding-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={s.nameField} maxLength={80} />
            <button type="button" className="onboarding-primary" disabled={!role || busy} onClick={start}>{s.start}</button>
          </>
        )}

        {mode === 'staff' && !signedIn && (
          <form onSubmit={(e) => { e.preventDefault(); staffSignIn(); }}>
            <input className="onboarding-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={s.email} autoComplete="email" />
            <input className="onboarding-input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder={s.password} autoComplete="current-password" />
            <button type="submit" className="onboarding-primary" disabled={busy}>{s.signIn}</button>
            <button type="button" className="onboarding-back" onClick={() => setMode('member')}><Back size={15} /> {s.back}</button>
          </form>
        )}

        {mode === 'staff' && signedIn && (
          <form onSubmit={(e) => { e.preventDefault(); activate(); }}>
            <input className="onboarding-input" required value={code} onChange={(e) => setCode(e.target.value)} placeholder={s.inviteCode} />
            <button type="submit" className="onboarding-primary" disabled={busy}>{s.redeem}</button>
          </form>
        )}

        {error && <p className="onboarding-error" role="alert">{error}</p>}
      </div>
    </div>
  );
}
