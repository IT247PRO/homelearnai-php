import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f8fafc',
          100: '#f1f5f9',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        },
        soft: {
          purple: '#7928CA',
          pink: '#FF0080',
          blue: '#2152ff',
          cyan: '#21d4fd',
          dark: '#172b4d',
        },
      },
      boxShadow: {
        'soft-xs': '0 2px 4px 0 rgba(0, 0, 0, 0.03)',
        'soft-sm': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
        'soft-md': '0 4px 20px 0 rgba(0, 0, 0, 0.08)',
        'soft-xl': '0 20px 27px 0 rgba(0, 0, 0, 0.05)',
        'soft-2xl': '0 8px 26px -4px rgba(20, 20, 20, 0.15), 0 8px 9px -5px rgba(20, 20, 20, 0.06)',
        'soft-inner': 'inset 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [typography],
};

