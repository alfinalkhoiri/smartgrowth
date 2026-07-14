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
        }
      }
    }
  },
  plugins: []
};
