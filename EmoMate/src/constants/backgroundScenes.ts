/**
 * Background Scene Management System
 *
 * This configuration file manages all background scenes and their associated
 * metadata, including story templates, time periods, and weather variants.
 *
 * How to add new scenes:
 * 1. Add image file to appropriate folder in EmoMate/assets/background/
 * 2. Add scene entry to SCENE_CONFIG below
 * 3. (Optional) Add story template to STORY_TEMPLATES
 *
 * How to add weather variants:
 * 1. Add image with weather suffix (e.g., bedroom_rainy.jpeg)
 * 2. Scene will automatically support weather variants
 */

// ==================== Type Definitions ====================

export type DayType = 'everyday' | 'weekend' | 'holiday';
export type TimePeriod = 'morning' | 'noon' | 'afternoon' | 'evening' | 'night' | 'day';
export type WeatherType = 'default' | 'sunny' | 'rainy' | 'cloudy' | 'snowy';

export interface SceneMetadata {
  id: string;                    // Unique scene identifier
  dayType: DayType;              // Day type category
  timePeriod: TimePeriod;        // Time period of day
  location: string;              // Scene location name
  imagePath: string;             // Path to image file (relative to assets/background)
  description: string;           // Scene description for context
  storyTemplateId?: string;      // Reference to story template
  tags?: string[];               // Optional tags for filtering
  timeRange?: [number, number];  // Hour range [start, end] for auto-selection
  weatherVariants?: WeatherType[]; // Available weather variants
  priority?: number;             // Selection priority (higher = more likely)
}

export interface StoryTemplate {
  id: string;
  templates: string[];           // Array of possible story templates
  contexts: string[];            // Context hints for AI story generation
}

// ==================== Scene Configuration ====================

export const SCENE_CONFIG: SceneMetadata[] = [
  // ========== Everyday Scenes ==========

  // Morning (6:00-9:00)
  {
    id: 'everyday_morning_bedroom',
    dayType: 'everyday',
    timePeriod: 'morning',
    location: 'bedroom',
    imagePath: 'everyday/morning/bedroom.jpeg',
    description: 'Morning bedroom with sunlight coming through the window',
    storyTemplateId: 'morning_bedroom',
    timeRange: [6, 8],
    tags: ['private', 'home', 'wake-up'],
    priority: 10,
    weatherVariants: ['default', 'sunny', 'rainy', 'cloudy'],
  },
  {
    id: 'everyday_morning_commute',
    dayType: 'everyday',
    timePeriod: 'morning',
    location: 'commute',
    imagePath: 'everyday/morning/commute.jpeg',
    description: 'On the way to school in the morning',
    storyTemplateId: 'morning_commute',
    timeRange: [7, 9],
    tags: ['outdoor', 'transit', 'school'],
    priority: 8,
    weatherVariants: ['default', 'sunny', 'rainy', 'cloudy'],
  },
  {
    id: 'everyday_morning_classroom',
    dayType: 'everyday',
    timePeriod: 'morning',
    location: 'classroom',
    imagePath: 'everyday/morning/classroom.jpeg',
    description: 'Classroom in the morning, early study session',
    storyTemplateId: 'morning_classroom',
    timeRange: [8, 9],
    tags: ['school', 'study'],
    priority: 7,
  },

  // Noon (9:00-14:00)
  {
    id: 'everyday_noon_classroom',
    dayType: 'everyday',
    timePeriod: 'noon',
    location: 'classroom',
    imagePath: 'everyday/noon/classroom.jpeg',
    description: 'Classroom during class time',
    storyTemplateId: 'noon_classroom',
    timeRange: [9, 12],
    tags: ['school', 'class', 'study'],
    priority: 9,
  },
  {
    id: 'everyday_noon_cafeteria',
    dayType: 'everyday',
    timePeriod: 'noon',
    location: 'cafeteria',
    imagePath: 'everyday/noon/cafeteria.jpeg',
    description: 'School cafeteria during lunch time',
    storyTemplateId: 'noon_cafeteria',
    timeRange: [12, 14],
    tags: ['school', 'food', 'social'],
    priority: 10,
  },
  {
    id: 'everyday_noon_rooftop',
    dayType: 'everyday',
    timePeriod: 'noon',
    location: 'rooftop',
    imagePath: 'everyday/noon/rooftop.jpeg',
    description: 'School rooftop, peaceful lunch spot',
    storyTemplateId: 'noon_rooftop',
    timeRange: [12, 14],
    tags: ['school', 'outdoor', 'peaceful'],
    priority: 6,
  },

  // Afternoon (14:00-18:00)
  {
    id: 'everyday_afternoon_classroom',
    dayType: 'everyday',
    timePeriod: 'afternoon',
    location: 'classroom',
    imagePath: 'everyday/afternoon/classroom.jpeg',
    description: 'Afternoon classes',
    storyTemplateId: 'afternoon_classroom',
    timeRange: [14, 16],
    tags: ['school', 'class', 'study'],
    priority: 8,
  },
  {
    id: 'everyday_afternoon_library',
    dayType: 'everyday',
    timePeriod: 'afternoon',
    location: 'library',
    imagePath: 'everyday/afternoon/library.jpeg',
    description: 'School library, quiet study area',
    storyTemplateId: 'afternoon_library',
    timeRange: [15, 18],
    tags: ['school', 'study', 'quiet'],
    priority: 7,
  },
  {
    id: 'everyday_afternoon_artroom',
    dayType: 'everyday',
    timePeriod: 'afternoon',
    location: 'artroom',
    imagePath: 'everyday/afternoon/artroom.jpeg',
    description: 'Art club room, creative space',
    storyTemplateId: 'afternoon_artroom',
    timeRange: [15, 18],
    tags: ['school', 'club', 'creative'],
    priority: 5,
  },
  {
    id: 'everyday_afternoon_playground',
    dayType: 'everyday',
    timePeriod: 'afternoon',
    location: 'playground',
    imagePath: 'everyday/afternoon/playground.jpeg',
    description: 'School playground after class',
    storyTemplateId: 'afternoon_playground',
    timeRange: [16, 18],
    tags: ['school', 'outdoor', 'sports'],
    priority: 6,
  },

  // Evening (18:00-20:00)
  {
    id: 'everyday_evening_commute',
    dayType: 'everyday',
    timePeriod: 'evening',
    location: 'commute',
    imagePath: 'everyday/evening/commute.jpeg',
    description: 'Evening commute back home, sunset',
    storyTemplateId: 'evening_commute',
    timeRange: [17, 19],
    tags: ['outdoor', 'transit', 'sunset'],
    priority: 9,
    weatherVariants: ['default', 'sunny', 'rainy', 'cloudy'],
  },
  {
    id: 'everyday_evening_livingroom',
    dayType: 'everyday',
    timePeriod: 'evening',
    location: 'livingroom',
    imagePath: 'everyday/evening/livingroom.jpeg',
    description: 'Cozy living room in the evening',
    storyTemplateId: 'evening_livingroom',
    timeRange: [18, 20],
    tags: ['home', 'cozy', 'family'],
    priority: 8,
  },
  {
    id: 'everyday_evening_bedroom',
    dayType: 'everyday',
    timePeriod: 'evening',
    location: 'bedroom',
    imagePath: 'everyday/evening/bedroom.jpeg',
    description: 'Evening bedroom, study or relax time',
    storyTemplateId: 'evening_bedroom',
    timeRange: [19, 21],
    tags: ['home', 'private', 'study'],
    priority: 10,
  },

  // Night (20:00-24:00)
  {
    id: 'everyday_night_bedroom',
    dayType: 'everyday',
    timePeriod: 'night',
    location: 'bedroom',
    imagePath: 'everyday/night/bedroom.jpeg',
    description: 'Bedroom at night, desk lamp on',
    storyTemplateId: 'night_bedroom',
    timeRange: [20, 24],
    tags: ['home', 'private', 'quiet'],
    priority: 10,
  },
  {
    id: 'everyday_night_balcony',
    dayType: 'everyday',
    timePeriod: 'night',
    location: 'balcony',
    imagePath: 'everyday/night/balcony.jpeg',
    description: 'Balcony at night, city lights view',
    storyTemplateId: 'night_balcony',
    timeRange: [20, 24],
    tags: ['home', 'outdoor', 'peaceful'],
    priority: 6,
  },

  // ========== Weekend Scenes ==========

  // Weekend Morning (6:00-10:00)
  {
    id: 'weekend_morning_bedroom',
    dayType: 'weekend',
    timePeriod: 'morning',
    location: 'bedroom',
    imagePath: 'everyday/morning/bedroom.jpeg', // Reuse everyday bedroom image
    description: 'Relaxing weekend morning in bedroom',
    storyTemplateId: 'weekend_morning',
    timeRange: [6, 10],
    tags: ['home', 'relax', 'weekend-morning'],
    priority: 10,
    weatherVariants: ['default', 'sunny', 'rainy', 'cloudy'],
  },

  // Weekend Day (7:00-19:00)
  {
    id: 'weekend_day_cafe',
    dayType: 'weekend',
    timePeriod: 'day',
    location: 'cafe',
    imagePath: 'weekend/day/cafe.jpeg',
    description: 'Cozy cafe during weekend',
    storyTemplateId: 'weekend_cafe',
    timeRange: [10, 18],
    tags: ['social', 'food', 'relax'],
    priority: 9,
    weatherVariants: ['default', 'sunny', 'rainy', 'cloudy'],
  },
  {
    id: 'weekend_day_park',
    dayType: 'weekend',
    timePeriod: 'day',
    location: 'park',
    imagePath: 'weekend/day/park.jpeg',
    description: 'Park on a weekend day',
    storyTemplateId: 'weekend_park',
    timeRange: [9, 17],
    tags: ['outdoor', 'nature', 'relax'],
    priority: 8,
    weatherVariants: ['default', 'sunny', 'cloudy'],
  },
  {
    id: 'weekend_day_street',
    dayType: 'weekend',
    timePeriod: 'day',
    location: 'street',
    imagePath: 'weekend/day/street.jpeg',
    description: 'City street on weekend',
    storyTemplateId: 'weekend_street_day',
    timeRange: [10, 19],
    tags: ['outdoor', 'urban', 'shopping'],
    priority: 7,
    weatherVariants: ['default', 'sunny', 'rainy', 'cloudy'],
  },

  // Weekend Night (19:00-24:00)
  {
    id: 'weekend_night_street',
    dayType: 'weekend',
    timePeriod: 'night',
    location: 'street',
    imagePath: 'weekend/night/street.jpeg',
    description: 'City street at night, vibrant lights',
    storyTemplateId: 'weekend_street_night',
    timeRange: [19, 23],
    tags: ['outdoor', 'urban', 'nightlife'],
    priority: 8,
  },
  {
    id: 'weekend_night_nightmarket',
    dayType: 'weekend',
    timePeriod: 'night',
    location: 'nightmarket',
    imagePath: 'weekend/night/nightmarket.jpeg',
    description: 'Night market, bustling atmosphere',
    storyTemplateId: 'weekend_nightmarket',
    timeRange: [18, 23],
    tags: ['outdoor', 'food', 'social', 'vibrant'],
    priority: 7,
  },

  // ========== Holiday Scenes ==========

  {
    id: 'holiday_ocean',
    dayType: 'holiday',
    timePeriod: 'day',
    location: 'ocean',
    imagePath: 'holiday/ocean.jpeg',
    description: 'Ocean beach during holiday',
    storyTemplateId: 'holiday_ocean',
    timeRange: [8, 18],
    tags: ['outdoor', 'nature', 'vacation', 'summer'],
    priority: 10,
    weatherVariants: ['default', 'sunny', 'cloudy'],
  },
  {
    id: 'holiday_street',
    dayType: 'holiday',
    timePeriod: 'day',
    location: 'street',
    imagePath: 'holiday/street.jpeg',
    description: 'Street exploration during holiday',
    storyTemplateId: 'holiday_street',
    timeRange: [9, 19],
    tags: ['outdoor', 'urban', 'vacation'],
    priority: 8,
    weatherVariants: ['default', 'sunny', 'rainy', 'cloudy'],
  },
];

// ==================== Story Templates ====================

export const STORY_TEMPLATES: Record<string, StoryTemplate> = {
  morning_bedroom: {
    id: 'morning_bedroom',
    templates: [
      '今天早上{time}醒来，躺在床上看着窗外的{weather_desc}。{mood_desc}想着今天{plan}，{current_activity}',
      '早安～刚才{time}起床的时候还有点困，不过看到{weather_desc}的天气就清醒了不少。现在{current_activity}，{mood_desc}',
    ],
    contexts: ['wake-up', 'morning-routine', 'weather-aware', 'planning-day'],
  },

  morning_commute: {
    id: 'morning_commute',
    templates: [
      '现在正在上学的路上，时间是{time}左右。{weather_desc}的天气{weather_feeling}。路上{scene_detail}，{mood_desc}',
      '走在上学的路上，{weather_desc}。{time}的街道{scene_detail}，{mood_desc}想着{thought}',
    ],
    contexts: ['commute', 'outdoor', 'weather-sensitive', 'observant'],
  },

  morning_classroom: {
    id: 'morning_classroom',
    templates: [
      '已经到教室了，现在是{time}。{activity_desc}，教室里{scene_detail}。{mood_desc}',
      '早自习时间～坐在教室里{activity_desc}。{time}的阳光透过窗户照进来，{mood_desc}',
    ],
    contexts: ['school', 'study', 'morning-class', 'focused'],
  },

  noon_cafeteria: {
    id: 'noon_cafeteria',
    templates: [
      '午餐时间到啦！现在在食堂{activity_desc}。今天{food_mention}，{mood_desc}',
      '{time}了，正在食堂吃午饭。{scene_detail}，{mood_desc}{plan}',
    ],
    contexts: ['lunch', 'social', 'food', 'energetic'],
  },

  afternoon_library: {
    id: 'afternoon_library',
    templates: [
      '下午来图书馆{activity_desc}。现在是{time}，图书馆里很安静，{mood_desc}',
      '在图书馆度过下午时光～{activity_desc}，{time}的阳光从窗外洒进来，{mood_desc}',
    ],
    contexts: ['study', 'quiet', 'focused', 'peaceful'],
  },

  evening_commute: {
    id: 'evening_commute',
    templates: [
      '放学啦～现在{time}左右，走在回家的路上。{weather_desc}，夕阳{sunset_desc}。{mood_desc}',
      '傍晚{time}的回家路，{weather_desc}。{scene_detail}，{mood_desc}{thought}',
    ],
    contexts: ['after-school', 'sunset', 'relaxed', 'reflective'],
  },

  night_bedroom: {
    id: 'night_bedroom',
    templates: [
      '晚上{time}了，{activity_desc}。关了大灯只留台灯，房间里{scene_detail}。{mood_desc}',
      '夜深了，现在{time}。{activity_desc}，窗外{scene_detail}。{mood_desc}想着{thought}',
    ],
    contexts: ['night', 'quiet', 'private', 'introspective'],
  },

  weekend_morning: {
    id: 'weekend_morning',
    templates: [
      '周末的早晨～{time}醒来，不用赶着上学真好呢。{activity_desc}，看着窗外{weather_desc}。{mood_desc}',
      '今天是周末，{time}慢慢醒来。{scene_detail}，{mood_desc}想着{plan}',
    ],
    contexts: ['weekend', 'morning', 'relaxed', 'leisure'],
  },

  weekend_cafe: {
    id: 'weekend_cafe',
    templates: [
      '周末来咖啡厅放松一下～点了{food_mention}，坐在靠窗的位置。{time}的咖啡厅{scene_detail}，{mood_desc}',
      '今天是周末，{time}在这家咖啡厅{activity_desc}。{mood_desc}享受着{food_mention}和{atmosphere}',
    ],
    contexts: ['weekend', 'leisure', 'cafe', 'relaxed'],
  },

  holiday_ocean: {
    id: 'holiday_ocean',
    templates: [
      '假期来海边啦！{weather_desc}，海风{scene_detail}。现在{time}，{activity_desc}。{mood_desc}',
      '在海边度假中～{time}的海滩{scene_detail}，{weather_desc}。{mood_desc}{plan}',
    ],
    contexts: ['vacation', 'beach', 'summer', 'excited'],
  },

  noon_classroom: {
    id: 'noon_classroom',
    templates: [
      '现在{time}，正在教室里上课。{activity_desc}，{scene_detail}。{mood_desc}',
      '上午的课程～{time}坐在教室里{activity_desc}。窗外{weather_desc}，{mood_desc}',
    ],
    contexts: ['school', 'class', 'study', 'focused'],
  },

  noon_rooftop: {
    id: 'noon_rooftop',
    templates: [
      '午休时间来天台了～{time}的天台{scene_detail}，{weather_desc}。{activity_desc}，{mood_desc}',
      '在学校天台度过午休时光。{time}的阳光{scene_detail}，{mood_desc}{thought}',
    ],
    contexts: ['school', 'outdoor', 'peaceful', 'lunch'],
  },

  afternoon_classroom: {
    id: 'afternoon_classroom',
    templates: [
      '下午{time}的课堂，{activity_desc}。教室里{scene_detail}，{mood_desc}',
      '下午上课中～现在{time}，{activity_desc}。{scene_detail}，{mood_desc}想着{plan}',
    ],
    contexts: ['school', 'class', 'study', 'afternoon'],
  },

  afternoon_artroom: {
    id: 'afternoon_artroom',
    templates: [
      '放学后来美术室了～{time}在社团活动中{activity_desc}。{scene_detail}，{mood_desc}',
      '社团活动时间！{time}的美术室{scene_detail}。{activity_desc}，{mood_desc}',
    ],
    contexts: ['school', 'club', 'creative', 'art'],
  },

  afternoon_playground: {
    id: 'afternoon_playground',
    templates: [
      '放学后的操场～{time}左右，{activity_desc}。{weather_desc}，{mood_desc}',
      '在操场上{activity_desc}，{time}的{weather_desc}。{scene_detail}，{mood_desc}',
    ],
    contexts: ['school', 'outdoor', 'sports', 'energetic'],
  },

  evening_livingroom: {
    id: 'evening_livingroom',
    templates: [
      '回到家了～{time}在客厅{activity_desc}。灯光{scene_detail}，{mood_desc}',
      '傍晚{time}的客厅，{activity_desc}。{scene_detail}，{mood_desc}{thought}',
    ],
    contexts: ['home', 'cozy', 'family', 'evening'],
  },

  evening_bedroom: {
    id: 'evening_bedroom',
    templates: [
      '晚上回到房间～{time}了，{activity_desc}。{scene_detail}，{mood_desc}',
      '傍晚{time}在房间里{activity_desc}。窗外{scene_detail}，{mood_desc}想着{plan}',
    ],
    contexts: ['home', 'private', 'study', 'evening'],
  },

  night_balcony: {
    id: 'night_balcony',
    templates: [
      '夜晚{time}来阳台透透气。{scene_detail}，城市的灯光很美。{mood_desc}',
      '在阳台上{activity_desc}，{time}的夜景{scene_detail}。{mood_desc}{thought}',
    ],
    contexts: ['home', 'outdoor', 'peaceful', 'night'],
  },

  weekend_park: {
    id: 'weekend_park',
    templates: [
      '周末去公园散步～{time}的公园{scene_detail}，{weather_desc}。{activity_desc}，{mood_desc}',
      '今天来公园放松一下。{time}的{weather_desc}，{activity_desc}。{mood_desc}{plan}',
    ],
    contexts: ['weekend', 'outdoor', 'nature', 'relaxed'],
  },

  weekend_street_day: {
    id: 'weekend_street_day',
    templates: [
      '周末出门逛街～{time}的街道{scene_detail}，{weather_desc}。{mood_desc}{plan}',
      '在街上{activity_desc}，现在{time}。{weather_desc}，{mood_desc}',
    ],
    contexts: ['weekend', 'outdoor', 'urban', 'shopping'],
  },

  weekend_street_night: {
    id: 'weekend_street_night',
    templates: [
      '周末晚上出来走走～{time}的街道灯火通明，{scene_detail}。{mood_desc}',
      '夜晚的街道很热闹，现在{time}。{activity_desc}，{mood_desc}{thought}',
    ],
    contexts: ['weekend', 'outdoor', 'urban', 'nightlife'],
  },

  weekend_nightmarket: {
    id: 'weekend_nightmarket',
    templates: [
      '来夜市啦！{time}的夜市{scene_detail}，到处都是{food_mention}的香味。{mood_desc}',
      '周末逛夜市～{time}的夜市很热闹，{activity_desc}。{mood_desc}{plan}',
    ],
    contexts: ['weekend', 'outdoor', 'food', 'vibrant'],
  },

  holiday_street: {
    id: 'holiday_street',
    templates: [
      '假期出来探索新地方～{time}在陌生的街道{activity_desc}。{weather_desc}，{mood_desc}',
      '假期旅行中！{time}的街道{scene_detail}。{activity_desc}，{mood_desc}{plan}',
    ],
    contexts: ['vacation', 'outdoor', 'urban', 'exploration'],
  },
};

// ==================== Weather Descriptors ====================

export const WEATHER_DESCRIPTORS: Record<WeatherType, {
  desc: string;
  feeling: string;
  atmospheres: string[];
}> = {
  default: {
    desc: '天气还不错',
    feeling: '挺舒服的',
    atmospheres: ['舒适', '平静', '自然'],
  },
  sunny: {
    desc: '阳光明媚',
    feeling: '心情也跟着明朗起来',
    atmospheres: ['温暖', '明亮', '充满活力'],
  },
  rainy: {
    desc: '淅淅沥沥下着小雨',
    feeling: '有种安静的感觉',
    atmospheres: ['柔和', '宁静', '浪漫'],
  },
  cloudy: {
    desc: '天空有些阴',
    feeling: '凉凉的',
    atmospheres: ['柔和', '沉静', '舒适'],
  },
  snowy: {
    desc: '飘着雪花',
    feeling: '有点冷但很美',
    atmospheres: ['纯净', '安静', '梦幻'],
  },
};

// ==================== Helper Functions ====================

/**
 * Get appropriate scene based on current time and context
 * Uses a fallback strategy to ensure a scene is always found
 */
export function getSceneForContext(
  dayType: DayType,
  currentHour: number,
  weather?: WeatherType
): SceneMetadata | null {
  // Strategy 1: Try exact match (dayType + timeRange + weather)
  let candidates = SCENE_CONFIG.filter(scene => scene.dayType === dayType);

  // Filter by time range
  const timeCandidates = candidates.filter(scene => {
    if (!scene.timeRange) return true;
    const [start, end] = scene.timeRange;
    return currentHour >= start && currentHour < end;
  });

  // Try with weather filtering first
  let finalCandidates = timeCandidates;
  if (weather && weather !== 'default' && timeCandidates.length > 0) {
    const weatherAware = timeCandidates.filter(
      scene => scene.weatherVariants?.includes(weather)
    );
    if (weatherAware.length > 0) {
      finalCandidates = weatherAware;
    }
  }

  // Strategy 2: If no time-matched scenes, use any scene for this dayType
  if (finalCandidates.length === 0 && candidates.length > 0) {
    console.warn(`[BackgroundContext] No scenes found for ${dayType} at hour ${currentHour}, using fallback`);
    finalCandidates = candidates;
  }

  // Strategy 3: If still no scenes, use any scene from config
  if (finalCandidates.length === 0) {
    console.warn(`[BackgroundContext] No scenes found for ${dayType}, using any available scene`);
    finalCandidates = SCENE_CONFIG;
  }

  // Sort by priority and pick highest
  finalCandidates.sort((a, b) => (b.priority || 0) - (a.priority || 0));

  // Add some randomness among top candidates
  const topPriority = finalCandidates[0].priority || 0;
  const topCandidates = finalCandidates.filter(
    scene => (scene.priority || 0) === topPriority
  );

  return topCandidates[Math.floor(Math.random() * topCandidates.length)];
}

/**
 * Get image path with weather variant
 * Only uses weather variant if the scene explicitly supports it
 */
export function getSceneImagePath(
  scene: SceneMetadata,
  weather?: WeatherType
): string {
  const basePath = scene.imagePath;

  // Only use weather variant if:
  // 1. Weather is specified and not default
  // 2. Scene explicitly supports this weather variant
  if (weather && weather !== 'default' && scene.weatherVariants?.includes(weather)) {
    // Try to use weather variant (e.g., bedroom_rainy.jpeg)
    const parts = basePath.split('.');
    const ext = parts.pop();
    const pathWithoutExt = parts.join('.');
    const weatherPath = `${pathWithoutExt}_${weather}.${ext}`;

    console.log(`[BackgroundContext] Using weather variant: ${weatherPath}`);
    return weatherPath;
  }

  // Fallback to base path (no weather variant)
  if (weather && weather !== 'default' && !scene.weatherVariants?.includes(weather)) {
    console.log(`[BackgroundContext] Scene ${scene.id} doesn't support weather '${weather}', using default image`);
  }

  return basePath;
}

/**
 * Determine day type based on date
 */
export function getDayType(date: Date): DayType {
  const day = date.getDay();
  const month = date.getMonth();

  // Check for holidays (simplified - you can expand this)
  // Summer holiday (July-August)
  if (month === 6 || month === 7) {
    return 'holiday';
  }

  // Weekend
  if (day === 0 || day === 6) {
    return 'weekend';
  }

  return 'everyday';
}

/**
 * Get all scenes by tag
 */
export function getScenesByTag(tag: string): SceneMetadata[] {
  return SCENE_CONFIG.filter(scene => scene.tags?.includes(tag));
}

/**
 * Get scene by ID
 */
export function getSceneById(id: string): SceneMetadata | undefined {
  return SCENE_CONFIG.find(scene => scene.id === id);
}
