/**
 * Background Story Generation System
 *
 * Generates contextual background stories for the AI companion
 * based on current time, weather, and selected scene.
 */

import {
  getSceneForContext,
  getDayType,
  getSceneImagePath,
  STORY_TEMPLATES,
  WEATHER_DESCRIPTORS,
  type SceneMetadata,
  type WeatherType,
} from '../constants';

// ==================== Types ====================

export interface BackgroundContext {
  scene: SceneMetadata;
  imagePath: string;
  story: string;
  timestamp: Date;
  weather: WeatherType;
}

interface StoryVariables {
  time: string;
  weather_desc: string;
  weather_feeling: string;
  mood_desc: string;
  activity_desc: string;
  scene_detail: string;
  plan: string;
  thought: string;
  food_mention: string;
  atmosphere: string;
  sunset_desc: string;
}

// ==================== Configuration ====================

const MOOD_DESCRIPTORS = [
  '心情很不错',
  '感觉很平静',
  '心里暖暖的',
  '有点小期待',
  '觉得很舒服',
  '感觉挺放松的',
  '有种安心的感觉',
];

const ACTIVITY_DESCRIPTORS: Record<string, string[]> = {
  bedroom: ['坐在书桌前', '躺在床上', '靠在窗边', '整理东西'],
  classroom: ['坐在座位上', '看着黑板', '翻着课本', '听着课'],
  library: ['看着书', '做着笔记', '在书架间找书', '安静地学习'],
  cafe: ['喝着咖啡', '看着窗外', '发着呆', '和朋友聊天'],
  park: ['散着步', '坐在长椅上', '看着风景', '呼吸着新鲜空气'],
  default: ['做着自己的事', '放松着', '享受着当下', '想着心事'],
};

const SCENE_DETAILS: Record<string, string[]> = {
  morning: [
    '阳光透过窗帘照进来',
    '空气清新舒爽',
    '一切都刚刚苏醒',
    '晨光很柔和',
  ],
  noon: ['阳光正好', '有点热但还好', '光线很明亮', '一天过了一半了'],
  afternoon: [
    '阳光从窗外斜射进来',
    '时间过得挺快',
    '光线很舒服',
    '下午的氛围很惬意',
  ],
  evening: [
    '夕阳的余晖洒进来',
    '天色渐渐暗下来',
    '灯光亮起来了',
    '傍晚的空气凉凉的',
  ],
  night: ['夜深人静', '星星在闪烁', '月光很美', '安静得只听到自己的呼吸'],
  day: ['阳光很好', '天气宜人', '氛围很舒适', '一切都刚刚好'],
};

const PLANS: Record<string, string[]> = {
  everyday: [
    '下午要去图书馆',
    '晚上打算早点休息',
    '待会儿要去社团活动',
    '放学后想去便利店',
    '今天要好好复习',
  ],
  weekend: [
    '下午想去逛逛',
    '晚上约了朋友见面',
    '准备好好休息一下',
    '想做点喜欢的事',
    '打算在家放松',
  ],
  holiday: [
    '接下来想去海边走走',
    '打算好好享受假期',
    '想去一些没去过的地方',
    '准备多睡一会儿',
    '计划好好玩一玩',
  ],
};

// ==================== Helper Functions ====================

/**
 * Get current weather (mock - replace with real weather API)
 */
async function getCurrentWeather(): Promise<WeatherType> {
  // TODO: Integrate with weather API
  // For now, return based on time and randomness
  const hour = new Date().getHours();
  const random = Math.random();

  if (hour >= 6 && hour < 18) {
    if (random > 0.7) return 'sunny';
    if (random > 0.5) return 'cloudy';
    if (random > 0.3) return 'rainy';
  }

  return 'default';
}

/**
 * Format time in Chinese
 */
function formatTime(date: Date): string {
  const hour = date.getHours();
  const minute = date.getMinutes();

  let period = '';
  if (hour < 6) period = '凌晨';
  else if (hour < 9) period = '早上';
  else if (hour < 12) period = '上午';
  else if (hour < 14) period = '中午';
  else if (hour < 18) period = '下午';
  else if (hour < 21) period = '傍晚';
  else period = '晚上';

  const displayHour = hour > 12 ? hour - 12 : hour;
  const minuteStr = minute > 0 ? `${minute}分` : '';

  return `${period}${displayHour}点${minuteStr}`;
}

/**
 * Generate random selection from array
 */
function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate story variables based on context
 */
function generateStoryVariables(
  scene: SceneMetadata,
  weather: WeatherType,
  date: Date
): Partial<StoryVariables> {
  const weatherInfo =
    WEATHER_DESCRIPTORS[weather] || WEATHER_DESCRIPTORS.default;
  const activities =
    ACTIVITY_DESCRIPTORS[scene.location] || ACTIVITY_DESCRIPTORS.default;
  const sceneDetails = SCENE_DETAILS[scene.timePeriod] || SCENE_DETAILS.day;
  const plans = PLANS[scene.dayType] || PLANS.everyday;

  return {
    time: formatTime(date),
    weather_desc: weatherInfo.desc,
    weather_feeling: weatherInfo.feeling,
    mood_desc: randomChoice(MOOD_DESCRIPTORS),
    activity_desc: randomChoice(activities),
    scene_detail: randomChoice(sceneDetails),
    plan: randomChoice(plans),
    thought: '今天会是怎样的一天呢',
    food_mention: '一杯热饮',
    atmosphere: randomChoice(weatherInfo.atmospheres),
    sunset_desc: '西下得很美',
  };
}

/**
 * Fill template with variables
 */
function fillTemplate(
  template: string,
  variables: Partial<StoryVariables>
): string {
  let result = template;

  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{${key}}`;
    result = result.replace(new RegExp(placeholder, 'g'), value || '');
  });

  return result;
}

/**
 * Generate background story from template
 */
function generateStoryFromTemplate(
  scene: SceneMetadata,
  weather: WeatherType,
  date: Date
): string {
  // Get story template
  const template = scene.storyTemplateId
    ? STORY_TEMPLATES[scene.storyTemplateId]
    : null;

  // If no template, generate simple story
  if (!template) {
    const time = formatTime(date);
    const weatherDesc = WEATHER_DESCRIPTORS[weather]?.desc || '天气还不错';
    return `现在是${time}，${weatherDesc}。${scene.description}。`;
  }

  // Generate variables
  const variables = generateStoryVariables(scene, weather, date);

  // Pick random template
  const templateStr = randomChoice(template.templates);

  // Fill template
  return fillTemplate(templateStr, variables);
}

// ==================== Main Functions ====================

/**
 * Generate complete background context
 *
 * This is the main function to call when initializing the app
 * or when background needs to be refreshed (e.g., after 30 minutes)
 */
export async function generateBackgroundContext(): Promise<BackgroundContext> {
  const now = new Date();
  const dayType = getDayType(now);
  const currentHour = now.getHours();
  const weather = await getCurrentWeather();

  // Get appropriate scene
  const scene = getSceneForContext(dayType, currentHour, weather);

  if (!scene) {
    // Fallback to a default scene
    throw new Error('No appropriate scene found for current context');
  }

  // Get image path with weather variant
  const imagePath = getSceneImagePath(scene, weather);

  // Generate story
  const story = generateStoryFromTemplate(scene, weather, now);

  return {
    scene,
    imagePath,
    story,
    timestamp: now,
    weather,
  };
}

/**
 * Check if background context should be refreshed
 */
export function shouldRefreshBackground(lastTimestamp: Date): boolean {
  const now = new Date();
  const diffMinutes = (now.getTime() - lastTimestamp.getTime()) / (1000 * 60);

  // Refresh after 30 minutes
  return diffMinutes >= 30;
}

/**
 * Get full image URI for React Native
 */
export function getBackgroundImageSource(imagePath: string) {
  // Map image path to require() statement
  // This is a helper for React Native's asset system

  const pathMap: Record<string, any> = {
    // Everyday scenes
    'everyday/morning/bedroom.jpeg': require('../../assets/background/everyday/morning/bedroom.jpeg'),
    'everyday/morning/commute.jpeg': require('../../assets/background/everyday/morning/commute.jpeg'),
    'everyday/morning/classroom.jpeg': require('../../assets/background/everyday/morning/classroom.jpeg'),
    'everyday/noon/classroom.jpeg': require('../../assets/background/everyday/noon/classroom.jpeg'),
    'everyday/noon/cafeteria.jpeg': require('../../assets/background/everyday/noon/cafeteria.jpeg'),
    'everyday/noon/rooftop.jpeg': require('../../assets/background/everyday/noon/rooftop.jpeg'),
    'everyday/afternoon/classroom.jpeg': require('../../assets/background/everyday/afternoon/classroom.jpeg'),
    'everyday/afternoon/library.jpeg': require('../../assets/background/everyday/afternoon/library.jpeg'),
    'everyday/afternoon/artroom.jpeg': require('../../assets/background/everyday/afternoon/artroom.jpeg'),
    'everyday/afternoon/playground.jpeg': require('../../assets/background/everyday/afternoon/playground.jpeg'),
    'everyday/evening/commute.jpeg': require('../../assets/background/everyday/evening/commute.jpeg'),
    'everyday/evening/livingroom.jpeg': require('../../assets/background/everyday/evening/livingroom.jpeg'),
    'everyday/evening/bedroom.jpeg': require('../../assets/background/everyday/evening/bedroom.jpeg'),
    'everyday/night/bedroom.jpeg': require('../../assets/background/everyday/night/bedroom.jpeg'),
    'everyday/night/balcony.jpeg': require('../../assets/background/everyday/night/balcony.jpeg'),

    // Weekend scenes
    'weekend/day/cafe.jpeg': require('../../assets/background/weekend/day/cafe.jpeg'),
    'weekend/day/park.jpeg': require('../../assets/background/weekend/day/park.jpeg'),
    'weekend/day/street.jpeg': require('../../assets/background/weekend/day/street.jpeg'),
    'weekend/night/street.jpeg': require('../../assets/background/weekend/night/street.jpeg'),
    'weekend/night/nightmarket.jpeg': require('../../assets/background/weekend/night/nightmarket.jpeg'),

    // Holiday scenes
    'holiday/ocean.jpeg': require('../../assets/background/holiday/ocean.jpeg'),
    'holiday/street.jpeg': require('../../assets/background/holiday/street.jpeg'),
  };

  const source = pathMap[imagePath];
  if (!source) {
    console.warn(`Background image not found: ${imagePath}`);
    // Return a fallback image
    return require('../../assets/background/everyday/morning/bedroom.jpeg');
  }

  return source;
}

/**
 * Format background story for AI system message
 *
 * This generates the system message that will be added to the AI's context
 */
export function formatStoryForAI(context: BackgroundContext): string {
  const { scene, story } = context;

  return `
[背景故事]
${story}

[当前环境]
- 地点: ${scene.description}
- 时间: ${formatTime(context.timestamp)}
- 天气: ${WEATHER_DESCRIPTORS[context.weather].desc}
- 氛围: ${WEATHER_DESCRIPTORS[context.weather].atmospheres.join('、')}

请在对话中自然地引用这个背景故事。如果用户问"你在做什么"、"你在哪里"等问题，可以基于这个背景进行回答和延伸。
`.trim();
}
