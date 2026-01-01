/**
 * Time Formatting Utilities
 *
 * Provides time formatting functions for chat messages:
 * - Relative time (刚才, 5分钟前, 3天前)
 * - Absolute time (今天 14:23, 昨天 09:15, 1月28日 18:30)
 * - Date separators (今天, 昨天, 1月28日 星期二)
 */

/**
 * Get relative time string (for AI context)
 * Examples: "刚才", "5分钟前", "3小时前", "3天前"
 */
export function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return '刚才';
  } else if (minutes < 60) {
    return `${minutes}分钟前`;
  } else if (hours < 24) {
    return `${hours}小时前`;
  } else if (days < 7) {
    return `${days}天前`;
  } else {
    // For messages older than 7 days, show absolute date
    const date = new Date(timestamp);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}月${day}日`;
  }
}

/**
 * Format absolute time for chat bubbles
 * - Today: "14:23"
 * - Yesterday: "昨天 09:15"
 * - This year: "1月28日 18:30"
 * - Previous years: "2025年1月28日 18:30"
 */
export function formatAbsoluteTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();

  // Time string (HH:MM)
  const timeStr = date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  // Check if today
  if (isSameDay(timestamp, now.getTime())) {
    return timeStr;
  }

  // Check if yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(timestamp, yesterday.getTime())) {
    return `昨天 ${timeStr}`;
  }

  // Check if this year
  if (date.getFullYear() === now.getFullYear()) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}月${day}日 ${timeStr}`;
  }

  // Different year
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}年${month}月${day}日 ${timeStr}`;
}

/**
 * Format date separator for chat list (like WeChat)
 * - Today: "今天"
 * - Yesterday: "昨天"
 * - This week: "星期二 1月28日"
 * - This year: "1月28日 星期二"
 * - Previous years: "2025年1月28日 星期二"
 */
export function formatDateSeparator(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();

  // Check if today
  if (isSameDay(timestamp, now.getTime())) {
    return '今天';
  }

  // Check if yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(timestamp, yesterday.getTime())) {
    return '昨天';
  }

  // Day of week (weekday name)
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const weekday = weekdays[date.getDay()];

  // Check if this week
  const daysDiff = Math.floor((now.getTime() - timestamp) / (1000 * 60 * 60 * 24));
  if (daysDiff < 7 && date.getDay() < now.getDay()) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${weekday} ${month}月${day}日`;
  }

  // Check if this year
  if (date.getFullYear() === now.getFullYear()) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}月${day}日 ${weekday}`;
  }

  // Different year
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}年${month}月${day}日 ${weekday}`;
}

/**
 * Check if two timestamps are on the same day
 */
export function isSameDay(timestamp1: number, timestamp2: number): boolean {
  const date1 = new Date(timestamp1);
  const date2 = new Date(timestamp2);

  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Get current datetime string for AI system prompt
 * Example: "2026年1月1日 星期三 14:23"
 */
export function getCurrentDateTime(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const weekday = weekdays[now.getDay()];
  const time = now.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return `${year}年${month}月${day}日 ${weekday} ${time}`;
}
