/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // WHO growth-chart status colors, reused across risk badges/charts
        risk: {
          normal: '#16a34a',
          watch: '#f59e0b',
          risk: '#dc2626'
        },
        // "Accessible & Ethical" design system (healthcare/government/public
        // sector): calm cyan + health green, WCAG AAA contrast. Matches
        // Tailwind's own cyan-600/emerald-600 exactly, defined as semantic
        // tokens so components say `primary`/`accent`, not a raw hue.
        primary: {
          DEFAULT: '#0891b2',
          hover: '#0e7490',
          light: '#ecfeff',
          foreground: '#ffffff'
        },
        accent: {
          DEFAULT: '#059669',
          hover: '#047857',
          foreground: '#ffffff'
        }
      },
      fontFamily: {
        sans: [
          'Figtree',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif'
        ]
      }
    }
  },
  plugins: []
};
