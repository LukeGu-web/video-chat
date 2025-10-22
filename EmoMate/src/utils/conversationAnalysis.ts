/**
 * Conversation Analysis Utilities
 * Phase 1 优化: 对话类型检测工具
 *
 * 功能:
 * - 检测用户消息类型
 * - 判断合适的过渡语音类别
 * - 根据情绪和内容智能选择回应方式
 */

import type { TransitionCategory } from './transitionAudio';

/**
 * 情绪类型
 */
export type Emotion = 'happy' | 'sad' | 'angry' | 'neutral' | 'confused' | 'excited';

/**
 * 检测过渡语音类别
 * @param userMessage 用户消息内容
 * @param userEmotion 用户情绪(可选)
 * @returns 过渡语音类别
 */
export function detectTransitionCategory(
  userMessage: string,
  userEmotion?: Emotion
): TransitionCategory {
  const message = userMessage.trim().toLowerCase();

  // 1. 检测是否为问题
  if (isQuestion(message)) {
    return 'question';
  }

  // 2. 检测是否为简单确认
  if (isAcknowledgment(message)) {
    return 'acknowledgment';
  }

  // 3. 根据情绪选择
  if (userEmotion) {
    const emotionCategory = getEmotionBasedCategory(userEmotion);
    if (emotionCategory) return emotionCategory;
  }

  // 4. 根据消息内容情感检测
  const contentEmotion = detectContentEmotion(message);
  if (contentEmotion) {
    const emotionCategory = getEmotionBasedCategory(contentEmotion);
    if (emotionCategory) return emotionCategory;
  }

  // 5. 默认: 思考类
  return 'thinking';
}

/**
 * 检测是否为问题
 */
function isQuestion(message: string): boolean {
  // 检测问号
  if (message.includes('?') || message.includes('？')) {
    return true;
  }

  // 检测疑问词
  const questionWords = [
    '吗', '呢', '嘛', '么', '吧',
    '什么', '怎么', '为什么', '哪', '谁',
    '多少', '几', '何时', '哪里', '如何'
  ];

  return questionWords.some(word => message.includes(word));
}

/**
 * 检测是否为简单确认
 */
function isAcknowledgment(message: string): boolean {
  const acknowledgments = [
    '好', '嗯', '知道了', 'ok', '可以',
    '行', '懂了', '明白', '收到', '好的',
    '嗯嗯', '好好', '是的', '对的'
  ];

  // 完全匹配或长度小于5且包含确认词
  return acknowledgments.some(word =>
    message === word || (message.length <= 5 && message.includes(word))
  );
}

/**
 * 根据情绪获取过渡类别
 */
function getEmotionBasedCategory(emotion: Emotion): TransitionCategory | null {
  switch (emotion) {
    case 'happy':
    case 'excited':
      return 'excited';

    case 'sad':
    case 'angry':
      return 'empathy';

    case 'confused':
      return 'thinking';

    default:
      return null;
  }
}

/**
 * 从消息内容检测情绪
 */
function detectContentEmotion(message: string): Emotion | null {
  // 开心相关词汇
  const happyWords = [
    '开心', '高兴', '快乐', '哈哈', '嘿嘿',
    '棒', '太好了', '真好', '不错', '喜欢'
  ];

  // 难过相关词汇
  const sadWords = [
    '难过', '伤心', '沮丧', '哭', '郁闷',
    '失落', '悲伤', '痛苦', '不开心'
  ];

  // 生气相关词汇
  const angryWords = [
    '生气', '愤怒', '气', '烦', '讨厌',
    '可恶', '该死', '混蛋'
  ];

  // 兴奋相关词汇
  const excitedWords = [
    '激动', '兴奋', '哇', '哇塞', '太棒了',
    '厉害', '牛', '赞', '酷'
  ];

  // 检测情绪
  if (happyWords.some(word => message.includes(word))) {
    return 'happy';
  }

  if (excitedWords.some(word => message.includes(word))) {
    return 'excited';
  }

  if (sadWords.some(word => message.includes(word))) {
    return 'sad';
  }

  if (angryWords.some(word => message.includes(word))) {
    return 'angry';
  }

  return null;
}

/**
 * 获取过渡类别的描述文本(用于调试)
 */
export function getTransitionCategoryDescription(category: TransitionCategory): string {
  const descriptions: Record<TransitionCategory, string> = {
    thinking: '思考类 - 中性回应',
    question: '疑问类 - 用户提问',
    excited: '兴奋类 - 积极内容',
    empathy: '共鸣类 - 情感支持',
    acknowledgment: '确认类 - 简单回应',
  };

  return descriptions[category];
}
