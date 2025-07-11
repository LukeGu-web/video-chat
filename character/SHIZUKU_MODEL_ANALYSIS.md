# Shizuku Live2D Model Analysis

## Overview
This document provides a comprehensive analysis of the Shizuku Live2D model located in `public/assets/live2d/shizuku/runtime/`. The model is built using Live2D Cubism 4 technology and offers rich interaction capabilities with detailed animations and expressions.

## File Structure

```
public/assets/live2d/shizuku/runtime/
├── shizuku.model3.json          # Main model configuration
├── shizuku.moc3                 # Model binary data
├── shizuku.physics3.json        # Physics configuration
├── shizuku.pose3.json           # Pose configuration
├── shizuku.cdi3.json            # Display information
├── motion/                      # Animation files
│   ├── 01.motion3.json         # FlickUp animation
│   ├── 02.motion3.json         # Tap animation
│   ├── 03.motion3.json         # Flick3 animation
│   └── 04.motion3.json         # Idle animation
└── shizuku.1024/               # Textures (1024x1024)
    ├── texture_00.png
    ├── texture_01.png
    ├── texture_02.png
    ├── texture_03.png
    └── texture_04.png
```

## Available Motions

### 1. FlickUp Motion (`01.motion3.json`)
- **Duration**: 1.27 seconds (30 FPS)
- **Type**: Looping animation
- **Trigger**: Upward flick gesture
- **Animation Features**:
  - Head movement with angle changes (X: 0→1→-1, Y: 0→15→-29)
  - Surprised eye animation (opens to 1.6, then closes to -0.83)
  - Eyebrow movements showing surprise/concern
  - Mouth opens with vocalization (up to 1.71)
  - Arm movements with opacity changes
  - Body position shifts upward

### 2. Tap Motion (`02.motion3.json`)
- **Duration**: 1.27 seconds (30 FPS)
- **Type**: Looping animation
- **Trigger**: Tap/touch interaction
- **Animation Features**:
  - Gentle head tilting (X: 0→1, Y: 0→15→-5)
  - Blinking animation with sparkling eyes
  - Raised eyebrows showing happiness/surprise
  - Cheerful mouth opening (up to 2.0)
  - Blush effect (PARAM_TERE: 0.5→0.96)
  - Dynamic hair physics
  - Left arm waving motion with hand gestures

### 3. Flick3 Motion (`03.motion3.json`)
- **Duration**: 1.5 seconds (30 FPS)
- **Type**: Looping animation
- **Trigger**: Specific flick gesture
- **Animation Features**:
  - Dramatic head rotation (X: 0→-31→30, Y: 0→-3→-8, Z: 0→-11→0)
  - Shy/embarrassed expression with blush
  - Eye closing and opening sequence
  - Mouth form changes indicating emotion
  - Strong eyebrow expressions
  - Complex arm movements

### 4. Idle Motion (`04.motion3.json`)
- **Duration**: 1.57 seconds (30 FPS)
- **Type**: Looping animation
- **Trigger**: Default state
- **Animation Features**:
  - Subtle head movements
  - Natural breathing pattern
  - Gentle eye movements and blinking
  - Quiet breathing/talking mouth animation
  - Arm repositioning
  - Natural resting pose

## Controllable Parameters (42 Total)

### Facial Control
- **Eyes**: 
  - `PARAM_EYE_L_OPEN`, `PARAM_EYE_R_OPEN` - Eye opening
  - `PARAM_EYE_BALL_X`, `PARAM_EYE_BALL_Y` - Eye direction
  - `PARAM_EYE_SPARKLE` - Eye sparkle effect
  - `PARAM_EYE_TRANSFORM` - Eye transformation
- **Eyebrows**:
  - `PARAM_BROW_L_X`, `PARAM_BROW_R_X` - Horizontal position
  - `PARAM_BROW_L_Y`, `PARAM_BROW_R_Y` - Vertical position
  - `PARAM_BROW_L_ANGLE`, `PARAM_BROW_R_ANGLE` - Angle
  - `PARAM_BROW_L_FORM`, `PARAM_BROW_R_FORM` - Shape
- **Mouth**:
  - `PARAM_MOUTH_OPEN_Y` - Opening/closing
  - `PARAM_MOUTH_FORM` - Shape changes
  - `PARAM_MOUTH_SIZE` - Size scaling

### Body Movement
- **Head**: 
  - `PARAM_ANGLE_X`, `PARAM_ANGLE_Y`, `PARAM_ANGLE_Z` - 3-axis rotation
- **Body**: 
  - `PARAM_BODY_ANGLE_X`, `PARAM_BODY_ANGLE_Y`, `PARAM_BODY_ANGLE_Z` - 3-axis rotation
  - `PARAM_BODY_X`, `PARAM_BODY_Y` - Position
- **Arms**: 
  - Left/Right arm with multiple segments
  - Hand positions and gestures
- **Breathing**: 
  - `PARAM_BREATH` - Natural breathing animation

### Hair Physics
- **Front Hair**: `PARAM_KAMIYURE_FRONT`
- **Back Hair**: `PARAM_KAMIYURE_BACK`
- **Side Hair**: `PARAM_KAMIYURE_L`, `PARAM_KAMIYURE_R`
- **Twin-tails**: `PARAM_KAMIYURE_TWIN_L`, `PARAM_KAMIYURE_TWIN_R`

### Expression Effects
- **Blush**: `PARAM_TERE` - Blush/embarrassment effect
- **Tired**: `PARAM_DONYORI` - Tired/sleepy look

## Physics System

### Front Hair Physics (前髪揺れ)
- Responds to head X-axis and Z-axis movements
- Gravity and wind effects with realistic hair bounce
- Natural pendulum motion

### Side Hair Physics (横髪揺れ)
- Bilateral hair movement simulation
- Controlled by head rotation
- Independent left/right physics

### Twin-tail Physics (ツインテ揺れ)
- Separate physics for left and right twin-tails
- Realistic pendulum motion with momentum
- Responds to body and head movements

## Expression Capabilities

### Automatic Expressions
- **EyeBlink**: Automatic blinking using `PARAM_EYE_L_OPEN` and `PARAM_EYE_R_OPEN`
- **LipSync**: Mouth synchronization using `PARAM_MOUTH_OPEN_Y`

### Manual Expression Control
- **Happy/Excited**: Wide eyes, raised eyebrows, open mouth, blush
- **Surprised/Shocked**: Very wide eyes, raised eyebrows, open mouth
- **Shy/Embarrassed**: Blush effect, downward gaze, small mouth
- **Tired/Sleepy**: Droopy eyes, relaxed eyebrows
- **Neutral/Idle**: Gentle breathing, natural blinking

## Implementation Examples

### Basic Motion Playback
```javascript
// Play different motions
model.motion('Idle');     // Default idle animation
model.motion('Tap');      // Happy tap response
model.motion('FlickUp');  // Surprised upward flick
model.motion('Flick3');   // Shy/embarrassed response
```

### Parameter Control
```javascript
// Control facial expressions
model.internalModel.coreModel.setParameterValueById('PARAM_EYE_BALL_X', 0.5);
model.internalModel.coreModel.setParameterValueById('PARAM_EYE_BALL_Y', -0.5);
model.internalModel.coreModel.setParameterValueById('PARAM_TERE', 1.0); // Blush
```

### Interactive Features
```javascript
// Handle user interactions
model.on('hit', (hitAreas) => {
    if (hitAreas.length > 0) {
        // Randomly select a motion for interaction
        const motions = ['Tap', 'FlickUp', 'Flick3'];
        const randomMotion = motions[Math.floor(Math.random() * motions.length)];
        model.motion(randomMotion);
    }
});
```

## Technical Specifications

- **Live2D Version**: 3 (Cubism 4 compatible)
- **Total Parameters**: 42 controllable parameters
- **Physics Systems**: 3 separate physics configurations
- **Pose Groups**: 2 groups for arm layer management
- **Texture Resolution**: 1024x1024 pixels (5 textures)
- **Animation Frame Rate**: 30 FPS
- **Model Complexity**: Professional-grade with detailed expressions

## Usage Recommendations

### Best Practices
1. **Idle Animation**: Always ensure the Idle motion is playing when no interaction occurs
2. **Motion Transitions**: Allow motions to complete before starting new ones
3. **Parameter Smoothing**: Use gradual parameter changes for natural expressions
4. **Physics Timing**: Let physics settle between rapid interactions

### Performance Considerations
- Model uses 5 high-resolution textures - consider texture compression for web deployment
- Physics calculations are CPU-intensive - monitor performance on lower-end devices
- 42 parameters allow for detailed control but require careful memory management

### Interaction Design
- **Tap**: Use for positive, cheerful interactions
- **FlickUp**: Use for surprise or attention-getting moments
- **Flick3**: Use for shy or embarrassed character responses
- **Custom Parameters**: Implement gaze tracking, lip sync, or custom expressions

## Future Enhancement Possibilities

1. **Custom Hit Areas**: Define clickable regions for different body parts
2. **Voice Integration**: Implement lip sync with audio playback
3. **Gesture Recognition**: Add more sophisticated gesture detection
4. **Emotion System**: Create dynamic emotion states based on interaction history
5. **Costume System**: Implement texture swapping for different outfits
6. **Background Integration**: Add environmental effects that influence physics

---

*This analysis is based on the Live2D Cubism 4 model files and provides a foundation for implementing rich, interactive character experiences with the Shizuku model.*