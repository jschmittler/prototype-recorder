import type { Config } from "tailwindcss";

/**
 * Frodotyping design tokens.
 *
 * The foundation is a deep blue-black rather than pure black, so surfaces can be
 * separated by small lightness steps instead of borders alone. `signal` is the
 * single luminous accent used for primary actions and focus. `gold` is reserved
 * for one meaning — a walkthrough that is finished and ready to show someone —
 * and must not be used for ordinary buttons, links, or selected states.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Application foundation: deep blue-black through graphite.
        ink: {
          950: "#08090d", // page background
          900: "#0c0e14", // raised surface
          850: "#11141c", // panel
          800: "#171b25", // panel, hovered
          700: "#212736", // hairline borders, strong
          600: "#2c3446", // borders on interactive surfaces
          500: "#5a6478", // disabled text, faint icons
          400: "#7d8698", // tertiary text
          300: "#9aa3b4", // secondary text
          200: "#c3cad6", // body text
          100: "#e4e8ef", // emphasis text
          50: "#f5f7fa", // headings
        },
        // Primary luminous accent.
        signal: {
          50: "#eef4ff",
          100: "#d9e6ff",
          200: "#b4ceff",
          300: "#82adff",
          400: "#4f88ff",
          500: "#2e6bff",
          600: "#1a51ec",
          700: "#153fbc",
          800: "#153593",
          900: "#152d7f",
        },
        // Earned. Completion and readiness only.
        gold: {
          200: "#f5e2b0",
          300: "#eccd80",
          400: "#dfb254",
          500: "#c9963a",
          600: "#a5762a",
        },
        // Restrained warmth for wayfinding accents.
        moss: {
          300: "#8fbf9f",
          400: "#5f9e75",
          500: "#417a56",
        },
        success: { 400: "#4ade80", 500: "#22c55e", 600: "#16a34a" },
        warn: { 400: "#fbbf24", 500: "#f59e0b", 600: "#d97706" },
        danger: { 400: "#f87171", 500: "#ef4444", 600: "#dc2626" },

        // Legacy aliases so existing markup keeps compiling during migration.
        brand: {
          50: "#eef4ff",
          100: "#d9e6ff",
          200: "#b4ceff",
          300: "#82adff",
          400: "#4f88ff",
          500: "#2e6bff",
          600: "#1a51ec",
          700: "#153fbc",
          800: "#153593",
          900: "#152d7f",
        },
        studio: {
          50: "#f5f7fa",
          100: "#e4e8ef",
          200: "#c3cad6",
          300: "#9aa3b4",
          400: "#7d8698",
          500: "#5a6478",
          600: "#2c3446",
          700: "#212736",
          800: "#171b25",
          900: "#0c0e14",
          950: "#08090d",
        },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "SF Mono",
          "Menlo",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
      },
      letterSpacing: {
        label: "0.08em",
      },
      transitionDuration: {
        fast: "120ms",
        base: "200ms",
        panel: "320ms",
        page: "420ms",
      },
      transitionTimingFunction: {
        // Decelerating: things arrive and settle, never bounce.
        settle: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0,0,0,0.28), 0 8px 24px rgba(0,0,0,0.24)",
        panel: "0 24px 64px -16px rgba(0,0,0,0.65)",
      },
      keyframes: {
        "fade-rise": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "route-draw": {
          from: { strokeDashoffset: "220" },
          to: { strokeDashoffset: "0" },
        },
        "waypoint-light": {
          from: { opacity: "0", transform: "scale(0.7)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-rise": "fade-rise 320ms cubic-bezier(0.16,1,0.3,1) both",
        "fade-in": "fade-in 200ms linear both",
        "route-draw": "route-draw 1400ms cubic-bezier(0.16,1,0.3,1) both",
        "waypoint-light": "waypoint-light 520ms cubic-bezier(0.16,1,0.3,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
