/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    // Include global CSS files so `@apply` utilities are available in styles/*.css
    './styles/**/*.css',
  ],
  theme: {
    extend: {
            boxShadow: {
              'glass-sm': '0 6px 18px rgba(2,6,23,0.06)',
              'glass-md': '0 12px 30px rgba(2,6,23,0.08)',
              'glass-lg': '0 18px 60px rgba(2,6,23,0.12)',
            },
            backgroundImage: {
              'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
            },
      // Expose high-level design tokens mapped to CSS variables so the theme
      // can be changed at runtime by overriding the variables.
      colors: {
        primary: 'var(--color-primary)',
        'primary-foreground': 'var(--color-primary-foreground)',
        surface: 'var(--color-surface)',
        'surface-foreground': 'var(--color-surface-foreground)',
        muted: 'var(--color-muted)',
        accent: 'var(--color-accent)',
        'accent-foreground': 'var(--color-accent-foreground)',
        danger: 'var(--color-danger)',
      },
      fontFamily: {
        // Use a CSS variable so it can be swapped at runtime.
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial'],
      },
      spacing: {
        '72': '18rem',
      },
    },
  },
  plugins: [],
};
