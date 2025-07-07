/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // 使用现有的颜色常量
        primary: '#6B73FF',
        secondary: '#9B59B6',
        background: '#F8F9FA',
        light: '#FFFFFF',
        dark: '#000000',
        gray: {
          DEFAULT: '#6C757D',
          light: '#E9ECEF',
          dark: '#495057',
        },
        success: '#28A745',
        warning: '#FFC107',
        error: '#DC3545',
        // 新增聊天相关颜色
        chat: {
          user: '#6B73FF',
          ai: '#F8F9FA',
          bubble: '#FFFFFF',
        },
      },
      fontSize: {
        // 自定义字体大小
        'xs': '12px',
        'sm': '14px',
        'base': '16px',
        'lg': '18px',
        'xl': '20px',
        '2xl': '24px',
        '3xl': '28px',
        '4xl': '32px',
        // 聊天相关字体大小
        'chat': '16px',
        'chat-sm': '14px',
        'chat-time': '12px',
      },
      borderRadius: {
        // 自定义圆角
        'none': '0',
        'sm': '4px',
        DEFAULT: '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '20px',
        '2xl': '24px',
        'full': '9999px',
        // 聊天气泡特殊圆角
        'bubble': '20px',
        'bubble-sm': '6px',
      },
      spacing: {
        // 自定义间距
        '18': '72px',
        '88': '352px',
        // 聊天相关间距
        'chat-gap': '8px',
        'message-padding': '12px',
      },
      fontFamily: {
        // 字体系列
        'sans': ['System'],
        'mono': ['Monaco', 'Courier New'],
      },
      fontWeight: {
        // 字体权重
        'light': '300',
        'normal': '400',
        'medium': '500',
        'semibold': '600',
        'bold': '700',
        'extrabold': '800',
      },
      lineHeight: {
        // 行高
        'tight': '1.2',
        'normal': '1.5',
        'relaxed': '1.75',
        'loose': '2',
      },
      boxShadow: {
        // 阴影效果
        'sm': '0 1px 2px rgba(0, 0, 0, 0.1)',
        DEFAULT: '0 2px 4px rgba(0, 0, 0, 0.1)',
        'md': '0 4px 8px rgba(0, 0, 0, 0.15)',
        'lg': '0 8px 16px rgba(0, 0, 0, 0.2)',
        'chat': '0 1px 2px rgba(0, 0, 0, 0.1)',
      },
      opacity: {
        // 透明度
        '15': '0.15',
        '35': '0.35',
        '65': '0.65',
        '85': '0.85',
      },
    },
  },
  plugins: [],
};