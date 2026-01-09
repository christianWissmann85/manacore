/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // MTG Mana colors
        mana: {
          white: '#F8F6D8',
          blue: '#0E68AB',
          black: '#150B00',
          red: '#D3202A',
          green: '#00733E',
          colorless: '#CBC2BF',
        },
        // Modern "Glass-Box" UI Palette
        glass: {
          base: '#0f172a', // slate-900
          surface: 'rgba(15, 23, 42, 0.6)',
          panel: 'rgba(30, 41, 59, 0.4)',
          border: 'rgba(255, 255, 255, 0.08)',
          highlight: 'rgba(255, 255, 255, 0.1)',
          text: {
            primary: '#f1f5f9', // slate-100
            secondary: '#94a3b8', // slate-400
            muted: '#64748b', // slate-500
          },
        },
        // Accents
        accent: {
          primary: '#3b82f6', // blue-500
          secondary: '#8b5cf6', // violet-500
          glow: '#60a5fa', // blue-400
          danger: '#ef4444', // red-500
          success: '#10b981', // emerald-500
        },
      },
      fontFamily: {
        display: ['Beleren', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'app-gradient': 'radial-gradient(circle at center, #1e293b 0%, #0f172a 100%)',
        'glass-gradient':
          'linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.0) 100%)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        glow: 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(59, 130, 246, 0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(59, 130, 246, 0.6)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
