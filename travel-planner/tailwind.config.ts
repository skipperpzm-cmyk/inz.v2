import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './styles/**/*.{css}',
  ],
  theme: {
    extend: {
      colors: {
        midnight: '#0B1120',
        graphite: '#1F1F1F',
        mist: 'rgba(255,255,255,0.08)',
      },
      fontFamily: {
        sans: ['Inter', 'var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'reflect-radial': 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.08), transparent 55%)',
        'reflect-linear': 'linear-gradient(130deg, rgba(15,23,42,0.9), rgba(15,15,15,0.92))',
      },
      boxShadow: {
        glass: '0 25px 60px rgba(15,23,42,0.35)',
      },
      borderRadius: {
        '4xl': '2.25rem',
      },
      blur: {
        xs: '2px',
      },
    },
  },
  plugins: [animate],
};

export default config;