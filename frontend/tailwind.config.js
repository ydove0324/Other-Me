/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 「印象·日出」色系：更接近油画本身
        monet: {
          // 清晨雾气里的浅蓝灰
          cream: '#C9D3E0',
          // 太阳与倒影的橙光
          sage: '#FF8A3D',
          // 远景与天空的蓝紫
          haze: '#6F8FB2',
          // 水面上略暖的灰蓝
          dust: '#A9C7CF',
          // 靠近岸边的深蓝绿
          lotus: '#245B73',
          // 最暗的剪影海军蓝
          leaf: '#102335',
          // 更亮一点的天光蓝
          cobalt: '#3E7BBF',
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
