/**
 * Transition Audio Manager
 * Phase 1 优化: 预设过渡语音管理系统
 *
 * 功能:
 * - 预加载过渡语音文件
 * - 根据对话类型智能选择过渡语音
 * - 快速播放(0.3s内)提供立即反馈
 */

import { Audio } from 'expo-av';

export type TransitionCategory =
  | 'thinking'        // 思考类(中性)
  | 'question'        // 疑问类(用户提问时)
  | 'excited'         // 兴奋类(积极内容)
  | 'empathy'         // 共鸣类(情感支持)
  | 'acknowledgment'; // 确认类(简单回应)

/**
 * 过渡语音短语库
 * 注意: 音频文件需要预生成到 assets/audio/transitions/ 目录
 */
export const TRANSITION_PHRASES = {
  // 思考类(中性)
  thinking: [
    "嗯...",
    "让我想想...",
    "这个问题啊...",
    "嗯嗯...",
  ],

  // 疑问类(用户提问时)
  question: [
    "欸？",
    "什么呢？",
    "你是说...",
  ],

  // 兴奋类(积极内容)
  excited: [
    "哇！",
    "真的吗？",
    "欸嘿嘿~",
    "太好了！",
  ],

  // 共鸣类(情感支持)
  empathy: [
    "我明白...",
    "是这样啊...",
    "嗯嗯，我懂...",
  ],

  // 确认类(简单回应)
  acknowledgment: [
    "嗯~",
    "好的呢~",
    "明白了~",
  ],
};

interface TransitionAudioCache {
  [key: string]: Audio.Sound;
}

class TransitionAudioManager {
  private audioCache: TransitionAudioCache = {};
  private initialized = false;
  private isPreloading = false;

  /**
   * 预加载所有过渡音频
   * 注意: 在实际部署前需要生成音频文件
   * 当前实现: 使用文本占位,待音频文件生成后替换
   */
  async preloadAll(): Promise<void> {
    if (this.initialized || this.isPreloading) return;

    this.isPreloading = true;
    console.log('[TransitionAudio] 开始预加载过渡语音...');

    try {
      // TODO: Phase 1 待实现 - 生成音频文件后取消注释
      // const audioFiles = {
      //   thinking_01: require('../../assets/audio/transitions/thinking_01.mp3'),
      //   thinking_02: require('../../assets/audio/transitions/thinking_02.mp3'),
      //   thinking_03: require('../../assets/audio/transitions/thinking_03.mp3'),
      //   thinking_04: require('../../assets/audio/transitions/thinking_04.mp3'),
      //
      //   question_01: require('../../assets/audio/transitions/question_01.mp3'),
      //   question_02: require('../../assets/audio/transitions/question_02.mp3'),
      //   question_03: require('../../assets/audio/transitions/question_03.mp3'),
      //
      //   excited_01: require('../../assets/audio/transitions/excited_01.mp3'),
      //   excited_02: require('../../assets/audio/transitions/excited_02.mp3'),
      //   excited_03: require('../../assets/audio/transitions/excited_03.mp3'),
      //   excited_04: require('../../assets/audio/transitions/excited_04.mp3'),
      //
      //   empathy_01: require('../../assets/audio/transitions/empathy_01.mp3'),
      //   empathy_02: require('../../assets/audio/transitions/empathy_02.mp3'),
      //   empathy_03: require('../../assets/audio/transitions/empathy_03.mp3'),
      //
      //   acknowledgment_01: require('../../assets/audio/transitions/acknowledgment_01.mp3'),
      //   acknowledgment_02: require('../../assets/audio/transitions/acknowledgment_02.mp3'),
      //   acknowledgment_03: require('../../assets/audio/transitions/acknowledgment_03.mp3'),
      // };
      //
      // for (const [key, file] of Object.entries(audioFiles)) {
      //   const { sound } = await Audio.Sound.createAsync(file);
      //   this.audioCache[key] = sound;
      // }

      this.initialized = true;
      console.log('[TransitionAudio] 预加载完成！');
    } catch (error) {
      console.error('[TransitionAudio] 预加载失败:', error);
    } finally {
      this.isPreloading = false;
    }
  }

  /**
   * 根据类别随机选择并播放过渡语音
   * @param category 过渡语音类别
   */
  async playTransition(category: TransitionCategory): Promise<void> {
    // Phase 1: 暂时使用文本日志,待音频文件生成后替换为实际播放
    const phrase = this.selectRandomPhrase(category);
    console.log(`[TransitionAudio] 播放过渡语音 [${category}]: "${phrase}"`);

    // TODO: Phase 1 待实现 - 生成音频文件后取消注释
    // if (!this.initialized) {
    //   console.warn('[TransitionAudio] 音频未预加载,跳过播放');
    //   return;
    // }
    //
    // const audioKey = this.selectRandomAudio(category);
    // const sound = this.audioCache[audioKey];
    //
    // if (!sound) {
    //   console.warn(`[TransitionAudio] 未找到音频: ${audioKey}`);
    //   return;
    // }
    //
    // try {
    //   await sound.replayAsync(); // 从头播放
    // } catch (error) {
    //   console.error('[TransitionAudio] 播放失败:', error);
    // }
  }

  /**
   * 根据类别随机选择音频key
   * @param category 过渡语音类别
   * @returns 音频文件key
   */
  private selectRandomAudio(category: TransitionCategory): string {
    const categoryAudios = Object.keys(this.audioCache)
      .filter(key => key.startsWith(category));

    if (categoryAudios.length === 0) {
      console.warn(`[TransitionAudio] 未找到类别 ${category} 的音频`);
      return '';
    }

    const randomIndex = Math.floor(Math.random() * categoryAudios.length);
    return categoryAudios[randomIndex];
  }

  /**
   * 根据类别随机选择短语(用于调试和临时使用)
   * @param category 过渡语音类别
   * @returns 短语文本
   */
  private selectRandomPhrase(category: TransitionCategory): string {
    const phrases = TRANSITION_PHRASES[category];
    if (!phrases || phrases.length === 0) {
      return "嗯...";
    }
    const randomIndex = Math.floor(Math.random() * phrases.length);
    return phrases[randomIndex];
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    console.log('[TransitionAudio] 清理资源...');
    for (const sound of Object.values(this.audioCache)) {
      try {
        await sound.unloadAsync();
      } catch (error) {
        console.error('[TransitionAudio] 清理音频失败:', error);
      }
    }
    this.audioCache = {};
    this.initialized = false;
  }
}

// 导出单例实例
export const transitionAudio = new TransitionAudioManager();
