interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
}

const SIZE_MAP = {
  sm: { icon: 34, title: '1.15rem', sub: '0.58rem' },
  md: { icon: 42, title: '1.3rem', sub: '0.63rem' },
  lg: { icon: 56, title: '1.68rem', sub: '0.72rem' },
};

export function BrandLogo({ size = 'md', showWordmark = true }: BrandLogoProps) {
  const dims = SIZE_MAP[size];

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: size === 'lg' ? 14 : 11 }}>
      <span
        style={{
          width: dims.icon,
          height: dims.icon,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          filter: 'drop-shadow(0 0 12px rgba(255, 184, 0, 0.35))',
          flexShrink: 0,
        }}
      >
        <img
          src="/logo.svg"
          alt="KeyVerse Logo"
          width={dims.icon}
          height={dims.icon}
          style={{ display: 'block', width: '100%', height: '100%' }}
        />
      </span>

      {showWordmark && (
        <span className="brand-stack">
          <span className="brand-text" style={{ fontSize: dims.title }}>
            KEY<span>VERSE</span>
          </span>
          <span className="brand-sub" style={{ fontSize: dims.sub }}>
            TYPING CHAMPIONSHIP
          </span>
        </span>
      )}
    </span>
  );
}
