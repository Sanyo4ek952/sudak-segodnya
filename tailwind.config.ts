import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        surface: "hsl(var(--surface))",
        "surface-muted": "hsl(var(--surface-muted))",
        foreground: "hsl(var(--foreground))",
        "foreground-muted": "hsl(var(--foreground-muted))",
        border: "hsl(var(--border))",
        primary: "hsl(var(--primary))",
        "primary-600": "hsl(var(--primary-600))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        secondary: "hsl(var(--secondary))",
        accent: "hsl(var(--accent))",
        "accent-light": "hsl(var(--accent-light))",
        sand: "hsl(var(--sand))",
        coral: "hsl(var(--coral))",
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        error: "hsl(var(--error))",
        info: "hsl(var(--info))"
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)"
      },
      boxShadow: {
        card: "var(--shadow-card)",
        popover: "var(--shadow-popover)"
      },
      maxWidth: {
        content: "var(--container-public)",
        form: "var(--container-form)",
        dashboard: "var(--container-dashboard)"
      }
    }
  },
  plugins: []
};

export default config;
