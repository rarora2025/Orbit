import { describe, it, expect } from 'vitest';
import { companyDomainGuess, companyLogoUrl, faviconUrl } from './companyLogo';

describe('companyDomainGuess', () => {
  it('guesses a .com domain from a single-word company', () => {
    expect(companyDomainGuess('Polymarket')).toBe('polymarket.com');
  });
  it('strips spaces and punctuation', () => {
    expect(companyDomainGuess('Prize Picks!')).toBe('prizepicks.com');
  });
  it('passes through an input that is already a domain', () => {
    expect(companyDomainGuess('columbia.edu')).toBe('columbia.edu');
  });
  it('returns empty for empty input', () => {
    expect(companyDomainGuess('')).toBe('');
    expect(companyDomainGuess('   ')).toBe('');
  });
});

describe('companyLogoUrl / faviconUrl', () => {
  // Clearbit's free Logo API was discontinued — logo.clearbit.com no longer
  // resolves, so a contact pointed at it renders a broken-image icon. The
  // primary source must be a live provider AND request a high-res icon so it
  // doesn't look blurry when scaled into the card.
  it('builds a high-res logo URL from a live provider (not the dead Clearbit API)', () => {
    const url = companyLogoUrl('Polymarket');
    expect(url).not.toContain('clearbit');
    expect(url).toBe('https://www.google.com/s2/favicons?domain=polymarket.com&sz=256');
  });
  it('builds a favicon URL from an independent fallback provider', () => {
    expect(faviconUrl('Polymarket')).toBe('https://icons.duckduckgo.com/ip3/polymarket.com.ico');
  });
  it('returns empty when there is no company', () => {
    expect(companyLogoUrl('')).toBe('');
    expect(faviconUrl('')).toBe('');
  });
});
