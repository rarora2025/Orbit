// Shared, framework-neutral constants for the onboarding flow. Imported by both
// the client onboarding page (for the live orbit visual) and the server action
// that turns the chosen sample people into real contacts.
import type { Status, Warmth } from './mockData';

/** Pre-baked goal suggestions shown as chips on the Goals step. */
export const GOAL_OPTS: { label: string; cl: string }[] = [
  { label: 'Fundraising', cl: '#6366f1' },
  { label: 'Hiring', cl: '#10b981' },
  { label: 'Finding a job', cl: '#3b82f6' },
  { label: 'Sales & BD', cl: '#f59e0b' },
  { label: 'Mentors', cl: '#ec4899' },
  { label: 'Partnerships', cl: '#14b8a6' },
];

/** First-question suggestions on the Ask step. */
export const SUGS: string[] = [
  'Who should I follow up with this week?',
  'Who in my network can help me fundraise?',
  'Which relationships are going cold?',
];

/** Colors cycled for manually-added orbs / avatars. */
export const ORB_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#14b8a6', '#f43f5e', '#0ea5e9',
];

/** A person the user can import as a starter contact. The visual-only fields
 *  (logo, color) drive the orbit orbs; the rest seeds a real Contact row. */
export interface ContactSeed {
  name: string;
  company: string;
  role: string;
  email: string;
  linkedinUrl: string;
  /** Public path used for the orb badge in the visual. */
  logo: string;
  /** Orb gradient color in the visual + avatar fallback. */
  color: string;
  tags: string[];
  warmth: Warmth;
  status: Status;
}

/** Curated starter network — mirrors the prototype's payoff (Sarah Chen at
 *  Anthropic, Priya Patel at Stripe, …) so the first chat answer is grounded. */
export const SAMPLE_CONTACTS: ContactSeed[] = [
  { name: 'Sarah Chen', company: 'Anthropic', role: 'Research Lead', email: 'sarah@anthropic.com', linkedinUrl: 'https://www.linkedin.com/in/sarahchen', logo: '/welcome/logos/anthropic.png', color: '#cc785c', tags: ['AI', 'Research'], warmth: 'High', status: 'Pending' },
  { name: 'Marcus Lee', company: 'OpenAI', role: 'Product Manager', email: 'marcus@openai.com', linkedinUrl: 'https://www.linkedin.com/in/marcuslee', logo: '/welcome/logos/openai.png', color: '#0ea37f', tags: ['AI', 'Product'], warmth: 'Medium', status: 'Send' },
  { name: 'Priya Patel', company: 'Stripe', role: 'Payments Lead', email: 'priya@stripe.com', linkedinUrl: 'https://www.linkedin.com/in/priyapatel', logo: '/welcome/logos/stripe.png', color: '#635bff', tags: ['Payments', 'Fintech'], warmth: 'High', status: 'Pending' },
  { name: 'Devon Brooks', company: 'Ramp', role: 'Finance Partner', email: 'devon@ramp.com', linkedinUrl: 'https://www.linkedin.com/in/devonbrooks', logo: '/welcome/logos/ramp.png', color: '#1f7a3d', tags: ['Fintech', 'Finance'], warmth: 'Medium', status: 'Send' },
  { name: 'Alex Rivera', company: 'Cursor', role: 'Founding Engineer', email: 'alex@cursor.com', linkedinUrl: 'https://www.linkedin.com/in/alexrivera', logo: '/welcome/logos/cursor.png', color: '#111317', tags: ['Dev tools', 'Engineering'], warmth: 'Medium', status: 'Send' },
  { name: 'Jordan Wu', company: 'SpaceX', role: 'Operations', email: 'jordan@spacex.com', linkedinUrl: 'https://www.linkedin.com/in/jordanwu', logo: '/welcome/logos/spacex.jpeg', color: '#1c2230', tags: ['Aerospace', 'Operations'], warmth: 'Low', status: 'Send' },
  { name: 'Sam Okafor', company: 'Polymarket', role: 'Markets Lead', email: 'sam@polymarket.com', linkedinUrl: 'https://www.linkedin.com/in/samokafor', logo: '/welcome/logos/polymarket.png', color: '#1c6cf3', tags: ['Prediction markets', 'Markets'], warmth: 'High', status: 'Send' },
  { name: 'Taylor Quinn', company: 'Kalshi', role: 'Growth', email: 'taylor@kalshi.com', linkedinUrl: 'https://www.linkedin.com/in/taylorquinn', logo: '/welcome/logos/kalshi.png', color: '#0f9d6b', tags: ['Prediction markets', 'Markets'], warmth: 'Medium', status: 'Send' },
  { name: 'Noah Bauer', company: 'Anduril', role: 'Business Development', email: 'noah@anduril.com', linkedinUrl: 'https://www.linkedin.com/in/noahbauer', logo: '/welcome/logos/anduril.png', color: '#2b2b2b', tags: ['Defense', 'BD'], warmth: 'Low', status: 'Send' },
];

/** Two-letter initials for an orb / avatar. */
export function initials(name: string): string {
  return (
    name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '•'
  );
}
