/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
        },
        navy: {
          800: '#12306B',
          900: '#0B1F4B',
        },
        surface: '#F4F7FB',
        ink: '#0F172A',
        muted: '#64748B',
        line: '#E2E8F0',
        status: {
          success: { bg: '#DCFCE7', text: '#15803D' },
          warning: { bg: '#FEF3C7', text: '#B45309' },
          danger: { bg: '#FEE2E2', text: '#B91C1C' },
          info: { bg: '#DBEAFE', text: '#1D4ED8' },
          neutral: { bg: '#F1F5F9', text: '#475569' },
          purple: { bg: '#EDE9FE', text: '#6D28D9' },
        }
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
      boxShadow: {
        'soft': '0 10px 30px -12px rgba(37, 99, 235, 0.18)',
        'soft-sm': '0 4px 14px -6px rgba(15, 23, 42, 0.10)',
      }
    },
  },
  plugins: [],
};
