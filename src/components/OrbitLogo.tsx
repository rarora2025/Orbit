interface Props {
  size?: number;
  className?: string;
}

export default function OrbitLogo({ size = 28, className = '' }: Props) {
  const id = 'orbit-logo';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {/* Main ring gradient: orange bottom-left → pink → indigo top-right */}
        <linearGradient id={`${id}-ring`} x1="4" y1="25" x2="24" y2="4" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="45%" stopColor="#ec4899" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
        {/* Arc gradient: orange → fades out */}
        <linearGradient id={`${id}-arc`} x1="2" y1="22" x2="26" y2="8" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="60%" stopColor="#f43f5e" />
          <stop offset="100%" stopColor="#818cf8" stopOpacity="0.2" />
        </linearGradient>
        {/* Glow filter for satellite */}
        <filter id={`${id}-glow`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="0.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Main orbit circle */}
      <circle
        cx="13"
        cy="14"
        r="9.5"
        stroke={`url(#${id}-ring)`}
        strokeWidth="1.9"
        fill="none"
        opacity="0.92"
      />

      {/* Saturn-style ring arc sweeping diagonally through */}
      <ellipse
        cx="13.5"
        cy="16.5"
        rx="13"
        ry="4.2"
        transform="rotate(-28 13.5 16.5)"
        stroke={`url(#${id}-arc)`}
        strokeWidth="1.5"
        fill="none"
        opacity="0.88"
      />

      {/* Satellite sphere at top-right of orbit */}
      <circle
        cx="22.5"
        cy="6.5"
        r="2.4"
        fill="#93c5fd"
        opacity="0.95"
        filter={`url(#${id}-glow)`}
      />
      {/* Highlight on satellite */}
      <circle cx="21.8" cy="5.8" r="0.9" fill="white" opacity="0.55" />
    </svg>
  );
}
