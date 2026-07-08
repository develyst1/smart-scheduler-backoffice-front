import type { Config } from "tailwindcss";

// Backoffice = dark gray-black theme with a calm GREEN accent (green = money/mgmt
// surface, per workspace CLAUDE.md). The SAME semantic names as the frontoffice
// are kept so copied layout markup works — only the values are remapped to dark.
// Mantine drives component colors separately (see src/lib/ui/colors.ts).
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  // Mantine ships its own normalization; disable Tailwind preflight so it doesn't
  // reset Mantine component styles. A minimal reset lives in globals.css.
  corePlugins: { preflight: false },
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-noto-sans-thai)", "system-ui", "sans-serif"],
      },
      colors: {
        foreground: "#e6e8ec",
        content1: "#1f2023", // surface (sidebar / header / cards) — gray.8
        primary: { DEFAULT: "#37b24d", foreground: "#ffffff" }, // green
        success: "#2f9e44",
        warning: "#e8a23d",
        secondary: "#22b8cf",
        danger: "#e03131",
        // Neutral scale remapped for a dark surface: low = subtle, high = readable.
        default: {
          100: "#2a2c31", // hover fill
          200: "#34363c", // borders
          300: "#42454c",
          400: "#8b9099", // muted text
          500: "#a6abb3",
          600: "#c1c5cc", // primary body text on dark
        },
      },
    },
  },
  darkMode: "class",
  plugins: [],
};

export default config;
