// Use `.glass` and `.glass-dark` which rely on CSS variables for background and border.
const basePanel = 'glass backdrop-blur-md shadow-glass-md bg-glass-gradient';
const darkPanel = 'glass-dark backdrop-blur-lg shadow-glass-lg bg-glass-gradient';

export const ThemeGlass = {
  // Panel presets
  panel: basePanel,
  panelDark: darkPanel,
  // Card presets
  card: `${basePanel} rounded-lg p-4`,
  cardHero: `${darkPanel} rounded-xl p-6`,
  // Sidebar / navbar presets
  nav: `${basePanel} px-4 py-3`,
  sidebar: `${basePanel} p-4`,
  // Button presets
  button: `px-4 py-2 rounded-md text-white bg-primary shadow-glass-sm glow focus:outline-none focus:ring-4 focus:ring-primary/25`,
  buttonGhost: `px-4 py-2 rounded-md bg-transparent border text-primary hover:bg-primary/5 transition`,
  // Stat widget
  stat: `${basePanel} rounded-md p-4`,
  // header
  header: `${basePanel} px-4 py-3`,
};

export type ThemeGlassType = typeof ThemeGlass;

export default ThemeGlass;
