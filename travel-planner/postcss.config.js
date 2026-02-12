// Updated PostCSS config to use the new Tailwind PostCSS plugin
// Tailwind v4 separates the PostCSS plugin into `@tailwindcss/postcss`.
// See: https://tailwindcss.com/docs/installation
module.exports = {
  plugins: {
    // Use the official Tailwind PostCSS adapter package
    // This avoids the runtime error about using `tailwindcss` directly as a PostCSS plugin.
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
};

// Use the object form with plugin names so Next.js/PostCSS can resolve them correctly.
// Do NOT require the plugin function here — Next.js expects string keys that it resolves.
module.exports = {
  plugins: {
    // Use classic `tailwindcss` plugin shape for Tailwind v3 compatibility.
    // If you upgrade to Tailwind v4, switch to the `@tailwindcss/postcss` adapter.
    tailwindcss: {},
    autoprefixer: {},
  },
};