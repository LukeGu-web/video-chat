# Background Scene Management Guide

## 📖 Overview

This guide explains how to manage background scenes in the EmoMate app using the configuration-driven system.

## 🗂️ File Structure

```
EmoMate/
├── assets/background/          # Image files
│   ├── everyday/
│   │   ├── morning/           # Morning scenes (6:00-9:00)
│   │   ├── noon/              # Noon scenes (9:00-14:00)
│   │   ├── afternoon/         # Afternoon scenes (14:00-18:00)
│   │   ├── evening/           # Evening scenes (18:00-20:00)
│   │   └── night/             # Night scenes (20:00-24:00)
│   ├── weekend/
│   │   ├── day/               # Weekend day scenes
│   │   └── night/             # Weekend night scenes
│   └── holiday/               # Holiday scenes
└── src/config/
    ├── backgroundScenes.ts     # Main configuration file
    └── BACKGROUND_SCENES_GUIDE.md  # This file
```

## ✅ How to Add a New Scene

### Step 1: Add the Image File

Place your image in the appropriate folder:

```
EmoMate/assets/background/[dayType]/[timePeriod]/[location].jpeg
```

**Example:**
```
EmoMate/assets/background/everyday/afternoon/musicroom.jpeg
```

### Step 2: Add Configuration Entry

Open `src/config/backgroundScenes.ts` and add a new entry to `SCENE_CONFIG`:

```typescript
{
  id: 'everyday_afternoon_musicroom',          // Unique ID
  dayType: 'everyday',                         // 'everyday' | 'weekend' | 'holiday'
  timePeriod: 'afternoon',                     // Time period
  location: 'musicroom',                       // Location name
  imagePath: 'everyday/afternoon/musicroom.jpeg',  // Path from assets/background/
  description: 'Music club room in the afternoon', // Description
  storyTemplateId: 'afternoon_musicroom',      // (Optional) Story template ID
  timeRange: [15, 18],                         // Hour range [start, end]
  tags: ['school', 'club', 'music'],           // Tags for filtering
  priority: 7,                                 // Selection priority (1-10)
  weatherVariants: ['default', 'rainy'],       // (Optional) Supported weather
},
```

### Step 3: (Optional) Add Story Template

If you want custom story templates for this scene, add to `STORY_TEMPLATES`:

```typescript
afternoon_musicroom: {
  id: 'afternoon_musicroom',
  templates: [
    '下午来音乐教室{activity_desc}。{time}的音乐室{scene_detail}，{mood_desc}',
    '在音乐教室度过下午～{activity_desc}，{mood_desc}',
  ],
  contexts: ['music', 'club', 'creative', 'afternoon'],
},
```

## 🌤️ How to Add Weather Variants

### Method 1: Add Weather-Specific Images

Create variant images with weather suffixes:

```
EmoMate/assets/background/everyday/morning/bedroom.jpeg        # Default
EmoMate/assets/background/everyday/morning/bedroom_sunny.jpeg  # Sunny variant
EmoMate/assets/background/everyday/morning/bedroom_rainy.jpeg  # Rainy variant
EmoMate/assets/background/everyday/morning/bedroom_cloudy.jpeg # Cloudy variant
```

### Method 2: Update Scene Configuration

Add `weatherVariants` to the scene:

```typescript
{
  id: 'everyday_morning_bedroom',
  // ... other fields
  weatherVariants: ['default', 'sunny', 'rainy', 'cloudy'],
}
```

### Supported Weather Types

- `default` - Normal weather (always available)
- `sunny` - Clear sunny day
- `rainy` - Rainy/wet conditions
- `cloudy` - Overcast/cloudy
- `snowy` - Snow (for winter scenes)

## 🎨 Scene Metadata Fields

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (format: `{dayType}_{timePeriod}_{location}`) |
| `dayType` | DayType | Scene category: `'everyday'` \| `'weekend'` \| `'holiday'` |
| `timePeriod` | TimePeriod | Time of day: `'morning'` \| `'noon'` \| `'afternoon'` \| `'evening'` \| `'night'` \| `'day'` |
| `location` | string | Location name (e.g., 'bedroom', 'cafe', 'park') |
| `imagePath` | string | Relative path from `assets/background/` |
| `description` | string | Human-readable description |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `storyTemplateId` | string | Reference to story template in `STORY_TEMPLATES` |
| `tags` | string[] | Tags for filtering (e.g., ['school', 'outdoor']) |
| `timeRange` | [number, number] | Hour range for auto-selection (24-hour format) |
| `weatherVariants` | WeatherType[] | Supported weather variants |
| `priority` | number | Selection priority (1-10, higher = more likely) |

## 🔧 Helper Functions

### Get Scene for Current Context

```typescript
import { getSceneForContext, getDayType } from '@/config/backgroundScenes';

const now = new Date();
const dayType = getDayType(now);
const currentHour = now.getHours();
const weather = 'sunny'; // Get from weather API

const scene = getSceneForContext(dayType, currentHour, weather);
```

### Get Image Path with Weather

```typescript
import { getSceneImagePath } from '@/config/backgroundScenes';

const imagePath = getSceneImagePath(scene, 'rainy');
// Returns: 'everyday/morning/bedroom_rainy.jpeg' if available
```

### Get Scenes by Tag

```typescript
import { getScenesByTag } from '@/config/backgroundScenes';

const schoolScenes = getScenesByTag('school');
const outdoorScenes = getScenesByTag('outdoor');
```

## 📝 Story Template Variables

Story templates support these placeholders:

| Variable | Description | Example |
|----------|-------------|---------|
| `{time}` | Current time | "8点半", "下午3点" |
| `{weather_desc}` | Weather description | "阳光明媚", "淅淅沥沥下着小雨" |
| `{weather_feeling}` | Weather feeling | "心情也跟着明朗起来" |
| `{mood_desc}` | Mood description | "感觉很平静", "有点兴奋" |
| `{activity_desc}` | Current activity | "正在看书", "听着音乐" |
| `{scene_detail}` | Scene detail | "窗外的樱花在微风中摇曳" |
| `{plan}` | Future plan | "下午要去图书馆" |
| `{thought}` | Current thought | "明天的考试" |
| `{food_mention}` | Food reference | "点了一杯拿铁" |
| `{atmosphere}` | Atmosphere | "安静的氛围" |
| `{sunset_desc}` | Sunset description | "西下的夕阳很美" |

## 🎯 Priority System

Priority determines likelihood of scene selection when multiple scenes match:

- **10** - Primary scene (most likely)
- **8-9** - Common scenes
- **6-7** - Secondary options
- **1-5** - Rare/special scenes

Example:
```typescript
// When it's 8:00 AM on a weekday, both scenes match:
{
  id: 'everyday_morning_bedroom',
  priority: 10,  // ← Selected (higher priority)
  timeRange: [6, 8],
}
{
  id: 'everyday_morning_classroom',
  priority: 7,
  timeRange: [8, 9],
}
```

## 🏷️ Common Tags

Use these standard tags for consistency:

**Location Types:**
- `home`, `school`, `outdoor`, `urban`, `nature`

**Activity Types:**
- `study`, `social`, `relax`, `sports`, `creative`

**Atmosphere:**
- `quiet`, `peaceful`, `vibrant`, `cozy`

**Features:**
- `private`, `food`, `transit`, `vacation`

**Weather:**
- `weather-aware`, `weather-sensitive`

## 🚀 Best Practices

### 1. Naming Convention

Use consistent ID format:
```
{dayType}_{timePeriod}_{location}
```

Examples:
- ✅ `everyday_morning_bedroom`
- ✅ `weekend_day_cafe`
- ❌ `bedroom_morning` (wrong order)
- ❌ `weekendCafe` (missing underscore)

### 2. Time Ranges

Use realistic time ranges:
```typescript
// ✅ Good
timeRange: [6, 8]    // Morning bedroom
timeRange: [12, 14]  // Lunch cafeteria

// ❌ Avoid
timeRange: [6, 18]   // Too broad
timeRange: [13, 13]  // Too narrow
```

### 3. Priority Assignment

- Set higher priority for "default" scenes
- Lower priority for specialized/rare scenes
- Ensure at least one high-priority scene per time period

### 4. Weather Variants

Only add weather variants when they enhance the experience:
```typescript
// ✅ Good - outdoor scene benefits from weather
{
  location: 'park',
  weatherVariants: ['default', 'sunny', 'rainy', 'cloudy'],
}

// ⚠️ Optional - indoor scene less affected
{
  location: 'classroom',
  weatherVariants: ['default'], // Weather doesn't matter much
}
```

## 📊 Example: Complete Scene Setup

Let's add a new "study cafe" scene for weekend afternoons:

### 1. Add Image
```
EmoMate/assets/background/weekend/day/studycafe.jpeg
EmoMate/assets/background/weekend/day/studycafe_rainy.jpeg  (optional)
```

### 2. Add Configuration
```typescript
// In SCENE_CONFIG array:
{
  id: 'weekend_day_studycafe',
  dayType: 'weekend',
  timePeriod: 'day',
  location: 'studycafe',
  imagePath: 'weekend/day/studycafe.jpeg',
  description: 'Study cafe on weekend afternoon',
  storyTemplateId: 'weekend_studycafe',
  timeRange: [13, 18],
  tags: ['study', 'social', 'cafe', 'relax'],
  priority: 8,
  weatherVariants: ['default', 'rainy'],
},
```

### 3. Add Story Template
```typescript
// In STORY_TEMPLATES object:
weekend_studycafe: {
  id: 'weekend_studycafe',
  templates: [
    '周末下午在学习咖啡厅{activity_desc}。{time}的咖啡厅{scene_detail}，{mood_desc}',
    '找了家安静的咖啡厅学习，{activity_desc}。{mood_desc}享受着{food_mention}',
  ],
  contexts: ['weekend', 'study', 'cafe', 'productive'],
},
```

### 4. Done! ✅

The scene will now be automatically selected when:
- Day type is weekend
- Current hour is between 13:00-18:00
- No higher priority scene exists

## 🔍 Debugging

### Check Scene Selection

Add logging to see which scene is selected:

```typescript
const scene = getSceneForContext(dayType, currentHour, weather);
console.log('Selected scene:', scene?.id, 'priority:', scene?.priority);
```

### List All Scenes for Time

```typescript
const now = new Date();
const hour = now.getHours();
const matching = SCENE_CONFIG.filter(s => {
  const [start, end] = s.timeRange || [0, 24];
  return hour >= start && hour < end;
});
console.log('Matching scenes:', matching.map(s => s.id));
```

## 📚 Related Files

- **Configuration**: `src/config/backgroundScenes.ts`
- **Usage Example**: (To be created in story generation system)
- **Assets**: `assets/background/`
- **Types**: Defined in `backgroundScenes.ts`

## 🎉 Quick Checklist for Adding Scenes

- [ ] Add image file(s) to `assets/background/`
- [ ] Add entry to `SCENE_CONFIG` in `backgroundScenes.ts`
- [ ] Set appropriate `timeRange` and `priority`
- [ ] Add relevant `tags` for filtering
- [ ] (Optional) Create weather variants
- [ ] (Optional) Add story template to `STORY_TEMPLATES`
- [ ] Test scene selection with `getSceneForContext()`
- [ ] Verify image loads correctly in app

---

**Need Help?** Check the existing scenes in `backgroundScenes.ts` for examples!
