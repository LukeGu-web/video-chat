import { EmotionType, FaceData } from '../../types/emotion';
import { CLAUDE_API_CONFIG, getClaudeApiKey } from '../../constants/ai';
import { debugLog } from '../../utils/debug';

export function getEmotionFromFace(face: FaceData): EmotionType {
  const {
    smilingProbability = 0,
    leftEyeOpenProbability = 1,
    rightEyeOpenProbability = 1
  } = face;

  const avgEyeOpenProbability = (leftEyeOpenProbability + rightEyeOpenProbability) / 2;

  // Plutchik's 8 basic emotions detection

  // Joy detection (high smile + open eyes)
  if (smilingProbability > 0.7 && avgEyeOpenProbability > 0.5) {
    return 'joy';
  }

  // Sadness detection (low smile + mostly closed eyes)
  if (smilingProbability < 0.2 && avgEyeOpenProbability < 0.4) {
    return 'sadness';
  }

  // Surprise detection (very wide eyes + mouth open)
  if (avgEyeOpenProbability > 0.8 && smilingProbability < 0.5) {
    return 'surprise';
  }

  // Fear detection (very wide eyes + no smile)
  if (avgEyeOpenProbability > 0.85 && smilingProbability < 0.3) {
    return 'fear';
  }

  // Anger detection (no smile + eyes open)
  if (smilingProbability < 0.15 && avgEyeOpenProbability > 0.6) {
    return 'anger';
  }

  // Disgust detection (eyes half closed + slight frown)
  if (avgEyeOpenProbability < 0.5 && smilingProbability < 0.2) {
    return 'disgust';
  }

  // Trust detection (moderate smile + relaxed)
  if (smilingProbability > 0.4 && smilingProbability < 0.7 && avgEyeOpenProbability > 0.5) {
    return 'trust';
  }

  // Anticipation detection (wide eyes + slight smile)
  if (avgEyeOpenProbability > 0.7 && smilingProbability > 0.3 && smilingProbability < 0.6) {
    return 'anticipation';
  }

  // Default to neutral for unclear expressions
  return 'neutral';
}

// Keyword-based emotion analysis for text (Plutchik's 8 emotions)
const EMOTION_KEYWORDS: Record<EmotionType, string[]> = {
  joy: ['开心', '高兴', '快乐', '愉快', '欣喜', '喜悦', '满意', '幸福', '太好了', '好棒', 'happy', 'joy', 'delighted'],
  sadness: ['难过', '伤心', '沮丧', '失落', '痛苦', '悲伤', '郁闷', '不开心', 'sad', 'depressed', 'upset', 'unhappy'],
  anger: ['生气', '愤怒', '气愤', '恼火', '烦躁', '讨厌', '恨', '怒', 'angry', 'mad', 'furious', 'irritated'],
  fear: ['害怕', '恐惧', '担心', '紧张', '不安', '焦虑', '惶恐', 'fear', 'scared', 'afraid', 'worried', 'anxious'],
  surprise: ['惊讶', '震惊', '意外', '吃惊', '惊奇', '不敢相信', '诶？', '欸？', '真的吗', 'surprised', 'shocked', 'amazed', 'astonished'],
  disgust: ['恶心', '厌恶', '反感', '恶心', '嫌弃', '讨厌', 'disgusted', 'gross', 'yuck', 'nasty'],
  trust: ['信任', '相信', '放心', '安心', '可靠', '依赖', 'trust', 'believe', 'confident', 'rely'],
  anticipation: ['期待', '盼望', '期望', '等待', '希望', '憧憬', 'anticipate', 'expect', 'look forward', 'hope'],
  neutral: ['还好', '一般', '平常', '普通', '正常', 'okay', 'fine', 'neutral', 'normal']
};

// Interjection-only phrases that should default to neutral if no other emotion detected
const PURE_INTERJECTIONS = ['嗯', '呃', '啊', '哦', '诶', '欸', '呢', '吧', '哈', '嘿', '唔', '哎', '嗯嗯', '哈哈', '嘿嘿'];

export async function analyzeTextEmotion(text: string): Promise<EmotionType> {
  const lowerText = text.toLowerCase();

  // Check if text is pure interjection (should be neutral/idle)
  const cleanText = text.replace(/[。！？.!?\s~…]+/g, '');
  if (cleanText.length <= 3 && PURE_INTERJECTIONS.some(i => cleanText.includes(i))) {
    debugLog('EmotionAnalysis', `Pure interjection detected, defaulting to neutral: "${text}"`);
    return 'neutral';
  }

  // First try keyword-based detection for quick results
  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    if (keywords.some(keyword => lowerText.includes(keyword.toLowerCase()))) {
      debugLog('EmotionAnalysis', `Keyword-based emotion detected: ${emotion}`, { text });
      return emotion as EmotionType;
    }
  }

  // If text is too short (< 4 chars after cleanup), default to neutral
  if (cleanText.length < 4) {
    debugLog('EmotionAnalysis', `Text too short, defaulting to neutral: "${text}"`);
    return 'neutral';
  }

  // If no keywords found, use Claude API for semantic analysis
  try {
    const apiKey = getClaudeApiKey();
    if (!apiKey) {
      debugLog('EmotionAnalysis', 'No Claude API key available, returning neutral');
      return 'neutral';
    }

    const response = await fetch(CLAUDE_API_CONFIG.baseURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{
          role: 'user',
          content: `Analyze the emotion in this text and respond with only one word from Plutchik's emotions: joy, sadness, anger, fear, surprise, disgust, trust, anticipation, neutral

Text: "${text}"`
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const emotionResult = data.content?.[0]?.text?.trim().toLowerCase();

    // Validate the response is a valid emotion (Plutchik's 8 + neutral)
    const validEmotions: EmotionType[] = ['joy', 'sadness', 'anger', 'fear', 'surprise', 'disgust', 'trust', 'anticipation', 'neutral'];
    const detectedEmotion = validEmotions.find(e => e === emotionResult) || 'neutral';

    debugLog('EmotionAnalysis', `Claude API emotion detected: ${detectedEmotion}`, { text, rawResponse: emotionResult });
    return detectedEmotion;

  } catch (error) {
    debugLog('EmotionAnalysis', 'Claude API emotion analysis failed, returning neutral', error);
    return 'neutral';
  }
}

// Combine facial and text emotions with priority: text > facial > neutral
export function combineEmotions(
  facialEmotion: EmotionType | null, 
  textEmotion: EmotionType | null
): EmotionType {
  if (textEmotion && textEmotion !== 'neutral') {
    return textEmotion;
  }
  
  if (facialEmotion && facialEmotion !== 'neutral') {
    return facialEmotion;
  }
  
  return 'neutral';
}