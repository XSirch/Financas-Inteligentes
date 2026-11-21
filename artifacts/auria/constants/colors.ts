/**
 * Palette — "Escuro e tecnológico" (chosen by the user).
 * Blue-black surfaces, a single deliberate lime signal, and distinct
 * semantic hues for income / expense / warning / error.
 * The app enforces this dark palette regardless of device theme;
 * `light` and `dark` keys point at the same tokens for compatibility.
 */
const dark = {
  text: '#E6ECF2',
  tint: '#A7EF64',

  background: '#10151D',
  foreground: '#E6ECF2',

  card: '#1D2938',
  cardForeground: '#E6ECF2',

  primary: '#A7EF64',
  primaryForeground: '#10151D',

  secondary: '#263547',
  secondaryForeground: '#E6ECF2',

  muted: '#16202B',
  mutedForeground: '#93A3B6',

  accent: '#24331C',
  accentForeground: '#C3F598',

  destructive: '#FF6E6E',
  destructiveForeground: '#10151D',

  border: '#2A394B',
  input: '#34475D',

  // Domain tokens
  income: '#5CD6B0',
  incomeSoft: '#14332F',
  expense: '#FF9373',
  expenseSoft: '#3A2228',
  warning: '#F2C55C',
  warningSoft: '#3A311C',
  aura: '#A7EF64',
  auraSoft: '#22311D',
  lagoonSoft: '#1A2A3A',
  hero: '#161F2B',
  heroForeground: '#F1F5F9',
  heroMuted: '#8FA1B6',
  overlay: 'rgba(167,239,100,0.06)',
};

const colors = {
  light: dark,
  dark,
  radius: 16,
};

export default colors;
