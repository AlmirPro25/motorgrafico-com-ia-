/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html", // Assuming an index.html will be in the root for Vite
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1A237E', // Dark Blue
        secondary: '#64DD17', // Bright Green
        accent: '#FFCA28', // Amber
        neutral: '#F5F5F5', // Light Grey
        'base-100': '#FFFFFF', // White
        info: '#2196F3', // Blue
        success: '#4CAF50', // Green
        warning: '#FF9800', // Orange
        error: '#F44336', // Red
      },
    },
  },
  plugins: [],
}
