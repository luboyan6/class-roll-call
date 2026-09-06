/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        /* 出勤状态色 - flat, 语义化, 亮暗一致 */
        present: 'hsl(var(--status-present))',
        late: 'hsl(var(--status-late))',
        leave: 'hsl(var(--status-leave))',
        absent: 'hsl(var(--status-absent))',
        unmarked: 'hsl(var(--status-unmarked))',
        /* 舞台专用：沉浸式深空底 + 高饱和强调色，不随主题切换 */
        stage: {
          bg: '#04070F',
          deep: '#070C1A',
          panel: 'rgba(148, 178, 255, 0.06)',
          line: 'rgba(148, 178, 255, 0.16)',
          gold: '#F7CE68',
          amber: '#FFB020',
          neon: '#4FD8FF',
          violet: '#A78BFA',
          text: '#E8EEFF',
          dim: 'rgba(232, 238, 255, 0.58)',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          '"Source Han Sans SC"',
          '"Noto Sans CJK SC"',
          'sans-serif',
        ],
        /* 点名大字：中文优先，保证姓名渲染美观 */
        display: [
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          '"Source Han Sans SC"',
          '"Noto Sans CJK SC"',
          'system-ui',
          'sans-serif',
        ],
        mono: ['"Fira Code"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        /* 舞台标题的呼吸辉光 */
        'glow-breathe': {
          '0%, 100%': { opacity: '0.55', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.04)' },
        },
        /* 结果卡片入场：从模糊到清晰，模拟聚焦 */
        'focus-in': {
          from: { opacity: '0', filter: 'blur(12px)', transform: 'scale(0.9)' },
          to: { opacity: '1', filter: 'blur(0px)', transform: 'scale(1)' },
        },
        /* CTA 光晕扩散 */
        'halo': {
          '0%': { opacity: '0.5', transform: 'scale(0.96)' },
          '100%': { opacity: '0', transform: 'scale(1.35)' },
        },
        /* 标题入场：字距拉开 + 由远及近，沿用 log-lottery 的 tracking-in-expand-fwd */
        'tracking-in': {
          '0%': { letterSpacing: '-0.5em', transform: 'translateZ(-700px)', opacity: '0' },
          '40%': { opacity: '0.6' },
          '100%': { letterSpacing: 'normal', transform: 'translateZ(0)', opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        'slide-up': 'slide-up 200ms ease-out',
        'glow-breathe': 'glow-breathe 3.6s ease-in-out infinite',
        'focus-in': 'focus-in 420ms cubic-bezier(0.22, 1, 0.36, 1)',
        halo: 'halo 1.8s ease-out infinite',
        'tracking-in': 'tracking-in 900ms cubic-bezier(0.215, 0.61, 0.355, 1) both',
      },
      borderRadius: {
        lg: '0.75rem',
        md: '0.5rem',
        sm: '0.375rem',
      },
    },
  },
  plugins: [],
}
