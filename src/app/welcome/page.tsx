'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { LogIn } from 'lucide-react';
import OrbitLogo from '@/components/OrbitLogo';

// Companies shown on the orbital network. Each orb gets a distinct logo and the
// set cycles through any extras over time. Logos live in /public/welcome/logos.
const COMPANIES = [
  { n: 'SpaceX', logo: '/welcome/logos/spacex.jpeg', s: 'Aerospace' },
  { n: 'Anthropic', logo: '/welcome/logos/anthropic.png', s: 'AI' },
  { n: 'OpenAI', logo: '/welcome/logos/openai.png', s: 'AI' },
  { n: 'Stripe', logo: '/welcome/logos/stripe.png', s: 'Payments' },
  { n: 'Anduril', logo: '/welcome/logos/anduril.png', s: 'Defense' },
  { n: 'Cursor', logo: '/welcome/logos/cursor.png', s: 'Dev tools' },
  { n: 'Ramp', logo: '/welcome/logos/ramp.png', s: 'Fintech' },
  { n: 'Polymarket', logo: '/welcome/logos/polymarket.png', s: 'Markets' },
  { n: 'Kalshi', logo: '/welcome/logos/kalshi.png', s: 'Markets' },
];

const RING2 = [
  { left: '73.3%', top: '73.3%', delay: '-1.2s' },
  { left: '26.7%', top: '73.3%', delay: '-2.8s' },
  { left: '26.7%', top: '26.7%', delay: '-0.4s' },
  { left: '73.3%', top: '26.7%', delay: '-3.6s' },
];
const RING3 = [
  { left: '94%', top: '50%', delay: '-2.1s' },
  { left: '50%', top: '94%', delay: '-0.7s' },
  { left: '6%', top: '50%', delay: '-3.3s' },
  { left: '50%', top: '6%', delay: '-1.6s' },
];

export default function WelcomePage() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.classList.add('reveal-ready');
    const cleanups: Array<() => void> = [];

    // --- reveal on scroll ---
    const reveals = Array.from(root.querySelectorAll<HTMLElement>('.reveal'));
    const show = (el: Element) => el.classList.add('in');
    const inView = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.top < window.innerHeight * 0.92 && r.bottom > 0;
    };
    reveals.forEach((el, i) => {
      el.style.transitionDelay = Math.min(i % 5, 4) * 55 + 'ms';
      if (inView(el)) show(el);
    });
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            show(en.target);
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0, rootMargin: '0px 0px -6% 0px' },
    );
    reveals.forEach((el) => {
      if (!el.classList.contains('in')) io.observe(el);
    });
    const failsafe = window.setTimeout(() => reveals.forEach(show), 2500);
    cleanups.push(() => io.disconnect());
    cleanups.push(() => window.clearTimeout(failsafe));

    // --- cycle the floating insight chips ---
    function cycleChip(sel: string, msgs: string[], dotColors: string[]) {
      const chip = root!.querySelector<HTMLElement>(sel);
      if (!chip) return;
      const txt = chip.querySelector<HTMLElement>('.txt');
      if (!txt) return;
      let i = 0;
      const id = window.setInterval(() => {
        txt.style.opacity = '0';
        window.setTimeout(() => {
          i = (i + 1) % msgs.length;
          txt.textContent = msgs[i];
          chip.style.setProperty('--cdot', dotColors[i]);
          txt.style.opacity = '1';
        }, 380);
      }, 3000);
      cleanups.push(() => window.clearInterval(id));
    }
    cycleChip(
      '.insight-a',
      ['3 follow-ups due today', 'Best time to reach out: now', '2 intros worth making',
        'A thread is going cold', 'Ask about their launch', 'You met 4 people this week'],
      ['var(--amber)', 'var(--green)', 'var(--blue)', 'var(--red)', 'var(--accent)', 'var(--green)'],
    );
    cycleChip(
      '.insight-b',
      ['A reply just went warm', "You're light on design contacts", 'Re-engage 1 gone quiet',
        'Strong in fintech right now', 'Worth a coffee next week', 'Reply before they forget'],
      ['var(--green)', 'var(--blue)', 'var(--red)', 'var(--accent)', 'var(--amber)', 'var(--blue)'],
    );

    // --- interactive orbit: company orbs that change + hover to inspect ---
    const chips = Array.from(root.querySelectorAll<HTMLElement>('.chip'));
    const rnd = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
    const shown = new Set<string>();
    const compOf = new WeakMap<HTMLElement, (typeof COMPANIES)[number]>();
    function assign(chip: HTMLElement, comp: (typeof COMPANIES)[number]) {
      const prev = compOf.get(chip);
      if (prev) shown.delete(prev.n);
      shown.add(comp.n);
      compOf.set(chip, comp);
      let img = chip.querySelector<HTMLImageElement>('.orb-logo');
      if (!img) {
        img = document.createElement('img');
        img.className = 'orb-logo';
        img.alt = '';
        img.loading = 'lazy';
        chip.insertBefore(img, chip.firstChild);
      }
      img.src = comp.logo;
      const tip = chip.querySelector('.orb-tip');
      if (tip) tip.textContent = comp.n + ' · ' + comp.s;
    }
    const shuffled = COMPANIES.slice().sort(() => Math.random() - 0.5);
    chips.forEach((chip, i) => assign(chip, shuffled[i % shuffled.length]));
    const swap = window.setInterval(() => {
      const chip = rnd(chips);
      if (chip.matches(':hover')) return;
      const avail = COMPANIES.filter((c) => !shown.has(c.n));
      if (!avail.length) return;
      const next = rnd(avail);
      const img = chip.querySelector<HTMLImageElement>('.orb-logo');
      if (img) img.style.opacity = '0';
      window.setTimeout(() => {
        assign(chip, next);
        if (img) img.style.opacity = '1';
      }, 340);
    }, 1800);
    cleanups.push(() => window.clearInterval(swap));

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return (
    <div className="orbit-landing" ref={rootRef}>
      {/* ---------- nav (matches the app's floating glass pill exactly:
           same classes as components/Sidebar.tsx, and `font-sans` forces the
           app's Geist face instead of the landing's Plus Jakarta Sans) ---------- */}
      <header className="font-sans fixed left-3 right-3 top-3 z-40 flex items-center rounded-2xl bg-white/40 backdrop-blur-2xl backdrop-saturate-150 border border-white/50 ring-1 ring-black/5 shadow-lg shadow-stone-500/10 h-12 px-3">
        <Link href="/welcome" className="flex items-center gap-2 flex-shrink-0" aria-label="Orbit home">
          <OrbitLogo size={22} />
          <span className="text-sm font-semibold text-stone-800 tracking-tight">Orbit</span>
        </Link>
        <div className="ml-auto flex items-center flex-shrink-0">
          <Link
            href="/sign-in"
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[13px] font-medium bg-orange-500 text-white shadow-sm shadow-orange-500/30 hover:bg-orange-600 transition-all duration-150"
          >
            <LogIn size={14} className="flex-shrink-0" />
            <span className="whitespace-nowrap">Sign in</span>
          </Link>
        </div>
      </header>

      {/* ---------- hero ---------- */}
      <section className="hero">
        <div className="wrap">
          <h1 className="reveal">
            Turn your network into your career <span className="accent">operating system.</span>
          </h1>
          <p className="hero-sub reveal">
            Orbit helps you organize the people, projects, and opportunities shaping your career.
          </p>

          {/* orbital network */}
          <div className="orbit-hero reveal">
            <div className="orbit-stage" aria-hidden="true">
              <div className="glow" />
              <div className="track t1" />
              <div className="track t2" />
              <div className="track t3" />
              <div className="oring oring2">
                {RING2.map((p, i) => (
                  <div key={i} className="orbit-node" style={{ left: p.left, top: p.top }}>
                    <div className="chip" style={{ width: 46, height: 46, animationDelay: p.delay }}>
                      <span className="orb-tip" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="oring oring3">
                {RING3.map((p, i) => (
                  <div key={i} className="orbit-node" style={{ left: p.left, top: p.top }}>
                    <div className="chip" style={{ width: 46, height: 46, animationDelay: p.delay }}>
                      <span className="orb-tip" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="hub">
                <OrbitLogo />
              </div>
              <div className="you-pill">You</div>
              <div className="insight-chip insight-a">
                <span className="dot" />
                <span className="txt">3 follow-ups due today</span>
              </div>
              <div className="insight-chip insight-b">
                <span className="dot" />
                <span className="txt">A reply just went warm</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
