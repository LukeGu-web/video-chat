/**
 * Object Recognition Announcer
 * Generates natural announcements for recognized objects
 * Adjusts verbosity based on recognition detail level
 */

import { ObjectRecognitionData } from '../types/scene';
import { debugLog } from './debug';

/**
 * Announcement Style
 */
export enum AnnouncementStyle {
  SIMPLE = 'simple',       // Just the name: "这是一个苹果~"
  DETAILED = 'detailed',   // Name + category: "这是一个红色的苹果，属于水果类~"
  ENTHUSIASTIC = 'enthusiastic', // Full details with excitement
}

/**
 * Determine announcement style based on object data completeness
 */
function determineAnnouncementStyle(object: ObjectRecognitionData): AnnouncementStyle {
  const hasDescription = object.description && object.description.length > 10;
  const hasHighConfidence = object.confidence >= 0.8;
  const hasCategory = object.category && object.category !== '未知';

  if (hasDescription && hasHighConfidence && hasCategory) {
    return AnnouncementStyle.DETAILED;
  } else if (hasDescription || hasCategory) {
    return AnnouncementStyle.DETAILED;
  } else {
    return AnnouncementStyle.SIMPLE;
  }
}

/**
 * Generate simple announcement
 */
function generateSimpleAnnouncement(
  object: ObjectRecognitionData,
  language: 'zh' | 'en' = 'zh'
): string {
  const templates =
    language === 'en'
      ? [
          `This is ${object.objectName}~`,
          `This is a ${object.objectName}~`,
          `Oh, it's ${object.objectName}~`,
          `I see a ${object.objectName}~`,
        ]
      : [
          `这是${object.objectName}~`,
          `这个是${object.objectName}呢~`,
          `嗯，这是${object.objectName}~`,
          `我看到的是${object.objectName}~`,
        ];

  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Generate detailed announcement
 */
function generateDetailedAnnouncement(
  object: ObjectRecognitionData,
  language: 'zh' | 'en' = 'zh'
): string {
  const hasCategory = object.category && object.category !== '未知';
  const hasDescription = object.description && object.description.length > 10;

  if (hasDescription && hasCategory) {
    // Full description with category
    const templates =
      language === 'en'
        ? [
            `This is ${object.objectName}, ${object.description}, it belongs to ${object.category} category~`,
            `I see ${object.objectName}~ ${object.description}, it's a ${object.category}~`,
            `Well, this is ${object.objectName}, ${object.description}~`,
          ]
        : [
            `这是${object.objectName}，${object.description}，属于${object.category}类呢~`,
            `我看到的是${object.objectName}~${object.description}，这是${object.category}类的东西~`,
            `嗯，这个是${object.objectName}，${object.description}~`,
          ];
    return templates[Math.floor(Math.random() * templates.length)];
  } else if (hasDescription) {
    // Description only
    const templates =
      language === 'en'
        ? [
            `This is ${object.objectName}, ${object.description}~`,
            `I see ${object.objectName}, ${object.description}~`,
            `Well, this is ${object.objectName}~ ${object.description}~`,
          ]
        : [
            `这是${object.objectName}，${object.description}~`,
            `我看到的是${object.objectName}，${object.description}~`,
            `嗯，这个是${object.objectName}~${object.description}~`,
          ];
    return templates[Math.floor(Math.random() * templates.length)];
  } else if (hasCategory) {
    // Category only
    const templates =
      language === 'en'
        ? [
            `This is ${object.objectName}, it belongs to ${object.category}~`,
            `This is ${object.objectName}, it's a ${object.category}~`,
            `Well, I see ${object.objectName}, this is ${object.category}~`,
          ]
        : [
            `这是${object.objectName}，属于${object.category}类~`,
            `这个是${object.objectName}，是${object.category}类的东西呢~`,
            `嗯，我看到的是${object.objectName}，这是${object.category}~`,
          ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  // Fallback to simple
  return generateSimpleAnnouncement(object, language);
}

/**
 * Generate enthusiastic announcement (for high confidence + rich data)
 */
function generateEnthusiasticAnnouncement(
  object: ObjectRecognitionData,
  language: 'zh' | 'en' = 'zh'
): string {
  const templates =
    language === 'en'
      ? [
          `Wow! This is ${object.objectName}! ${object.description}~ So interesting!`,
          `Oh! I recognized it, this is ${object.objectName}! ${object.description}~`,
          `Ah! I know this~ it's ${object.objectName}! ${object.description}~`,
        ]
      : [
          `哇！这是${object.objectName}！${object.description}~真有趣呢！`,
          `诶！我认出来了，这是${object.objectName}！${object.description}~`,
          `啊！这个我知道~是${object.objectName}！${object.description}~`,
        ];

  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Generate announcement based on object data
 */
export function generateObjectAnnouncement(
  object: ObjectRecognitionData,
  style?: AnnouncementStyle,
  language: 'zh' | 'en' = 'zh'
): string {
  // Auto-determine style if not provided
  const announcementStyle = style || determineAnnouncementStyle(object);

  debugLog('ObjectRecognitionAnnouncer', 'Generating announcement', {
    objectName: object.objectName,
    style: announcementStyle,
    confidence: object.confidence,
    language,
  });

  switch (announcementStyle) {
    case AnnouncementStyle.SIMPLE:
      return generateSimpleAnnouncement(object, language);

    case AnnouncementStyle.DETAILED:
      return generateDetailedAnnouncement(object, language);

    case AnnouncementStyle.ENTHUSIASTIC:
      return generateEnthusiasticAnnouncement(object, language);

    default:
      return generateSimpleAnnouncement(object, language);
  }
}

/**
 * Error Announcement Templates
 */
const ERROR_ANNOUNCEMENTS = {
  zh: {
    // Low confidence
    lowConfidence: [
      '诶...我好像看不太清楚呢~',
      '嗯...这个有点模糊，我不太确定呢~',
      '抱歉，我看得不太清楚~',
    ],

    // API error
    apiError: [
      '诶...出了点小问题，我没看清~',
      '抱歉，刚才没看清楚呢~',
      '嗯...好像出了点问题~',
    ],

    // General failure
    generalFailure: [
      '抱歉，我没认出来~',
      '诶...这个我认不出来呢~',
      '嗯...我好像不认识这个~',
    ],
  },

  en: {
    // Low confidence
    lowConfidence: [
      'Um... I can\'t see it clearly~',
      'Hmm... it\'s a bit blurry, I\'m not sure~',
      'Sorry, I can\'t see it clearly~',
    ],

    // API error
    apiError: [
      'Oh... there\'s a small problem, I didn\'t see it clearly~',
      'Sorry, I didn\'t see it clearly just now~',
      'Um... something went wrong~',
    ],

    // General failure
    generalFailure: [
      'Sorry, I didn\'t recognize it~',
      'Um... I can\'t recognize this~',
      'Well... I don\'t seem to know this~',
    ],
  },
};

/**
 * Error Type
 */
export enum RecognitionErrorType {
  LOW_CONFIDENCE = 'lowConfidence',
  API_ERROR = 'apiError',
  GENERAL_FAILURE = 'generalFailure',
}

/**
 * Generate error announcement
 */
export function generateErrorAnnouncement(
  errorType: RecognitionErrorType,
  language: 'zh' | 'en' = 'zh'
): string {
  const templates = ERROR_ANNOUNCEMENTS[language][errorType];
  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Retry Prompt Templates
 */
const RETRY_PROMPTS = {
  zh: [
    '要不要再试一次呢？',
    '换个角度试试看？',
    '要重新看一下吗？',
    '再给我看一次好不好~',
  ],
  en: [
    'Want to try again?',
    'Maybe try from a different angle?',
    'Should we try again?',
    'Show me one more time~',
  ],
};

/**
 * Generate retry prompt
 */
export function generateRetryPrompt(language: 'zh' | 'en' = 'zh'): string {
  const prompts = RETRY_PROMPTS[language];
  return prompts[Math.floor(Math.random() * prompts.length)];
}

/**
 * Generate full error message with retry prompt
 */
export function generateErrorWithRetry(
  errorType: RecognitionErrorType,
  language: 'zh' | 'en' = 'zh'
): string {
  const errorMsg = generateErrorAnnouncement(errorType, language);
  const retryPrompt = generateRetryPrompt(language);
  return `${errorMsg}${retryPrompt}`;
}
