/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // 品牌色 - 自定义颜色
        primary: '#6B73FF',
        secondary: '#9B59B6',
        background: '#F8F9FA',
        // 聊天相关颜色
        chat: {
          user: '#6B73FF',
          ai: '#F8F9FA',
          bubble: '#FFFFFF',
        },
      },
      spacing: {
        // 项目特定间距，基于sizes.ts的值
        '18': '4.5rem',  // 72px (18 * 4px)
        '14': '3.5rem',  // 56px (14 * 4px) - headerHeight
        '12': '3rem',    // 48px (12 * 4px) - buttonHeight
        '6': '1.5rem',   // 24px (6 * 4px) - iconSize
      },
      borderRadius: {
        // 默认圆角，基于sizes.ts的borderRadius值
        DEFAULT: '8px',
        // 聊天气泡圆角
        'bubble': '20px',
        'bubble-sm': '6px',
      },
      fontSize: {
        // 聊天相关字体大小
        'chat': '16px',
        'chat-sm': '14px',
        'chat-time': '12px',
      },
      boxShadow: {
        // 聊天气泡阴影
        'chat': '0 1px 2px rgba(0, 0, 0, 0.1)',
      },
    },
  },
  plugins: [],
};