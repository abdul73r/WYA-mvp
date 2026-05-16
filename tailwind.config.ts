import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0B0D12',
        surface: '#14171F',
        'surface-2': '#1A1E28',
        stroke: 'rgba(255,255,255,0.07)',
        'stroke-2': 'rgba(255,255,255,0.12)',
        text: { DEFAULT: '#FFFFFF', muted: '#9AA0AE', faint: '#5F6473' },
        accent: { DEFAULT: '#FF3B7F', pressed: '#E6326F' },
        success: '#3DDC97',
        warning: '#FFB020',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      borderRadius: { md: '12px', lg: '16px', xl: '20px' },
    },
  },
  plugins: [],
};
export default config;
