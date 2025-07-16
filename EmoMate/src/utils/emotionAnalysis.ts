import { EmotionType, FaceData } from '../types/emotion';
import { CLAUDE_API_CONFIG, getClaudeApiKey } from '../constants/ai';
import { debugLog } from './debug';

export function getEmotionFromFace(face: FaceData): EmotionType {
  const { 
    smilingProbability = 0, 
    leftEyeOpenProbability = 1, 
    rightEyeOpenProbability = 1 
  } = face;

  const avgEyeOpenProbability = (leftEyeOpenProbability + rightEyeOpenProbability) / 2;
  
  // Happy emotion detection
  if (smilingProbability > 0.8) {
    return 'happy';
  }
  
  // Sad emotion detection (low smile + mostly closed eyes)
  if (smilingProbability < 0.2 && avgEyeOpenProbability < 0.3) {
    return 'sad';
  }
  
  // Surprised emotion detection (high eye open + neutral/low smile)
  if (avgEyeOpenProbability > 0.9 && smilingProbability < 0.5) {
    return 'surprised';
  }
  
  // Default to neutral for unclear expressions
  return 'neutral';
}

// Keyword-based emotion analysis for text
const EMOTION_KEYWORDS = {
  happy: ['开心', '高兴', '快乐', '兴奋', '愉快', '欣喜', '喜悦', '满意', '幸福', 'happy', 'joy', 'excited'],
  sad: ['难过', '伤心', '沮丧', '失落', '痛苦', '悲伤', '郁闷', '不开心', 'sad', 'depressed', 'upset'],
  angry: ['生气', '愤怒', '气愤', '恼火', '烦躁', '讨厌', '恨', '怒', 'angry', 'mad', 'furious'],
  surprised: ['惊讶', '震惊', '意外', '吃惊', '惊奇', '不敢相信', 'surprised', 'shocked', 'amazed'],
  neutral: ['还好', '一般', '平常', '普通', '正常', 'okay', 'fine', 'neutral']
};

export async function analyzeTextEmotion(text: string): Promise<EmotionType> {
  const lowerText = text.toLowerCase();
  
  // First try keyword-based detection for quick results
  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    if (keywords.some(keyword => lowerText.includes(keyword.toLowerCase()))) {
      debugLog('EmotionAnalysis', `Keyword-based emotion detected: ${emotion}`, { text });
      return emotion as EmotionType;
    }
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
          content: `Analyze the emotion in this text and respond with only one word from: happy, sad, angry, surprised, neutral

Text: "${text}"`
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const emotionResult = data.content?.[0]?.text?.trim().toLowerCase();
    
    // Validate the response is a valid emotion
    const validEmotions: EmotionType[] = ['happy', 'sad', 'angry', 'surprised', 'neutral'];
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