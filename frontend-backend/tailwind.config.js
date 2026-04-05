/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        panel: '#111827',
        line: 'rgba(148, 163, 184, 0.18)',
        theme: {
          base: 'rgb(var(--c-base) / <alpha-value>)',
          surface: 'rgb(var(--c-surface) / <alpha-value>)',
          glass: 'rgb(var(--c-surface-glass) / <alpha-value>)',
          card: 'rgb(var(--c-card) / <alpha-value>)',
          text: 'rgb(var(--c-text) / <alpha-value>)',
          muted: 'rgb(var(--c-muted) / <alpha-value>)',
          subtle: 'rgb(var(--c-subtle) / <alpha-value>)',
          border: 'rgb(var(--c-border) / <alpha-value>)',
          chart: {
            blue: 'rgb(var(--chart-blue-text) / <alpha-value>)',
            pink: 'rgb(var(--chart-pink-text) / <alpha-value>)',
            yellow: 'rgb(var(--chart-yellow-text) / <alpha-value>)',
            emerald: 'rgb(var(--chart-emerald-text) / <alpha-value>)',
          },
          accent: {
            purple: 'rgb(var(--accent-purple) / <alpha-value>)',
            'purple-text': 'rgb(var(--accent-purple-text) / <alpha-value>)',
            blue: 'rgb(var(--accent-blue) / <alpha-value>)',
            'blue-text': 'rgb(var(--accent-blue-text) / <alpha-value>)',
            emerald: 'rgb(var(--accent-emerald) / <alpha-value>)',
            'emerald-text': 'rgb(var(--accent-emerald-text) / <alpha-value>)',
            cyan: 'rgb(var(--accent-cyan) / <alpha-value>)',
            'cyan-text': 'rgb(var(--accent-cyan-text) / <alpha-value>)',
          }
        }
      },
      boxShadow: {
        glow: 'var(--shadow-glow)',
      },
      animation: {
        float: 'float 7s ease-in-out infinite',
        pulseSoft: 'pulseSoft 3.4s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
      },
      backgroundImage: {
        grid: 'linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)',
      },
      fontFamily: {
        sans: ['"Segoe UI"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
