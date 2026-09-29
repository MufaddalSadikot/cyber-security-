/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0a0e1a',
          soft: '#0f1524',
          card: '#131a2e',
          hover: '#1a2338',
        },
        line: '#212b45',
        brand: {
          DEFAULT: '#3b82f6',
          soft: '#60a5fa',
          deep: '#1d4ed8',
        },
        accent: '#22d3ee',
        ok: '#10b981',
        warn: '#f59e0b',
        danger: '#ef4444',
        muted: '#7c89a8',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(59,130,246,0.3), 0 8px 30px rgba(59,130,246,0.15)',
      },
      keyframes: {
        pulseline: {
          '0%,100%': { opacity: '0.3' },
          '50%': { opacity: '1' },
        },
        flow: {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '50%': { opacity: '1' },
          '100%': { transform: 'translateY(400%)', opacity: '0' },
        },
      },
      animation: {
        pulseline: 'pulseline 2s ease-in-out infinite',
        flow: 'flow 1.6s linear infinite',
      },
    },
  },
  plugins: [],
};
