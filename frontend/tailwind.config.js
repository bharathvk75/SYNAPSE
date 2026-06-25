/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // SYNAPSE dark palette
        synapse: {
          50:  '#f0f4ff',
          100: '#e0e9ff',
          200: '#c2d1ff',
          300: '#94aeff',
          400: '#6c8bff',
          500: '#4f6ef7',   // primary
          600: '#3d52e0',
          700: '#3040c4',
          800: '#2b36a0',
          900: '#27337e',
          950: '#1b2050',
        },
        hermes: {
          50:  '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',   // Hermes orange
          600: '#ea6e0d',
          700: '#c2570a',
          800: '#9a4510',
          900: '#7c3a10',
        },
        dark: {
          bg:      '#0c0e1a',
          surface: '#111325',
          card:    '#161830',
          border:  '#1e2240',
          hover:   '#1c2045',
          muted:   '#2a2f52',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      backgroundImage: {
        'synapse-gradient': 'linear-gradient(135deg, #0c0e1a 0%, #111325 50%, #161830 100%)',
        'hero-glow': 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(79,110,247,0.15) 0%, transparent 70%)',
        'card-glow': 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(79,110,247,0.08) 0%, transparent 70%)',
        'hermes-glow': 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(249,115,22,0.12) 0%, transparent 70%)',
      },
      boxShadow: {
        'synapse': '0 0 40px rgba(79,110,247,0.15)',
        'card': '0 4px 24px rgba(0,0,0,0.4)',
        'glow-sm': '0 0 12px rgba(79,110,247,0.3)',
        'glow-md': '0 0 24px rgba(79,110,247,0.4)',
        'hermes': '0 0 24px rgba(249,115,22,0.3)',
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'slide-in': 'slideIn 0.3s ease-out',
        'fade-in': 'fadeIn 0.4s ease-out',
        'typing': 'typing 1.5s steps(30, end)',
        'scanline': 'scanline 2s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        glow: {
          from: { boxShadow: '0 0 12px rgba(79,110,247,0.3)' },
          to:   { boxShadow: '0 0 24px rgba(79,110,247,0.6)' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        scanline: {
          '0%':   { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '0 100%' },
        },
      },
      borderRadius: {
        'xl2': '1rem',
        'xl3': '1.5rem',
      },
    },
  },
  plugins: [],
}
