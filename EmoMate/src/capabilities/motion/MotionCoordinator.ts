import { EmotionType } from '../../types/emotion';
import { VRMCommand } from '../../types/vrm';

// ─── Emotion → preset name ────────────────────────────────────────────────────

const EMOTION_PRESET: Record<string, string> = {
  joy:         'happy',
  laugh:       'laugh',
  surprise:    'surprised',
  shy:         'shy',
  sad:         'sleepy',
  sadness:     'sleepy',
  excited:     'excited',
  anticipation:'excited',
  thinking:    'thinking',
  trust:       'happy',
  fear:        'shy',
  anger:       'surprised',
  disgust:     'thinking',
  neutral:     'idle',
};

// ─── Emotion → blendShapes ────────────────────────────────────────────────────

const EMOTION_BLEND: Record<string, Record<string, number>> = {
  joy:         { joy: 0.8 },
  laugh:       { joy: 0.6 },
  surprise:    { surprised: 0.9 },
  shy:         { joy: 0.3 },
  sad:         { sorrow: 0.7 },
  sadness:     { sorrow: 0.7 },
  excited:     { joy: 0.8 },
  anticipation:{ fun: 0.5 },
  trust:       { joy: 0.4, fun: 0.3 },
  fear:        { surprised: 0.5, sorrow: 0.3 },
  anger:       { angry: 0.6 },
};

// ─── Preset durations (ms) ────────────────────────────────────────────────────

const PRESET_DURATION: Record<string, number> = {
  wave:      3000,
  dance:     5000,
  laugh:     3000,
  excited:   3000,
  surprised: 2000,
  thinking:  3000,
  happy:     4000,
  shy:       3000,
  sleepy:    5000,
};

// ─── State ────────────────────────────────────────────────────────────────────

type CoordState =
  | 'Idle'
  | 'Thinking'
  | 'TTS_Speaking'
  | 'TTS_Laughing'
  | { tag: 'TTS_Emotion';    emotion: string }
  | { tag: 'PostTTS_Emotion'; emotion: string }
  | { tag: 'CameraEmotion';  emotion: string };

type VRMCommandFn = (cmd: VRMCommand) => void;

let _handler: VRMCommandFn | null = null;
let _state: CoordState = 'Idle';
let _pending: string | null = null;      // emotion waiting for TTS to end
let _postTimer: ReturnType<typeof setTimeout> | null = null;
let _camTimer:  ReturnType<typeof setTimeout> | null = null;

// ─── Internal helpers ─────────────────────────────────────────────────────────

function send(cmd: VRMCommand): void {
  _handler?.(cmd);
}

function sendPreset(name: string): void {
  send({ type: 'playPreset', data: { name } });
}

function sendExpression(blendShapes: Record<string, number>): void {
  send({
    type: 'setExpression',
    data: { blendShapes, duration: 0.5, holdDuration: 3 },
  });
}

function clearPostTimer(): void {
  if (_postTimer) { clearTimeout(_postTimer); _postTimer = null; }
}

function clearCamTimer(): void {
  if (_camTimer) { clearTimeout(_camTimer); _camTimer = null; }
}

function isTTSActive(s: CoordState): boolean {
  return (
    s === 'TTS_Speaking' ||
    s === 'TTS_Laughing' ||
    (typeof s === 'object' && s.tag === 'TTS_Emotion')
  );
}

function playEmotionThenIdle(emotion: string): void {
  const preset = EMOTION_PRESET[emotion] ?? 'idle';
  const blends = EMOTION_BLEND[emotion];
  sendPreset(preset);
  if (blends) sendExpression(blends);

  const duration = PRESET_DURATION[preset] ?? 3000;
  clearPostTimer();
  _postTimer = setTimeout(() => {
    _state = 'Idle';
    sendPreset('idle');
    _postTimer = null;
  }, duration);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const motionCoordinator = {
  /** Called by CharacterAvatar once the WebView is ready. */
  register(fn: VRMCommandFn): void {
    _handler = fn;
  },

  unregister(): void {
    _handler = null;
  },

  /** AI started or stopped thinking. Highest priority — interrupts everything. */
  onAIThinking(isThinking: boolean): void {
    if (isThinking) {
      clearPostTimer();
      clearCamTimer();
      _state = 'Thinking';
      sendPreset('thinking');
    } else {
      if (_pending) {
        const emotion = _pending;
        _pending = null;
        _state = { tag: 'PostTTS_Emotion', emotion };
        playEmotionThenIdle(emotion);
      } else {
        _state = 'Idle';
        sendPreset('idle');
      }
    }
  },

  /**
   * Called by useTTSQueue when a segment starts playing.
   * hint: "laugh" | "speaking" (default) | EmotionType
   */
  onTTSStart(hint: string): void {
    clearPostTimer();
    clearCamTimer();
    if (hint === 'laugh') {
      _state = 'TTS_Laughing';
      sendPreset('laugh');
    } else if (!hint || hint === 'speaking') {
      _state = 'TTS_Speaking';
      sendPreset('speaking');
    } else {
      _state = { tag: 'TTS_Emotion', emotion: hint };
      const preset = EMOTION_PRESET[hint] ?? 'speaking';
      sendPreset(preset);
      const blends = EMOTION_BLEND[hint];
      if (blends) sendExpression(blends);
    }
  },

  /** Called by useTTSQueue when a segment finishes playing. */
  onTTSEnd(): void {
    if (_pending) {
      const emotion = _pending;
      _pending = null;
      _state = { tag: 'PostTTS_Emotion', emotion };
      playEmotionThenIdle(emotion);
    } else {
      _state = 'Idle';
      sendPreset('idle');
    }
  },

  /**
   * Called when a <action>{"emotion":"..."}</action> is parsed from AI reply.
   * If TTS is active, stores as pending (plays after TTS ends).
   * If idle, plays immediately.
   */
  onAIAction(emotion: string): void {
    if (isTTSActive(_state) || _state === 'Thinking') {
      _pending = emotion;
    } else {
      _state = { tag: 'PostTTS_Emotion', emotion };
      playEmotionThenIdle(emotion);
    }
  },

  /**
   * Called when camera detects a stable emotion.
   * Only acts when character is idle; ignored during speech / thinking.
   */
  onCameraEmotion(emotion: EmotionType): void {
    if (_state !== 'Idle') return;
    if (emotion === 'neutral') return;

    const preset = EMOTION_PRESET[emotion] ?? 'idle';
    if (preset === 'idle') return;

    clearCamTimer();
    _state = { tag: 'CameraEmotion', emotion };
    sendPreset(preset);
    const blends = EMOTION_BLEND[emotion];
    if (blends) sendExpression(blends);

    const duration = PRESET_DURATION[preset] ?? 3000;
    _camTimer = setTimeout(() => {
      if (typeof _state === 'object' && _state.tag === 'CameraEmotion') {
        _state = 'Idle';
        sendPreset('idle');
      }
      _camTimer = null;
    }, duration);
  },

  /** Visemes always pass through regardless of motion state. */
  onVisemes(data: unknown): void {
    send({ type: 'prepareVisemes', data });
  },

  onStopVisemes(): void {
    send({ type: 'stopVisemes' });
  },

  /** Hard reset — used when TTS is cancelled. */
  reset(): void {
    clearPostTimer();
    clearCamTimer();
    _state = 'Idle';
    _pending = null;
    sendPreset('idle');
  },
};
