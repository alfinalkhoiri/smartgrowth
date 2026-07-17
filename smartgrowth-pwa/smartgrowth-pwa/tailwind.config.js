/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // WHO growth-chart status colors, reused across risk badges/charts.
        // 4 tingkat (normal/berisiko/stunting/malnutrisi) — lihat RiskBadge.tsx.
        risk: {
          normal: '#16a34a',
          berisiko: '#f59e0b',
          stunting: '#ea580c',
          malnutrisi: '#dc2626'
        },
        // Hijau (kesehatan/pertumbuhan) + biru (medis/teknologi) — dikonversi
        // dari token HSL hijau `152 62% 38%` / biru `198 85% 45%`, sama
        // dengan skema yang dipakai versi awal aplikasi ini. Tetap didefinisikan
        // sebagai token semantik (`primary`/`accent`) supaya komponen tidak
        // perlu tahu nilai hue mentahnya.
        primary: {
          DEFAULT: '#259d65',
          hover: '#1d7c50',
          light: '#ebfaf3',
          foreground: '#ffffff'
        },
        accent: {
          DEFAULT: '#119ad4',
          hover: '#0e7baa',
          foreground: '#ffffff'
        }
      },
      fontFamily: {
        sans: [
          'Plus Jakarta Sans',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif'
        ],
        display: [
          'Poppins',
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
