// ThemeProvider removed: theming is now static via styles/globals.css.
// This file remains as a harmless stub to ensure accidental imports fail fast.

export function useTheme() {
  throw new Error('useTheme has been removed. Theme is now static in styles/globals.css');
}

export default function ThemeProvider() {
  throw new Error('ThemeProvider has been removed. Use static CSS variables in styles/globals.css instead.');
}
