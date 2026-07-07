import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#f4f6fb",
          100: "#e6ebf5",
          200: "#c9d4e8",
          300: "#a3b4d6",
          400: "#7188bc",
          500: "#4d67a0",
          600: "#374f82",
          700: "#2b3f68",
          800: "#1f2e4d",
          900: "#141f36",
          950: "#0b1424",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Pretendard",
          "Noto Sans KR",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
