/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        console: {
          DEFAULT: '#15130f',
          raised: '#1f1c17',
          panel: '#262219',
          line: '#3a352b',
        },
        cream: '#f2ead9',
        muted: '#9c9388',
        amber: {
          DEFAULT: '#e0a458',
          dim: '#a87a44',
        },
        rec: '#d6453d',
      },
      fontFamily: {
        display: ['"Big Shoulders Display"', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      boxShadow: {
        inset: 'inset 0 1px 0 0 rgba(255,255,255,0.04), inset 0 -1px 0 0 rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
};
