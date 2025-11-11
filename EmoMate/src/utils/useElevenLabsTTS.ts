import { useState, useCallback, useEffect, useRef } from 'react';
import { File, Paths } from 'expo-file-system';
import {
  ELEVENLABS_CONFIG,
  getElevenLabsApiKey,
  getEmotionalVoiceSettings,
  getLanLanVoiceId,
  preprocessTextForNaturalSpeech
} from '../constants/ai';
import { base64ToUint8Array, safeDeleteFile } from './fileSystemHelpers';
import { SoundPlayer } from './soundPlayer';
import { audioModeManager } from './audioModeManager';

export interface UseElevenLabsTTSReturn {
  isSpeaking: boolean;
  isGenerating: boolean; // 新增：是否正在生成语音
  error: string | null;
  speak: (text: string, voiceId?: string, userEmotion?: string) => Promise<void>;
  stop: () => Promise<void>;
  currentSegment: string; // 当前正在播放的语音片段
}

export const useElevenLabsTTS = (): UseElevenLabsTTSReturn => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false); // 新增：语音生成状态
  const [currentSegment, setCurrentSegment] = useState<string>(''); // 当前播放的语音片段

  // Initialize sound player using react-native-sound (avoids expo-audio AudioMode conflicts)
  const soundPlayerRef = useRef<SoundPlayer | null>(null);

  // Initialize sound player on mount
  useEffect(() => {
    soundPlayerRef.current = new SoundPlayer();
    return () => {
      // Clean up sound player on unmount
      soundPlayerRef.current?.release();
      soundPlayerRef.current = null;
    };
  }, []);

  const createMockSegments = (text: string): {text: string, start: number, end: number}[] => {
    const segments: {text: string, start: number, end: number}[] = [];
    const sentences = text.split(/[。！？]/);
    let currentTime = 0;
    
    for (const sentence of sentences) {
      if (sentence.trim()) {
        const duration = sentence.length * 0.15; // 估算每个字符0.15秒
        segments.push({
          text: sentence.trim(),
          start: currentTime,
          end: currentTime + duration
        });
        currentTime += duration + 0.2; // 添加一点间隔
      }
    }
    
    return segments;
  };

  const generateSpeechFile = async (text: string, voiceId?: string, userEmotion?: string): Promise<string> => {
    const apiKey = getElevenLabsApiKey();
    if (!apiKey) {
      throw new Error('ElevenLabs API密钥未配置。请在环境变量中设置ELEVENLABS_API_KEY。');
    }

    const voice = voiceId || getLanLanVoiceId(); // 使用兰兰专用语音
    const url = `${ELEVENLABS_CONFIG.baseURL}/text-to-speech/${voice}`;
    const voiceSettings = getEmotionalVoiceSettings(userEmotion); // 获取情感化语音设置

    // 创建临时文件
    const fileName = `elevenlabs_${Date.now()}.mp3`;
    const file = new File(Paths.document, fileName);
    file.create();

    // 使用 XMLHttpRequest 来正确处理二进制数据
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.responseType = 'blob';

      // 设置请求头
      xhr.setRequestHeader('Accept', 'audio/mpeg');
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('xi-api-key', apiKey);

      xhr.onload = async () => {
        if (xhr.status === 200) {
          try {
            // 将 blob 转换为 base64 并保存到文件
            const reader = new FileReader();
            reader.onloadend = async () => {
              try {
                const base64data = reader.result as string;
                const base64Audio = base64data.split(',')[1]; // 移除 data:audio/mpeg;base64, 前缀

                if (!base64Audio || base64Audio.trim().length === 0) {
                  throw new Error('Received empty audio data from ElevenLabs');
                }

                // Convert base64 to Uint8Array for Expo v54
                const audioBytes = base64ToUint8Array(base64Audio);
                file.write(audioBytes);

                resolve(file.uri);
              } catch (error) {
                await safeDeleteFile(file.uri);
                reject(new Error(`保存音频文件失败: ${error}`));
              }
            };
            reader.readAsDataURL(xhr.response);
          } catch (error) {
            await safeDeleteFile(file.uri);
            reject(new Error(`处理音频数据失败: ${error}`));
          }
        } else {
          await safeDeleteFile(file.uri);
          reject(new Error(`ElevenLabs API调用失败: ${xhr.status}`));
        }
      };
      
      xhr.onerror = async () => {
        await safeDeleteFile(file.uri);
        reject(new Error('网络请求失败'));
      };
      
      // 发送请求 - 预处理文本以优化语音自然度
      const processedText = preprocessTextForNaturalSpeech(text);
      const postData = JSON.stringify({
        text: processedText,
        model_id: ELEVENLABS_CONFIG.defaultModel,
        voice_settings: voiceSettings, // 使用情感化语音设置
      });
      
      xhr.send(postData);
    });
  };

  const generateSpeechWithTimestamps = async (text: string, voiceId?: string, userEmotion?: string): Promise<{audioUri: string, segments: {text: string, start: number, end: number}[]}> => {
    const apiKey = getElevenLabsApiKey();
    if (!apiKey) {
      throw new Error('ElevenLabs API密钥未配置。请在环境变量中设置ELEVENLABS_API_KEY。');
    }

    const voice = voiceId || getLanLanVoiceId(); // 使用兰兰专用语音
    const url = `${ELEVENLABS_CONFIG.baseURL}/text-to-speech/${voice}/stream/with-timestamps`;
    const voiceSettings = getEmotionalVoiceSettings(userEmotion); // 获取情感化语音设置

    // 创建临时文件
    const fileName = `elevenlabs_${Date.now()}.mp3`;
    const file = new File(Paths.document, fileName);
    file.create();

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.responseType = 'text';
      
      // 设置请求头
      xhr.setRequestHeader('Accept', 'text/plain');
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('xi-api-key', apiKey);
      
      let audioData = '';
      let segments: {text: string, start: number, end: number}[] = [];
      let processedLines = new Set<string>();
      
      xhr.onprogress = (event) => {
        const responseText = xhr.responseText;
        const lines = responseText.split('\n');
        
        for (const line of lines) {
          if (line.trim() && !processedLines.has(line)) {
            processedLines.add(line);
            try {
              const data = JSON.parse(line);
              
              if (data.audio_base64) {
                audioData += data.audio_base64;
              }
              if (data.alignment && data.alignment.characters) {
                // 处理字符级别的对齐信息，合并成单词或短语
                const chars = data.alignment.characters;
                let currentSegment = '';
                let segmentStart = 0;
                
                for (let i = 0; i < chars.length; i++) {
                  const char = chars[i];
                  if (currentSegment === '') {
                    segmentStart = char.start_time_seconds;
                  }
                  currentSegment += char.character;
                  
                  // 当遇到标点符号或达到一定长度时，创建一个新的段落
                  if (char.character.match(/[。！？，；：]/)) {
                    if (currentSegment.trim()) {
                      segments.push({
                        text: currentSegment.trim(),
                        start: segmentStart,
                        end: char.end_time_seconds
                      });
                    }
                    currentSegment = '';
                  }
                }
                
                // 处理最后一个段落
                if (currentSegment.trim()) {
                  const lastChar = chars[chars.length - 1];
                  segments.push({
                    text: currentSegment.trim(),
                    start: segmentStart,
                    end: lastChar.end_time_seconds
                  });
                }
              }
            } catch (e) {
              // 忽略解析错误的行
            }
          }
        }
      };
      
      xhr.onload = async () => {
        if (xhr.status === 200) {
          try {
            // 保存音频文件
            if (audioData) {
              if (audioData.trim().length === 0) {
                throw new Error('Received empty audio data from ElevenLabs');
              }

              // Convert base64 to Uint8Array for Expo v54
              const audioBytes = base64ToUint8Array(audioData);
              await file.write(audioBytes);
            }

            resolve({ audioUri: file.uri, segments });
          } catch (error) {
            await safeDeleteFile(file.uri);
            reject(new Error(`保存音频文件失败: ${error}`));
          }
        } else {
          await safeDeleteFile(file.uri);
          reject(new Error(`ElevenLabs API调用失败: ${xhr.status}`));
        }
      };
      
      xhr.onerror = async () => {
        await safeDeleteFile(file.uri);
        reject(new Error('网络请求失败'));
      };
      
      // 发送请求 - 预处理文本以优化语音自然度
      const processedText = preprocessTextForNaturalSpeech(text);
      const postData = JSON.stringify({
        text: processedText,
        model_id: ELEVENLABS_CONFIG.defaultModel,
        voice_settings: voiceSettings, // 使用情感化语音设置
      });
      
      xhr.send(postData);
    });
  };

  // No longer needed - SoundPlayer uses callbacks instead of effect-based monitoring

  const speak = useCallback(async (text: string, voiceId?: string, userEmotion?: string) => {
    if (!text.trim()) return;

    const soundPlayer = soundPlayerRef.current;
    if (!soundPlayer) {
      console.error('[ElevenLabsTTS] SoundPlayer not initialized');
      return;
    }

    try {
      setError(null);
      setIsGenerating(true); // 开始生成语音
      setCurrentSegment(''); // 清空当前段落

      // 停止当前播放
      soundPlayer.stop();

      // 清理之前的音频文件
      if (audioUri) {
        await safeDeleteFile(audioUri);
      }

      // 使用情感化语音生成
      const newAudioUri = await generateSpeechFile(text, voiceId, userEmotion);

      // 创建模拟的段落数据用于测试
      const segments = createMockSegments(text);

      setAudioUri(newAudioUri);
      setIsGenerating(false);

      // CRITICAL FIX: Set expo-audio to idle mode before playback
      // This prevents expo-audio's recording mode from interfering with react-native-sound
      try {
        await audioModeManager.setIdleMode();
        console.log('[ElevenLabsTTS] ✅ Set expo-audio to idle before playback');
      } catch (error) {
        console.warn('[ElevenLabsTTS] ⚠️ Failed to set idle mode:', error);
      }

      // Start playback with SoundPlayer
      console.log('[ElevenLabsTTS] 🎵 Starting playback with SoundPlayer');

      await soundPlayer.play(newAudioUri, {
        onPlaybackStatusUpdate: (status) => {
          setIsSpeaking(status.playing);

          // Update current segment based on playback position
          if (status.playing && status.duration > 0) {
            const currentSegmentData = segments.find(s =>
              status.currentTime >= s.start && status.currentTime < s.end
            );

            if (currentSegmentData) {
              setCurrentSegment(currentSegmentData.text);
            }
          }
        },
        onPlaybackFinished: async () => {
          console.log('[ElevenLabsTTS] ✅ Playback finished');
          setIsSpeaking(false);
          setCurrentSegment('');

          // 清理音频文件
          if (audioUri) {
            await safeDeleteFile(audioUri);
            setAudioUri(null);
          }
        },
        onError: (error) => {
          console.error('[ElevenLabsTTS] ❌ Playback error:', error);
          setError(error.message);
          setIsSpeaking(false);
          setCurrentSegment('');
        },
      });

      setIsSpeaking(true);

    } catch (err) {
      setError(err instanceof Error ? err.message : '语音合成失败');
      setIsGenerating(false);
      setIsSpeaking(false);
      setCurrentSegment('');
      console.error('ElevenLabs TTS Error:', err);
    }
  }, [audioUri]);

  const stop = useCallback(async () => {
    const soundPlayer = soundPlayerRef.current;
    if (!soundPlayer) {
      console.warn('[ElevenLabsTTS] SoundPlayer not initialized');
      return;
    }

    try {
      // Stop playback using SoundPlayer
      soundPlayer.stop();

      // 停止所有状态
      setIsGenerating(false);
      setIsSpeaking(false);
      setCurrentSegment(''); // 清空当前段落

      // 清理临时音频文件
      if (audioUri) {
        await safeDeleteFile(audioUri);
        setAudioUri(null);
      }

      console.log('[ElevenLabsTTS] ⏹️ Stopped playback');
    } catch (err) {
      setError(err instanceof Error ? err.message : '停止播放失败');
      setIsGenerating(false);
      setIsSpeaking(false); // 确保即使出错也重置状态
      setCurrentSegment(''); // 清空当前段落
    }
  }, [audioUri]);

  return {
    isSpeaking,
    isGenerating,
    error,
    speak,
    stop,
    currentSegment,
  };
};