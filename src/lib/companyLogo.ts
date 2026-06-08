/**
 * Best-effort guess of a company's primary domain from its display name.
 * 'Polymarket' -> 'polymarket.com'. Passes through values that already look
 * like a domain. Returns '' for empty input.
 */
export function companyDomainGuess(company: string): string {
  const c = company.trim().toLowerCase();
  if (!c) return '';
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(c)) return c; // already a domain
  const slug = c.replace(/[^a-z0-9]/g, '');
  return slug ? `${slug}.com` : '';
}

/**
 * Human-friendly label for a company value. If the value was entered as a
 * domain to pin the right logo (e.g. 'columbia.edu'), show just the name part
 * ('Columbia'). Plain names ('Polymarket') pass through unchanged.
 */
export function companyDisplayName(company: string): string {
  const c = company.trim();
  if (!c) return '';
  const lower = c.toLowerCase();
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(lower)) {
    const name = lower.replace(/^www\./, '').split('.')[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  return c;
}

/** Clearbit logo URL for a company, or '' if no company. */
export function companyLogoUrl(company: string): string {
  const domain = companyDomainGuess(company);
  return domain ? `https://logo.clearbit.com/${domain}` : '';
}

/** Google favicon URL (fallback logo source), or '' if no company. */
export function faviconUrl(company: string): string {
  const domain = companyDomainGuess(company);
  return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : '';
}
