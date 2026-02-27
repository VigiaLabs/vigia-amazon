import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-base': '#0E1117',
        'bg-sidebar': '#161B22',
        'bg-panel': '#1F242D',
        'bg-elevated': '#252B35',
        'border-subtle': 'rgba(255,255,255,0.08)',
        'accent-blue': '#2563EB',
        'accent-blue-bright': '#3B82F6',
        'accent-green': '#10B981',
        'accent-red': '#EF4444',
        'accent-yellow': '#F59E0B',
        'text-primary': '#E2E8F0',
        'text-secondary': '#8B95A1',
        'text-muted': '#4B5563',
        'tab-active': '#1F242D',
        'tab-inactive': '#161B22',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
        ui: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': '0.65rem',
        xs: '0.72rem',
      },
      borderRadius: {
        DEFAULT: '3px',
        sm: '2px',
        md: '4px',
        lg: '6px',
      },
    },
  },
  plugins: [],
};

export default config;
