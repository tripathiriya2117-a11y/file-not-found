/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          950: '#fbf8f8',
          900: '#ffffff',
          850: '#fff7f8',
          800: '#f9edef',
          700: '#eadde1',
          600: '#d7c3ca',
        },
        brand: {
          50: '#fff1f4',
          100: '#ffe0e7',
          200: '#f9c2cf',
          300: '#e9819a',
          400: '#c64f6d',
          500: '#b7375a',
          600: '#9f294b',
          700: '#84213d',
          900: '#5a1b2d',
        },
        slate: {
          100: '#2f2529',
          200: '#43363b',
          300: '#5f5056',
          400: '#76666d',
          500: '#8d7a82',
          600: '#a8949b',
          700: '#c3b1b7',
          800: '#ded1d5',
          900: '#eee6e8',
          950: '#faf7f7',
        },
        accent: {
          teal: '#b86b7e',
          cyan: '#d46b83',
          emerald: '#23845b',
          amber: '#f59e0b',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
