/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./*.html', './js/**/*.js'],
  corePlugins: {
    /* Off: the site already has its own hand-tuned reset/fonts in css/style.css --
       Tailwind's preflight would fight with it. Utility classes still work fine. */
    preflight: false,
  },
  theme: {
    extend: {},
  },
  plugins: [],
}
