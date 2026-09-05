module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: 'hsl(var(--primary-navy))',
        indigo: 'hsl(var(--secondary-indigo))',
        lavender: 'hsl(var(--accent-lavender))',
        skysoft: 'hsl(var(--accent-light-blue))',
        surface: 'hsl(var(--card))',
        page: 'hsl(var(--background))',
        ink: 'hsl(var(--foreground))',
        muted: 'hsl(var(--muted-foreground))',
        borderSoft: 'hsl(var(--border))',
        danger: 'hsl(var(--error))',
        success: 'hsl(var(--success))',
      },
      boxShadow: {
        soft: '0 20px 55px rgba(35, 42, 86, 0.16)',
        card: '0 12px 30px rgba(35, 42, 86, 0.12)',
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.35rem',
      },
    },
  },
  plugins: [],
};
