import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        gold: 'hsl(var(--gold))',
        beige: 'hsl(var(--beige))',
        'deep-black': 'hsl(var(--deep-black))',
        cream: 'hsl(var(--cream))',
        // Backwards compat aliases
        surface: {
          DEFAULT: 'hsl(var(--background))',
          raised: 'hsl(var(--card))',
          overlay: 'hsl(var(--popover))',
        },
        glass: {
          50: 'hsl(var(--muted) / 0.3)',
          100: 'hsl(var(--muted) / 0.5)',
          200: 'hsl(var(--muted) / 0.7)',
          border: 'hsl(var(--border))',
          'border-light': 'hsl(var(--border) / 0.8)',
        },
        'accent-gold': {
          DEFAULT: 'hsl(var(--primary))',
          light: 'hsl(var(--secondary))',
          dark: 'hsl(var(--primary))',
          muted: 'hsl(var(--primary) / 0.15)',
        },
        'accent-purple': {
          DEFAULT: 'hsl(var(--primary))',
          light: 'hsl(var(--secondary))',
          dark: 'hsl(var(--primary))',
          muted: 'hsl(var(--primary) / 0.15)',
        },
        status: {
          success: '#34D399',
          'success-muted': 'rgba(52, 211, 153, 0.15)',
          warning: '#FBBF24',
          'warning-muted': 'rgba(251, 191, 36, 0.15)',
          danger: '#F87171',
          'danger-muted': 'rgba(248, 113, 113, 0.15)',
          info: '#60A5FA',
          'info-muted': 'rgba(96, 165, 250, 0.15)',
          orange: '#FB923C',
          'orange-muted': 'rgba(251, 146, 60, 0.15)',
          brown: '#A3886A',
          'brown-muted': 'rgba(163, 136, 106, 0.15)',
        },
      },
      fontFamily: {
        sans: ['var(--font-outfit)', 'Outfit', 'system-ui', 'sans-serif'],
        display: ['var(--font-cormorant)', 'Cormorant Garamond', 'Georgia', 'serif'],
      },
      screens: {
        xs: '375px',
        sm: '640px',
        md: '768px',
        lg: '1024px',
      },
      spacing: {
        'safe-bottom': 'env(safe-area-inset-bottom, 0px)',
        'safe-top': 'env(safe-area-inset-top, 0px)',
        'nav-height': '4.5rem',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'elegant': 'var(--shadow-elegant)',
        'card-shadow': 'var(--shadow-card)',
        'gold': 'var(--shadow-gold)',
        'glass': '0 8px 32px hsl(var(--deep-black) / 0.15)',
        'glass-hover': '0 12px 40px hsl(var(--deep-black) / 0.2)',
        'glass-inset': 'inset 0 1px 0 0 hsl(var(--beige) / 0.1)',
        'glow-gold': '0 0 20px hsl(var(--gold) / 0.2)',
        'bottom-nav': '0 -4px 20px hsl(var(--deep-black) / 0.15)',
        'fab': '0 4px 20px hsl(var(--gold) / 0.3)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-gold': 'var(--gradient-gold)',
        'gradient-dark': 'var(--gradient-dark)',
        'gradient-hero': 'var(--gradient-hero)',
      },
      animation: {
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in': 'fadeIn 0.2s ease-out',
        'fade-up': 'fadeUp 0.8s ease-out forwards',
        'scale-in': 'scaleIn 0.5s ease-out forwards',
        'toast-in': 'toastIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'toast-out': 'toastOut 0.3s ease-in forwards',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        toastIn: {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        toastOut: {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(-100%)', opacity: '0' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
