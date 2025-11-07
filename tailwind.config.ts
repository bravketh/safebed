import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f3f7ff",
          100: "#e4edff",
          200: "#cddcff",
          300: "#a4c1ff",
          400: "#6f98ff",
          500: "#3f6fff",
          600: "#1d4fff",
          700: "#143ed6",
          800: "#1237aa",
          900: "#122f86",
        },
      },
    },
  },
  plugins: [],
};

export default config;
