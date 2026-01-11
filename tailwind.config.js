/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/renderer/index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#121212',
        surface: '#1E1E1E',
        primary: '#FF0055',
        textMain: '#FFFFFF',
        textSec: '#B0B0B0'
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'] // Додає приємніший шрифт, якщо він є
      }
    },
  },
  plugins: [
    require('tailwindcss-animate')
  ],
}