import defaultTheme from 'tailwindcss/defaultTheme';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './vendor/laravel/framework/src/Illuminate/Pagination/resources/views/*.blade.php',
        './storage/framework/views/*.php',
        './resources/**/*.blade.php',
        './resources/**/*.js',
        './resources/**/*.jsx',
        './resources/**/*.vue',
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'Sora', ...defaultTheme.fontFamily.sans],
                display: ['Sora', ...defaultTheme.fontFamily.sans],
                mono: ['IBM Plex Mono', 'monospace'],
            },
            colors: {
                lavender: {
                    light: '#e0dffd',
                    DEFAULT: '#a8a5f7',
                    dark: '#8a87d6',
                },
                charcoal: '#1a1a1a',
                snow: '#f4f5f9',
                surface: '#ffffff',
                slate: {
                    50: '#f8fafc',
                    100: '#f1f5f9',
                    200: '#e2e8f0',
                    300: '#cbd5e1',
                    400: '#94a3b8',
                    500: '#64748b',
                    600: '#475569',
                    700: '#334155',
                    800: '#1e293b',
                    900: '#0f172a',
                },
            },
            spacing: {
                '18': '72px',
                '22': '88px',
            },
            borderRadius: {
                '2xl': '24px',
                '3xl': '32px',
            },
            boxShadow: {
                'premium': '0 10px 40px rgba(0, 0, 0, 0.04)',
                'expert': '0 20px 60px rgba(0, 0, 0, 0.08)',
                'soft': '0 4px 12px rgba(0, 0, 0, 0.03)',
            }
        },
    },
    plugins: [],
};
