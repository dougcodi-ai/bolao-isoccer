/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
    "./src/app/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        'inter': ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        'poppins': ['var(--font-poppins)', 'Poppins', 'system-ui', 'sans-serif'],
        'sans': ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'], // Inter como padrão
      },
      colors: {
        primary: {
          DEFAULT: '#0ea5e9', // sky-500
          dark: '#0284c7',
          light: '#38bdf8'
        },
        accent: '#22c55e', // green-500
        warning: '#f59e0b',
        danger: '#ef4444'
      }
    }
  },
  plugins: []
}