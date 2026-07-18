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
      backgroundImage: {
        // 3-stop hero gradient (hijau -> teal -> biru) — dipakai di banner
        // Beranda. Nilai hex diambil dari computed style asli (hsl(152 70%
        // 45%)/hsl(180 65% 45%)/hsl(198 85% 50%)).
        'gradient-hero': 'linear-gradient(135deg, #22c378 0%, #28bdbd 50%, #13abec 100%)',
        // 2-stop primary->accent gradient — dipakai untuk badge logo (bukan
        // banner). Nilai persis dari computed style badge logo Lovable asli
        // (bg-gradient-primary): linear-gradient(135deg, rgb(37,157,101), rgb(17,154,212)).
        'gradient-primary': 'linear-gradient(135deg, #259d65, #119ad4)'
      },
      boxShadow: {
        // Nilai persis diambil dari computed style, bukan tebakan.
        soft: '0 2px 12px -2px rgba(37, 92, 61, 0.08)',
        card: '0 4px 20px -4px rgba(31, 58, 71, 0.08)',
        elegant: '0 12px 40px -8px rgba(31, 92, 61, 0.18)'
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
