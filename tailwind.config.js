/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      // Brand ramp: a desaturated "engineering ink" blue replacing Tailwind's
      // default blue scale, so every existing blue-* class picks it up.
      colors: {
        blue: {
          50: "#F2F6FA", 100: "#E3EBF3", 200: "#C3D6E6", 300: "#96B7D1",
          400: "#6A94B7", 500: "#41729B", 600: "#2E5E86", 700: "#22496B",
          800: "#183853", 900: "#102A40", 950: "#0A1C2C",
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};
