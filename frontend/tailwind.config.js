/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 莫奈睡莲色系
        monet: {
          cream: '#f0eec8',
          sage: '#80d2af',
          haze: '#7b9e9e',
          dust: '#e8e4d8',
          lotus: '#dd89c4',
          leaf: '#103811',
          cobalt: '#4e73d6',
        },
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#b9dffe',
          300: '#7cc5fd',
          400: '#36a9fa',
          500: '#0c8eeb',
          600: '#0070c9',
          700: '#0159a3',
          800: '#064b86',
          900: '#0b3f6f',
        },
      },
      fontFamily: {
        sans: ['"Noto Serif SC"', '"Noto Sans SC"', 'system-ui', 'serif'],
        serif: ['"Noto Serif SC"', 'Georgia', 'serif'],
      },
      backgroundImage: {
        'canvas': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")",
      },
      boxShadow: {
        'monet': '0 4px 20px -4px rgba(123, 158, 158, 0.25)',
        'monet-lg': '0 8px 30px -6px rgba(123, 158, 158, 0.3)',
      },
    },
  },
  plugins: [],
}
