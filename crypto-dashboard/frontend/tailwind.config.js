/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        dark: {
          bg: '#0f0f1a',
          card: '#1a1a2e',
          hover: '#16213e',
          border: '#2a2a4a',
        },
      },
    },
  },
  plugins: [],
};
