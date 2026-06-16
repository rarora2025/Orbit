'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import OrbitLogo from '@/components/OrbitLogo';
import { completeOnboarding, type OnboardingContactInput } from '@/lib/onboarding.actions';
import { addGoal as createGoal, generateGoalImage, deleteGoal as removeGoalApi } from '@/lib/goals.actions';
import {
  GOAL_PLACEHOLDERS, ORB_COLORS, SAMPLE_CONTACTS, initials, type ContactSeed,
} from '@/lib/onboardingSamples';
import { CHAT_SUGGESTIONS } from '@/lib/chatSuggestions';

const STEP_COUNT = 4;

// Local display shape for an orb in the visual / import list. Sample people carry
// their full seed; manually-added people fill in just the basics.
type Person = {
  name: string;
  company: string;
  logo: string | null;
  color: string;
  seed?: ContactSeed;
};
// `id` is set once the goal is created for real (so it can be deleted again).
type GoalPick = { label: string; cl: string; id?: string };

// Ambient floating dots — fixed positions (kept static so render stays pure and
// SSR/CSR match). Purely decorative background motion behind the orbit stage.
const AMB = [
  { left: 14, top: 22, size: 6, fd: 9, delay: -0.5 },
  { left: 78, top: 16, size: 9, fd: 11, delay: -3.2 },
  { left: 88, top: 64, size: 5, fd: 8, delay: -1.8 },
  { left: 22, top: 74, size: 8, fd: 12, delay: -4.6 },
  { left: 50, top: 40, size: 5, fd: 10, delay: -2.4 },
  { left: 64, top: 86, size: 7, fd: 9, delay: -5.1 },
  { left: 36, top: 50, size: 6, fd: 13, delay: -0.9 },
];

/* ---------------- ORBIT VISUAL ---------------- */
function OrbitVisual({
  name, goals, contacts,
}: {
  name: string;
  goals: GoalPick[];
  contacts: Person[];
}) {
  const R_INNER = 20, R_MID = 36, R_OUTER = 50;
  const goalNodes = goals.map((g, i) => {
    const a = (i / Math.max(goals.length, 1)) * Math.PI * 2 - Math.PI / 2;
    return { ...g, x: 50 + Math.cos(a) * R_INNER, y: 50 + Math.sin(a) * R_INNER, key: g.label };
  });
  const split = contacts.map((c, i) => {
    const ring = i % 2 === 0 ? 'mid' : 'outer';
    const same = contacts.filter((_, j) => (j % 2 === 0) === (i % 2 === 0));
    const idx = Math.floor(i / 2);
    const r = ring === 'mid' ? R_MID : R_OUTER;
    const a = (idx / Math.max(same.length, 1)) * Math.PI * 2 + (ring === 'outer' ? Math.PI / Math.max(contacts.length, 1) : 0) - Math.PI / 2;
    return { ...c, ring, x: 50 + Math.cos(a) * r, y: 50 + Math.sin(a) * r };
  });
  const mid = split.filter((c) => c.ring === 'mid');
  const outer = split.filter((c) => c.ring === 'outer');

  const amb = AMB;

  return (
    <div className="orbit-wrap">
      {amb.map((a, i) => (
        <span key={i} className="amb" style={{ left: a.left + '%', top: a.top + '%', width: a.size, height: a.size, ['--fd' as string]: a.fd + 's', animationDelay: a.delay + 's' }} />
      ))}
      <div className="ov-stage">
        <div className={'ov-track t-inner' + (goals.length ? ' lit' : '')} />
        <div className={'ov-track t-mid' + (mid.length ? ' lit' : '')} />
        <div className={'ov-track t-outer' + (outer.length ? ' lit' : '')} />

        {/* inner ring: goals */}
        <div className="ov-ring r-inner">
          {goalNodes.map((g) => (
            <div className="node" key={g.key} style={{ left: g.x + '%', top: g.y + '%' }}>
              <div className="upright pop">
                <span className="goal-sat"><span className="gd" style={{ background: g.cl }} />{g.label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* mid ring contacts */}
        <div className="ov-ring r-mid">
          {mid.map((c) => (
            <div className="node" key={c.name} style={{ left: c.x + '%', top: c.y + '%' }}>
              <div className="upright pop">
                <div className="orb" style={{ background: `linear-gradient(150deg, ${c.color}cc, ${c.color})` }}>
                  {initials(c.name)}
                  {c.logo && <span className="badge"><img src={c.logo} alt="" /></span>}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* outer ring contacts */}
        <div className="ov-ring r-outer">
          {outer.map((c) => (
            <div className="node" key={c.name} style={{ left: c.x + '%', top: c.y + '%' }}>
              <div className="upright pop">
                <div className="orb" style={{ background: `linear-gradient(150deg, ${c.color}cc, ${c.color})` }}>
                  {initials(c.name)}
                  {c.logo && <span className="badge"><img src={c.logo} alt="" /></span>}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* hub */}
        <div className="hub">
          <span className="pulse" /><span className="pulse d" />
          {name.trim() ? <span className="hub-init">{initials(name)}</span> : <OrbitLogo className="hub-logo" />}
        </div>
        <div className="you-pill">{name.trim() ? name.trim().split(/\s+/)[0] : 'You'}</div>
      </div>
    </div>
  );
}

/* ---------------- STEPS ---------------- */
function StepIdentity({
  name, setName, email,
}: {
  name: string;
  setName: (v: string) => void;
  email: string;
}) {
  return (
    <div className="step-key anim-in">
      <div>
        <h1 className="q">Let&apos;s get you into orbit.</h1>
      </div>
      <div className="fields">
        <div className="field">
          <label>Your name</label>
          <div className="inp-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" /></svg>
            <input className="inp" placeholder="Rahul Arora" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
        </div>
        <div className="field">
          <label>Email</label>
          <div className="inp-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M4 7l8 6 8-6" /></svg>
            <input className="inp" placeholder="you@company.com" value={email} type="email" disabled />
          </div>
          <p className="hint">Connected to your account.</p>
        </div>
      </div>
    </div>
  );
}

function StepGoals({
  goals, addGoal, removeGoal,
}: {
  goals: GoalPick[];
  addGoal: (label: string) => void;
  removeGoal: (label: string) => void;
}) {
  const [custom, setCustom] = useState('');
  // Cycle the placeholder through example goals while the field is empty.
  const [ph, setPh] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPh((p) => (p + 1) % GOAL_PLACEHOLDERS.length), 2600);
    return () => clearInterval(id);
  }, []);
  const submitCustom = () => { if (custom.trim()) { addGoal(custom.trim()); setCustom(''); } };
  return (
    <div className="step-key anim-in">
      <div>
        <h1 className="q">What are you working toward?</h1>
      </div>
      <div className="add-goal">
        <input
          className="inp"
          placeholder={GOAL_PLACEHOLDERS[ph]}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitCustom()}
          autoFocus
        />
        <button className="mini-btn" onClick={submitCustom}>Add goal</button>
      </div>
      {goals.length > 0 && (
        <div className="goal-list">
          {goals.map((g) => (
            <span className="goal-tag" key={g.label}>
              <span className="gd" style={{ background: g.cl }} />
              {g.label}
              <button className="rm" onClick={() => removeGoal(g.label)} aria-label={`Remove ${g.label}`}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6l-12 12" /></svg>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function StepContacts({
  contacts, importAll, addManual,
}: {
  contacts: Person[];
  importAll: () => void;
  addManual: (name: string, company: string) => void;
}) {
  const [mode, setMode] = useState<null | 'importing' | 'manual'>(null);
  const [mName, setMName] = useState('');
  const [mCo, setMCo] = useState('');

  const doImport = () => { setMode('importing'); importAll(); };
  const doManual = () => {
    if (mName.trim()) { addManual(mName.trim(), mCo.trim()); setMName(''); setMCo(''); }
  };

  return (
    <div className="step-key anim-in">
      <div>
        <h1 className="q">Bring your network in.</h1>
      </div>

      {mode !== 'manual' && (
        <div className="opts">
          <button className={'opt' + (mode === 'importing' ? ' busy' : '')} onClick={doImport}>
            <span className="oic">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 10l5 5 5-5" /><path d="M4 21h16" /></svg>
            </span>
            <span className="ot">
              <h3>{mode === 'importing' ? 'Importing…' : 'Import contacts'}</h3>
              <p>Sync from Google, LinkedIn, or a CSV</p>
            </span>
            <svg className="arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
          <button className="opt" onClick={() => setMode('manual')}>
            <span className="oic">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="8" r="4" /><path d="M3 20c0-3.3 3.6-6 8-6" /><path d="M19 8v8M15 12h8" /></svg>
            </span>
            <span className="ot">
              <h3>Add manually</h3>
              <p>Type in a few key people yourself</p>
            </span>
            <svg className="arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        </div>
      )}

      {mode === 'manual' && (
        <div className="manual">
          <div className="row">
            <input className="inp" placeholder="Name" value={mName} onChange={(e) => setMName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doManual()} autoFocus />
            <input className="inp" placeholder="Company" value={mCo} onChange={(e) => setMCo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doManual()} />
            <button className="mini-btn" onClick={doManual}>Add</button>
          </div>
          <button className="skip" style={{ alignSelf: 'flex-start', marginLeft: -4 }} onClick={() => setMode(null)}>← Back to import</button>
        </div>
      )}

      {contacts.length > 0 && (
        <div className="imported">
          <div className="imp-head">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
            <span className="num">{contacts.length}</span> added to your orbit
          </div>
          {contacts.slice(-3).reverse().map((c, i) => (
            <div className="imp-row" key={c.name} style={{ animationDelay: i * 0.05 + 's' }}>
              <span className="imp-av" style={{ background: `linear-gradient(150deg, ${c.color}cc, ${c.color})` }}>{initials(c.name)}</span>
              <span className="nm">{c.name}</span>
              <span className="co">{c.company}{c.logo && <img src={c.logo} alt="" />}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StepAsk({
  draft, setDraft, finish,
}: {
  draft: string;
  setDraft: (v: string) => void;
  finish: (q: string) => void;
}) {
  return (
    <div className="step-key anim-in">
      <div>
        <h1 className="q">Ask Orbit anything.</h1>
      </div>
      <div className="ask">
        <div className="ask-sugs">
          {CHAT_SUGGESTIONS.map((s) => (
            <button key={s} className="sug" onClick={() => finish(s)}><span className="sp" />{s}</button>
          ))}
        </div>
        <div className="ask-input">
          <input className="inp" placeholder="Ask about your network…" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && draft.trim() && finish(draft)} autoFocus />
          <button className="send" disabled={!draft.trim()} onClick={() => draft.trim() && finish(draft)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ---------------- PAGE ---------------- */
export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="orbit-onboard" />}>
      <OnboardingFlow />
    </Suspense>
  );
}

function OnboardingFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Test mode (?test=1): walk the whole flow without persisting anything — used
  // by the sidebar "Test onboarding" affordance. Lets already-onboarded users in.
  const testMode = searchParams.get('test') === '1';
  const { user, isLoaded } = useUser();

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [goals, setGoals] = useState<GoalPick[]>([]);
  const [contacts, setContacts] = useState<Person[]>([]);
  const [draft, setDraft] = useState('');
  const [phase, setPhase] = useState<'onboard' | 'launch'>('onboard');
  const [prefilled, setPrefilled] = useState(false);

  const alreadyOnboarded = isLoaded && user?.unsafeMetadata?.onboarded === true;

  // Bounce anyone who has already finished onboarding back to the app — unless
  // they're explicitly here to test the flow.
  useEffect(() => {
    if (alreadyOnboarded && !testMode) router.replace('/');
  }, [alreadyOnboarded, testMode, router]);

  // Prefill identity from Clerk once it loads. Render-time derived-state pattern
  // (guarded by `prefilled`) — same approach as CompanyLogo — so we never call
  // setState inside an effect.
  if (isLoaded && user && !prefilled) {
    setPrefilled(true);
    setName(user.fullName || '');
    setEmail(user.primaryEmailAddress?.emailAddress ?? '');
  }

  // Create the goal for real as it's typed — same path as the rest of the app
  // (a Goal row, then an AI photo generated in the background). Test mode keeps
  // it local-only so nothing is written. The orbit satellite shows immediately;
  // the real id is patched in once the row exists so it can be removed again.
  const addGoalLive = async (label: string) => {
    const t = label.trim();
    if (!t || goals.some((g) => g.label.toLowerCase() === t.toLowerCase())) return;
    const cl = ORB_COLORS[goals.length % ORB_COLORS.length];
    setGoals((gs) => [...gs, { label: t, cl }]);
    if (testMode) return;
    try {
      const goal = await createGoal({ title: t });
      setGoals((gs) => gs.map((g) => (g.label === t ? { ...g, id: goal.id } : g)));
      void generateGoalImage(goal.id, goal.title).catch(() => {});
    } catch (e) {
      console.error('Create goal failed', e);
    }
  };
  const removeGoalLive = (label: string) => {
    const target = goals.find((g) => g.label === label);
    setGoals((gs) => gs.filter((g) => g.label !== label));
    if (!testMode && target?.id) void removeGoalApi(target.id).catch(console.error);
  };

  const importAll = () => {
    SAMPLE_CONTACTS.forEach((c, i) => {
      setTimeout(() => setContacts((cs) => cs.some((x) => x.name === c.name)
        ? cs
        : [...cs, { name: c.name, company: c.company, logo: c.logo, color: c.color, seed: c }]), 140 * i + 120);
    });
  };
  const addManual = (nm: string, co: string) =>
    setContacts((cs) => [...cs, { name: nm, company: co || '—', logo: null, color: ORB_COLORS[cs.length % ORB_COLORS.length] }]);

  const canNext = step === 0 ? name.trim().length > 0 : true;
  const next = () => setStep((s) => Math.min(s + 1, STEP_COUNT - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  async function finish(q: string) {
    setPhase('launch');

    if (testMode) {
      // Preview only — persist nothing, just show the launch beat and land in chat.
      await delay(1400);
      router.replace(`/chat?q=${encodeURIComponent(q)}`);
      return;
    }

    const payloadContacts: OnboardingContactInput[] = contacts.map((c) =>
      c.seed
        ? {
            name: c.seed.name, company: c.seed.company, role: c.seed.role,
            email: c.seed.email, linkedinUrl: c.seed.linkedinUrl, tags: c.seed.tags,
            warmth: c.seed.warmth, status: c.seed.status,
          }
        : { name: c.name, company: c.company === '—' ? '' : c.company },
    );

    try {
      await Promise.all([
        completeOnboarding({ contacts: payloadContacts }),
        delay(1400),
      ]);
      if (user) {
        // Persist an edited display name back to Clerk (best-effort), and flag
        // the account so we never re-run onboarding for it.
        const trimmed = name.trim();
        const profileChanged = trimmed && trimmed !== (user.fullName ?? '');
        const [firstName, ...rest] = trimmed.split(/\s+/);
        await user.update({
          ...(profileChanged ? { firstName, lastName: rest.join(' ') } : {}),
          unsafeMetadata: { ...user.unsafeMetadata, onboarded: true },
        });
      }
    } catch (e) {
      console.error('Onboarding completion failed', e);
    }

    router.replace(`/chat?q=${encodeURIComponent(q)}`);
  }

  return (
    <div className="orbit-onboard">
      <div className="stage">
        <div className="visual">
          <OrbitVisual name={name} goals={goals} contacts={contacts} />
        </div>

        <div className="panel">
          <div className="phead">
            <span className="brand"><OrbitLogo size={26} className="logo" /> Orbit</span>
            {testMode && <span className="test-badge">Test mode · nothing saved</span>}
            <span className="spacer" />
            {step === 1 && <button className="skip" onClick={next}>Skip for now</button>}
            {step === 2 && contacts.length === 0 && <button className="skip" onClick={next}>I&apos;ll do this later</button>}
          </div>

          <div className="stepper">
            {Array.from({ length: STEP_COUNT }).map((_, i) => (
              <div key={i} className={'seg' + (i < step ? ' done' : i === step ? ' active' : '')}><i /></div>
            ))}
          </div>

          <div className="pbody">
            <div key={step}>
              {step === 0 && <StepIdentity name={name} setName={setName} email={email} />}
              {step === 1 && <StepGoals goals={goals} addGoal={addGoalLive} removeGoal={removeGoalLive} />}
              {step === 2 && <StepContacts contacts={contacts} importAll={importAll} addManual={addManual} />}
              {step === 3 && <StepAsk draft={draft} setDraft={setDraft} finish={finish} />}
            </div>
          </div>

          {step < 3 && (
            <div className="pfoot">
              {step > 0 && (
                <button className="btn btn-back" onClick={back} aria-label="Back">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
                </button>
              )}
              <button className="btn btn-primary" disabled={!canNext} onClick={next}>
                {step === 0 && 'Continue'}
                {step === 1 && (goals.length ? `Continue with ${goals.length} ${goals.length === 1 ? 'goal' : 'goals'}` : 'Continue')}
                {step === 2 && (contacts.length ? `Continue with ${contacts.length}` : 'Continue')}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>
            </div>
          )}
        </div>

        {phase === 'launch' && (
          <div className="launch">
            <div className="launch-core">
              <div className="ring2"><OrbitLogo size={40} /></div>
              <h2>Entering Orbit…</h2>
              <p>Bringing your network online</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
