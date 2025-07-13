# Hiyori VTS Live2D Model Documentation

## Model Overview
- **Model Name**: Hiyori_A
- **Model ID**: ce88a9c13e0e4adeb3b2282c0842f12f
- **VTube Studio Version**: 1.32.3
- **Last Updated**: July 13, 2025

## File Structure
```
hiyori_vts/
├── hiyori.model3.json          # Core Live2D model definition
├── hiyori.vtube.json           # VTube Studio configuration
├── hiyori.moc3                 # Compiled Live2D model
├── hiyori.physics3.json        # Physics simulation settings
├── hiyori.cdi3.json           # Display information
├── animations/                 # Motion files directory
│   ├── hiyori_m01.motion3.json # Animation 1 (5.07s loop)
│   ├── hiyori_m02.motion3.json # Animation 2 (idle)
│   ├── hiyori_m03.motion3.json # Animation 3 (4.57s loop)
│   ├── hiyori_m04.motion3.json # Animation 4
│   ├── hiyori_m05.motion3.json # Animation 5
│   ├── hiyori_m06.motion3.json # Animation 6
│   ├── hiyori_m07.motion3.json # Animation 7
│   ├── hiyori_m08.motion3.json # Animation 8
│   ├── hiyori_m09.motion3.json # Animation 9
│   └── hiyori_m10.motion3.json # Animation 10
├── hiyori.2048/               # Texture assets
│   ├── texture_00.png         # Main texture
│   └── texture_01.png         # Secondary texture
├── icon.jpg                   # Model thumbnail
└── items_pinned_to_model.json # Pinned items configuration
```

## Supported Parameters

### Face Controls
| Parameter | Description | Range | VTS Input |
|-----------|-------------|-------|-----------|
| `ParamAngleX` | Face Left/Right Rotation | -30° to 30° | FaceAngleX |
| `ParamAngleY` | Face Up/Down Rotation | -30° to 30° | FaceAngleY |
| `ParamAngleZ` | Face Lean Rotation | -30° to 30° | FaceAngleZ |

### Eye Controls
| Parameter | Description | Range | VTS Input |
|-----------|-------------|-------|-----------|
| `ParamEyeLOpen` | Left Eye Open | 0 to 1.9 | EyeOpenLeft |
| `ParamEyeROpen` | Right Eye Open | 0 to 1.9 | EyeOpenRight |
| `ParamEyeBallX` | Eye X Position | -1 to 1 | EyeRightX |
| `ParamEyeBallY` | Eye Y Position | -1 to 1 | EyeRightY |
| `ParamEyeLSmile` | Left Eye Smile | 0 to 1 | MouthSmile |
| `ParamEyeRSmile` | Right Eye Smile | 0 to 1 | MouthSmile |

### Eyebrow Controls
| Parameter | Description | Range | VTS Input |
|-----------|-------------|-------|-----------|
| `ParamBrowLY` | Left Brow Height | -1 to 1 | BrowLeftY |
| `ParamBrowRY` | Right Brow Height | -1 to 1 | BrowRightY |
| `ParamBrowLForm` | Left Brow Form | -1 to 1 | BrowLeftY |
| `ParamBrowRForm` | Right Brow Form | -1 to 1 | BrowRightY |

### Mouth Controls
| Parameter | Description | Range | VTS Input |
|-----------|-------------|-------|-----------|
| `ParamMouthForm` | Mouth Smile | -1 to 1 | MouthSmile |
| `ParamMouthOpenY` | Mouth Open | 0 to 2.3 | MouthOpen |
| `ParamMouthX` | Mouth Position X | -1 to 1 | MouthX |
| `ParamCheek` | Blush Effect | 0.5 to 1 | MouthSmile |

### Body Controls
| Parameter | Description | Range | VTS Input |
|-----------|-------------|-------|-----------|
| `ParamBodyAngleX` | Body Rotation X | -10° to 10° | FaceAngleX |
| `ParamBodyAngleY` | Body Rotation Y | -10° to 10° | FaceAngleY |
| `ParamBodyAngleZ` | Body Rotation Z | -10° to 10° | FaceAngleZ |
| `ParamStep` | Step Left/Right | -10° to 10° | FaceAngleX |

### Arm Controls
| Parameter | Description | Default |
|-----------|-------------|---------|
| `ParamArmLA` | Left Arm Angle | -10° |
| `ParamArmRA` | Right Arm Angle | -10° |
| `ParamShoulder` | Shoulder Movement | Variable |

### Hair Physics
| Parameter | Description |
|-----------|-------------|
| `ParamHairAhoge` | Hair Ahoge Movement |
| `ParamHairFront` | Front Hair Physics |
| `ParamHairBack` | Back Hair Physics |

## Available Animations

### Motion Files (10 total)
1. **hiyori_m01.motion3.json** - Duration: 5.07s, Loop: Yes, 30 FPS
2. **hiyori_m02.motion3.json** - Idle Animation (Default)
3. **hiyori_m03.motion3.json** - Duration: 4.57s, Loop: Yes, 30 FPS
4. **hiyori_m04.motion3.json** - Animation 4
5. **hiyori_m05.motion3.json** - Animation 5
6. **hiyori_m06.motion3.json** - Animation 6
7. **hiyori_m07.motion3.json** - Animation 7
8. **hiyori_m08.motion3.json** - Animation 8
9. **hiyori_m09.motion3.json** - Animation 9
10. **hiyori_m10.motion3.json** - Animation 10

### Animation Features
- All animations support parameter interpolation with Bezier curves
- Motion includes eye blinks, breathing, and facial expressions
- Body and hair movement synchronized with face rotations
- Complex arm and shoulder animations
- Eye tracking and lip sync compatibility

## VTube Studio Hotkeys
| Key | Animation | File |
|-----|-----------|------|
| N1 | My Animation 1 | hiyori_m03.motion3.json |
| N2 | My Animation 2 | hiyori_m06.motion3.json |
| N3 | My Animation 3 | hiyori_m10.motion3.json |

## Physics System
The model includes 11 physics settings for realistic movement:

1. **Hair Front** - Front hair strands
2. **Back Hair** - Long back hair physics
3. **Hair Ribbon** - Hair accessory movement
4. **Move Skirt X** - Horizontal skirt movement
5. **Move Skirt Y** - Vertical skirt movement
6. **Body Ribbon** - Body accessory physics
7. **Bust** - Chest area physics
8. **Hair Side Up R** - Right side hair (upper)
9. **Hair Side Up L** - Left side hair (upper)
10. **Hair Side R** - Right side hair
11. **Hair Side L** - Left side hair

### Physics Inputs
- Face angle X/Y/Z rotations
- Body angle movements
- Gravity and wind effects
- Customizable strength and smoothing

## Facial Tracking Compatibility

### Supported Inputs
- **Face Rotation**: All three axes (X, Y, Z)
- **Eye Tracking**: Full eye movement and blinking
- **Mouth Tracking**: Opening and smile detection
- **Eyebrow Movement**: Height and form changes

### Special Features
- Automatic blush when smiling
- Eye smile synchronization with mouth
- Body follows face rotation with reduced intensity
- Stepping animation based on head movement

## Usage in Applications

### Live2D Cubism SDK
```javascript
// Load model
const model = await Live2DModel.from('/assets/live2d/hiyori_vts/hiyori.model3.json');

// Control parameters
model.setParameterValue('ParamAngleX', angleX);
model.setParameterValue('ParamEyeLOpen', eyeOpen);

// Play animation
model.startRandomMotion('idle');
```

### VTube Studio Integration
1. Copy entire `hiyori_vts` folder to VTube Studio models directory
2. Select model in VTube Studio
3. Configure face tracking parameters
4. Use hotkeys N1, N2, N3 for animations

## Technical Specifications
- **Live2D Version**: 3
- **Texture Resolution**: 2048x2048 (2 textures)
- **Physics Vertices**: 58 total
- **Animation Curves**: 30+ per motion
- **Parameter Count**: 20+ controllable parameters
- **File Size**: ~15MB total

## Recommended Settings
- **Physics Strength**: 50%
- **Wind Strength**: 0%
- **Smoothing**: 15-20 for most parameters
- **FPS**: 30-60 for optimal performance