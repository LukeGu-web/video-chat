import { VisemeFrame } from '../../types/vrm';

const MS_PER_CHAR = 0.2;
const PAUSE_DURATION = 0.15;

const CHAR_TO_SHAPE: Record<string, VisemeFrame['shape']> = {
  '的': 'ee', '了': 'oh', '是': 'ih', '我': 'oh', '不': 'ou',
  '你': 'ih', '他': 'aa', '她': 'aa', '好': 'aa', '在': 'aa',
  '有': 'ou', '这': 'ee', '那': 'aa', '很': 'ee', '也': 'ee',
  '就': 'ou', '都': 'ou', '说': 'oh', '来': 'aa', '去': 'ih',
  '一': 'ih', '二': 'ee', '三': 'aa', '四': 'ih', '五': 'ou',
  '啊': 'aa', '嗯': 'ee', '哦': 'oh', '呢': 'ee', '吧': 'aa',
  '嘿': 'ee', '哇': 'aa', '呀': 'aa', '嘛': 'aa', '哈': 'aa',
};

const PUNCTUATION = new Set(['。', '，', '！', '？', '、', '.', ',', '!', '?', '…', '~', '·']);

function charToShape(ch: string): VisemeFrame['shape'] {
  if (CHAR_TO_SHAPE[ch]) return CHAR_TO_SHAPE[ch];
  // Default: alternate between aa and ee for unknown chars
  const code = ch.charCodeAt(0);
  const shapes: VisemeFrame['shape'][] = ['aa', 'ee', 'ih', 'oh'];
  return shapes[code % shapes.length];
}

export function textToViseme(text: string): { visemes: VisemeFrame[]; totalDuration: number } {
  const visemes: VisemeFrame[] = [];
  let t = 0;

  // Opening silence
  visemes.push({ shape: 'sil', time: 0, weight: 0 });

  for (const ch of text) {
    if (PUNCTUATION.has(ch)) {
      // Punctuation: mouth close + pause
      visemes.push({ shape: 'sil', time: t, weight: 0 });
      t += PAUSE_DURATION;
      continue;
    }

    // Skip non-CJK, non-ASCII printable chars (e.g. emoji, spaces)
    const isCJK = ch.charCodeAt(0) >= 0x4e00 && ch.charCodeAt(0) <= 0x9fff;
    const isAscii = ch.charCodeAt(0) >= 0x20 && ch.charCodeAt(0) <= 0x7e;
    if (!isCJK && !isAscii) continue;

    const shape = charToShape(ch);
    const charDuration = MS_PER_CHAR;

    // Open mouth at start of char
    visemes.push({ shape, time: t, weight: 0.85 });
    // Start closing halfway through
    visemes.push({ shape, time: t + charDuration * 0.6, weight: 0.3 });
    // Close before next char
    visemes.push({ shape: 'sil', time: t + charDuration * 0.9, weight: 0 });

    t += charDuration;
  }

  // Closing silence
  visemes.push({ shape: 'sil', time: t, weight: 0 });

  return { visemes, totalDuration: t + 0.1 };
}
