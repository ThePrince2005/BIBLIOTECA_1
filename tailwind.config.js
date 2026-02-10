/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/views/**/*.ejs',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'primary-blue': '#0077B6',
        'light-blue': '#00B4D8',
        'accent-cyan': '#48CAE4',
        'light-gray': '#F1F5F9',
        'dark-gray-text': '#1E293B',
      },
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
      },
      boxShadow: {
        'ambient-blue': '0 8px 24px rgba(0, 119, 182, 0.25)',
      },
      transitionTimingFunction: {
        'out-quart': 'cubic-bezier(0.165, 0.84, 0.44, 1)',
      }
    },
  },
  plugins: [],
}
