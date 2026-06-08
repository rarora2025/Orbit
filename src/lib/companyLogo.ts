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

/**
 * Primary logo URL for a company, or '' if no company. Uses Google's favicon
 * service at sz=256, which returns the largest icon a site offers (so it stays
 * sharp when scaled into the card). Clearbit's free Logo API (logo.clearbit.com)
 * was discontinued — its host no longer resolves — and DuckDuckGo only serves
 * 32–48px icons, which look blurry; both are avoided here.
 */
export function companyLogoUrl(company: string): string {
  const domain = companyDomainGuess(company);
  return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=256` : '';
}

/**
 * Fallback logo URL from an independent provider (DuckDuckGo), or '' if no
 * company. Used only when the primary source fails to load, so a transient
 * Google outage still resolves to a logo rather than a blank initial block.
 */
export function faviconUrl(company: string): string {
  const domain = companyDomainGuess(company);
  return domain ? `https://icons.duckduckgo.com/ip3/${domain}.ico` : '';
}
