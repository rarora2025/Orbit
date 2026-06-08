function titleCase(token: string): string {
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

/**
 * Extract a person's name from a LinkedIn profile URL slug.
 * Returns '' if no /in/ or /pub/ slug can be parsed.
 */
export function deriveNameFromLinkedInUrl(url: string): string {
  if (!url) return '';
  const match = url.match(/linkedin\.com\/(?:in|pub)\/([^/?#]+)/i);
  if (!match) return '';

  const slug = decodeURIComponent(match[1]);
  const tokens = slug.split('-').filter(Boolean);

  // Drop trailing id-like tokens (LinkedIn appends a numeric/hex id).
  // Names don't contain digits, so a trailing token with a digit is an id.
  while (tokens.length > 1 && /\d/.test(tokens[tokens.length - 1])) {
    tokens.pop();
  }

  return tokens.map(titleCase).join(' ');
}

/**
 * Decide the name field value when a URL changes: auto-fill from the URL only
 * when the user hasn't typed a name; never overwrite an existing name.
 */
export function resolveAutoName(currentName: string, url: string): string {
  if (currentName.trim()) return currentName;
  return deriveNameFromLinkedInUrl(url);
}
