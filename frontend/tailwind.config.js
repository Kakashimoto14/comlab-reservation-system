/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f4f7fb",
          100: "#e4ecf8",
          200: "#c7d7ef",
          300: "#9eb7e1",
          400: "#6f90cf",
          500: "#496fb6",
          600: "#355692",
          700: "#2b4474",
          800: "#26395f",
          900: "#24314f"
        },
        accent: "#d97706",
        success: "#0f766e",
        danger: "#b91c1c",
        warning: "#b45309"
      },
      fontFamily: {
        display: ["Poppins", "ui-sans-serif", "system-ui"],
        body: ["Manrope", "ui-sans-serif", "system-ui"]
      },
      boxShadow: {
        soft: "0 18px 45px -24px rgba(27, 52, 86, 0.35)"
      }
    }
  },
  plugins: []
};
