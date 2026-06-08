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
  it('builds a Clearbit logo URL', () => {
    expect(companyLogoUrl('Polymarket')).toBe('https://logo.clearbit.com/polymarket.com');
  });
  it('builds a favicon URL', () => {
    expect(faviconUrl('Polymarket')).toBe('https://www.google.com/s2/favicons?domain=polymarket.com&sz=128');
  });
  it('returns empty when there is no company', () => {
    expect(companyLogoUrl('')).toBe('');
    expect(faviconUrl('')).toBe('');
  });
});
