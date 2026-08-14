import type { Config } from 'tailwindcss'

const config: Config = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0d6efd',
          dark: '#0b5ed7',
        },
        secondary: {
          DEFAULT: '#6c757d',
          dark: '#5c636a',
        },
        dark: '#212529',
        background: '#f4f7f6',
        text: '#212529',
        'text-muted': '#6c757d',
      },
      fontFamily: {
        verdana: ['Verdana', 'Geneva', 'Tahoma', 'sans-serif'],
        sans: ['Verdana', 'Geneva', 'Tahoma', 'sans-serif'],
      },
      spacing: {
        xs: '0.125rem',
        sm: '0.25rem',
        md: '0.3125rem',
        lg: '0.5rem',
        xl: '0.625rem',
        '2xl': '0.75rem',
        '3xl': '1rem',
        '4xl': '1.1875rem',
        '5xl': '1.25rem',
        '6xl': '1.5625rem',
        '7xl': '1.875rem',
        '8xl': '2.1875rem',
        '9xl': '2.375rem',
        '10xl': '2.5rem',
      },
      borderRadius: {
        sm: '8px',
        md: '25px',
        lg: '50px',
        full: '9999px',
      },
      screens: {
        'w-400': '400px',
        'w-576': '576px',
        'w-600': '600px',
        'w-640': '640px',
        'w-700': '700px',
        'w-768': '768px',
        'w-799': '799px',
        'w-992': '992px',
        'w-1023': '1023px',
        'w-1024': '1024px',
        'w-1280': '1280px',
        'w-1536': '1536px',
      },
    },
  },
  plugins: [],
}

export default config