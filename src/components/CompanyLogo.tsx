'use client';

import { useState } from 'react';
import { companyLogoUrl, faviconUrl } from '@/lib/companyLogo';

interface Props {
  company: string;
  /** Single-letter fallback shown when no logo resolves. */
  fallbackInitial: string;
  /** Tailwind classes for the fallback initial block (bg + text color). */
  fallbackColor: string;
  /** Tailwind sizing/shape classes applied to the logo + fallback box. */
  className?: string;
  /** White-knockout the logo so it reads on a dark banner. */
  knockout?: boolean;
}

/**
 * Renders a company logo, silently degrading: site logo -> Google favicon
 * -> a colored initial block. A broken-image icon is never shown.
 */
export default function CompanyLogo({
  company,
  fallbackInitial,
  fallbackColor,
  className = '',
  knockout = false,
}: Props) {
  // stage 0 = site logo, 1 = favicon, 2 = initial block
  const [stage, setStage] = useState(0);
  // Track the last company we rendered for — reset stage synchronously on change
  // (derived-state pattern: avoids useEffect setState triggering cascading renders).
  const [prevCompany, setPrevCompany] = useState(company);
  if (prevCompany !== company) {
    setPrevCompany(company);
    setStage(0);
  }

  const logo = companyLogoUrl(company);
  const favicon = faviconUrl(company);
  const src = stage === 0 ? logo : stage === 1 ? favicon : '';

  if (!company || !src) {
    return (
      <div className={`flex items-center justify-center font-bold ${fallbackColor} ${className}`}>
        {fallbackInitial}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${company} logo`}
      onError={() => setStage((s) => s + 1)}
      className={`object-contain ${className}`}
      style={knockout ? { filter: 'brightness(0) invert(1)' } : undefined}
    />
  );
}
