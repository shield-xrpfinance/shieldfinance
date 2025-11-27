import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'cyber-bg': '#0a0f1a',
        'cyber-card': '#0f172a',
        'cyber-card-hover': '#1e293b',
        'cyber-cyan': '#00E0FF',
        'cyber-cyan-light': '#22d3ee',
        'cyber-border': '#1e3a5f',
        'cyber-text': '#e2e8f0',
        'cyber-muted': '#94a3b8',
        'cyber-success': '#10b981',
        'cyber-error': '#ef4444',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(0, 224, 255, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(0, 224, 255, 0.6)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
