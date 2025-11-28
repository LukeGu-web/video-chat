/**
 * Date Utilities
 * Helper functions for date formatting and relative time calculation
 */

/**
 * Format timestamp to relative time (e.g., "3分钟前", "昨天下午", "上周二")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const date = new Date(timestamp);

  // 1分钟内
  if (diff < 60 * 1000) {
    return '刚刚';
  }

  // 1小时内
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000));
    return `${minutes}分钟前`;
  }

  // 今天
  const today = new Date();
  if (isSameDay(date, today)) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const period = hours < 12 ? '上午' : hours < 18 ? '下午' : '晚上';
    return `今天${period}${hours % 12 || 12}:${minutes.toString().padStart(2, '0')}`;
  }

  // 昨天
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(date, yesterday)) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const period = hours < 12 ? '上午' : hours < 18 ? '下午' : '晚上';
    return `昨天${period}${hours % 12 || 12}:${minutes.toString().padStart(2, '0')}`;
  }

  // 本周内
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  if (date >= weekStart) {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return weekdays[date.getDay()];
  }

  // 上周
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  if (date >= lastWeekStart) {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `上${weekdays[date.getDay()]}`;
  }

  // 本月内
  if (date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear()) {
    return `${date.getDate()}号`;
  }

  // 本年内
  if (date.getFullYear() === today.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}号`;
  }

  // 更早
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}号`;
}

/**
 * Check if two dates are on the same day
 */
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Get date range for relative time expressions
 */
export function getDateRange(expression: string): { start: Date; end: Date } | null {
  const now = new Date();

  switch (expression.toLowerCase()) {
    case '今天':
    case '今日': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      return { start, end };
    }

    case '昨天':
    case '昨日': {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
      const end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
      return { start, end };
    }

    case '前天': {
      const dayBeforeYesterday = new Date(now);
      dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
      const start = new Date(dayBeforeYesterday.getFullYear(), dayBeforeYesterday.getMonth(), dayBeforeYesterday.getDate());
      const end = new Date(dayBeforeYesterday.getFullYear(), dayBeforeYesterday.getMonth(), dayBeforeYesterday.getDate(), 23, 59, 59);
      return { start, end };
    }

    case '这周':
    case '本周': {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      return { start: startOfWeek, end: now };
    }

    case '上周':
    case '上星期': {
      const startOfLastWeek = new Date(now);
      startOfLastWeek.setDate(startOfLastWeek.getDate() - startOfLastWeek.getDay() - 7);
      startOfLastWeek.setHours(0, 0, 0, 0);
      const endOfLastWeek = new Date(startOfLastWeek);
      endOfLastWeek.setDate(endOfLastWeek.getDate() + 6);
      endOfLastWeek.setHours(23, 59, 59);
      return { start: startOfLastWeek, end: endOfLastWeek };
    }

    case '这个月':
    case '本月': {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: startOfMonth, end: now };
    }

    case '上个月':
    case '上月': {
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      return { start: startOfLastMonth, end: endOfLastMonth };
    }

    default:
      return null;
  }
}

/**
 * Format duration in milliseconds to human-readable format
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}天${hours % 24}小时`;
  }
  if (hours > 0) {
    return `${hours}小时${minutes % 60}分钟`;
  }
  if (minutes > 0) {
    return `${minutes}分钟`;
  }
  return `${seconds}秒`;
}
