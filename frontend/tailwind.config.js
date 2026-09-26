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
        // SYNAPSE database/Hermes orange palette
        synapse: {
          50:  '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',   // primary: Hermes Orange
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
          950: '#431407',
        },
        hermes: {
          50:  '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',   // Hermes orange
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        dark: {
          bg:      '#050508',  // Deep database black
          surface: '#0a0a0f',  // Dark charcoal panel
          card:    '#0f0f16',  // Sharp card
          border:  '#1c1c28',  // Tech border
          hover:   '#181824',  // Hover state
          muted:   '#28283a',  // Muted tech element
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      backgroundImage: {
        'synapse-gradient': 'linear-gradient(135deg, #050508 0%, #0a0a0f 50%, #0f0f16 100%)',
        'hero-glow': 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(249,115,22,0.15) 0%, transparent 75%)',
        'card-glow': 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(249,115,22,0.08) 0%, transparent 70%)',
        'hermes-glow': 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(249,115,22,0.15) 0%, transparent 70%)',
      },
      boxShadow: {
        'synapse': '0 0 40px rgba(249,115,22,0.08)',
        'card': '0 4px 20px rgba(0,0,0,0.6)',
        'glow-sm': '0 0 10px rgba(249,115,22,0.25)',
        'glow-md': '0 0 20px rgba(249,115,22,0.35)',
        'hermes': '0 0 20px rgba(249,115,22,0.35)',
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
          '50%': { transform: 'translateY(-6px)' },
        },
        glow: {
          from: { boxShadow: '0 0 10px rgba(249,115,22,0.2)' },
          to:   { boxShadow: '0 0 20px rgba(249,115,22,0.4)' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateY(-6px)' },
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
      // SHARP CORNERS: Redefine border radius to be very small and sharp
      borderRadius: {
        'none': '0px',
        'sm': '1px',
        'DEFAULT': '2px',
        'md': '2px',
        'lg': '3px',
        'xl': '4px',
        '2xl': '4px',
        '3xl': '6px',
        'xl2': '4px',
        'xl3': '6px',
      },
    },
  },
  plugins: [],
}
