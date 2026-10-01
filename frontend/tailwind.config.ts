import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17211f",
        muted: "#69736f",
        canvas: "#f6f7f3",
        brand: { DEFAULT: "#176b5b", dark: "#105446", soft: "#e4f2ed" },
        accent: "#e6f0bb",
      },
      boxShadow: { card: "0 12px 34px rgba(20, 40, 34, .07)" },
    },
  },
  plugins: [],
};

export default config;
