import React from 'react';

/**
 * NETRA Iconic Logo & Wordmark
 * Inspired by modern futuristic AI infrastructure aesthetic (clean geometric aperture / neural lens).
 *
 * @param {number} size - Size of the icon in pixels (default: 32)
 * @param {boolean} showText - Whether to render the wordmark "netra" (default: true)
 * @param {string} textClassName - Custom class name for the wordmark
 * @param {boolean} isNeon - Whether to render with OpenRouter-style electric neon lime (default: true)
 */
export default function NetraLogo({ size = 32, showText = true, isNeon = true, style = {} }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: size >= 40 ? '0.75rem' : '0.5rem', ...style }}>
      {/* Geometric Neural Lens / Aperture Emblem */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        {/* Background rounded squircle */}
        <rect
          width="48"
          height="48"
          rx="12"
          fill={isNeon ? "var(--logo-bg, #d2f823)" : "currentColor"}
        />
        {/* Inner stylized aperture / lens glyph (dark on neon) */}
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M24 10C16.268 10 10 16.268 10 24C10 31.732 16.268 38 24 38C31.732 38 38 31.732 38 24C38 16.268 31.732 10 24 10ZM16.5 24C16.5 19.8579 19.8579 16.5 24 16.5C28.1421 16.5 31.5 19.8579 31.5 24C31.5 28.1421 28.1421 31.5 24 31.5C19.8579 31.5 16.5 28.1421 16.5 24Z"
          fill={isNeon ? "var(--logo-glyph, #06070a)" : "var(--bg-canvas, #ffffff)"}
        />
        {/* Focused optical focal point / pupil */}
        <circle
          cx="24"
          cy="24"
          r="4.5"
          fill={isNeon ? "var(--logo-glyph, #06070a)" : "var(--bg-canvas, #ffffff)"}
        />
        {/* Top-right gateway intake notch for unique aperture character */}
        <path
          d="M33 15L36 12"
          stroke={isNeon ? "var(--logo-glyph, #06070a)" : "var(--bg-canvas, #ffffff)"}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>

      {/* Wordmark in OpenRouter-style geometric lowercase */}
      {showText && (
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 800,
            fontSize: size >= 40 ? '1.75rem' : size >= 30 ? '1.25rem' : '1rem',
            letterSpacing: '-0.035em',
            color: 'var(--text-primary)',
            lineHeight: 1,
            userSelect: 'none'
          }}
        >
          netra
        </span>
      )}
    </div>
  );
}

