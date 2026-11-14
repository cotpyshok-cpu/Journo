import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: "#F6F4EF",
          muted: "#ECE9E1",
          border: "#DFDBD0",
        },
        forest: {
          DEFAULT: "#2F453B",
          muted: "#3D564B",
          soft: "#5E766B",
        },
        terracotta: {
          DEFAULT: "#C67D63",
          hover: "#B26B52",
          soft: "#F4E8E3",
        },
        status: {
          safe: "#3F7A63",
          warn: "#B6824E",
          danger: "#B05454",
        },
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-plus-jakarta)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        outer: "1rem",
        inner: "0.75rem",
      },
    },
  },
  plugins: [],
};

export default config;
