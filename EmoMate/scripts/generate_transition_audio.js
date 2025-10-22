/**
 * ElevenLabs Transition Audio Generator
 *
 * 功能: 批量生成过渡语音音频文件
 * 用法: node scripts/generate_transition_audio.js
 *
 * 需要:
 * - ELEVENLABS_API_KEY 环境变量
 * - Node.js 18+
 */

const fs = require('fs');
const path = require('path');

// 从 .env 文件读取 API Key (需要先安装 dotenv: npm install dotenv)
require('dotenv').config();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = 'hkfHEbBvdQFNX4uWHqRF'; // 兰兰专用语音
const OUTPUT_DIR = path.join(__dirname, '../assets/audio/transitions');

// 过渡语音文本数据
const TRANSITION_PHRASES = {
  thinking: [
    { file: 'thinking_01.mp3', text: '嗯...' },
    { file: 'thinking_02.mp3', text: '让我想想...' },
    { file: 'thinking_03.mp3', text: '这个问题啊...' },
    { file: 'thinking_04.mp3', text: '嗯嗯...' },
  ],
  question: [
    { file: 'question_01.mp3', text: '欸？' },
    { file: 'question_02.mp3', text: '什么呢？' },
    { file: 'question_03.mp3', text: '你是说...' },
  ],
  excited: [
    { file: 'excited_01.mp3', text: '哇！' },
    { file: 'excited_02.mp3', text: '真的吗？' },
    { file: 'excited_03.mp3', text: '欸嘿嘿~' },
    { file: 'excited_04.mp3', text: '太好了！' },
  ],
  empathy: [
    { file: 'empathy_01.mp3', text: '我明白...' },
    { file: 'empathy_02.mp3', text: '是这样啊...' },
    { file: 'empathy_03.mp3', text: '嗯嗯，我懂...' },
  ],
  acknowledgment: [
    { file: 'acknowledgment_01.mp3', text: '嗯~' },
    { file: 'acknowledgment_02.mp3', text: '好的呢~' },
    { file: 'acknowledgment_03.mp3', text: '明白了~' },
  ],
};

// 语音参数 - 兰兰温柔姐姐型
const VOICE_SETTINGS = {
  stability: 0.4,
  similarity_boost: 0.7,
  style: 0.25,
  use_speaker_boost: true,
};

/**
 * 调用 ElevenLabs API 生成语音
 */
async function generateAudio(text, outputPath) {
  console.log(`生成: "${text}" -> ${path.basename(outputPath)}`);

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2', // 多语言模型支持中文
          voice_settings: VOICE_SETTINGS,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API 错误 (${response.status}): ${error}`);
    }

    // 保存音频文件
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(outputPath, buffer);

    console.log(`✅ 成功: ${path.basename(outputPath)}`);
    return true;
  } catch (error) {
    console.error(`❌ 失败: ${path.basename(outputPath)} - ${error.message}`);
    return false;
  }
}

/**
 * 延迟函数 (避免API限流)
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 批量生成所有音频文件
 */
async function generateAll() {
  console.log('🎵 开始批量生成过渡语音音频文件...\n');

  // 检查 API Key
  if (!ELEVENLABS_API_KEY) {
    console.error('❌ 错误: 未找到 ELEVENLABS_API_KEY 环境变量');
    console.error('请在 .env 文件中设置: ELEVENLABS_API_KEY=your_api_key');
    process.exit(1);
  }

  // 创建输出目录
  if (!fs.existsSync(OUTPUT_DIR)) {
    console.log(`📁 创建目录: ${OUTPUT_DIR}\n`);
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let successCount = 0;
  let failCount = 0;
  let totalFiles = 0;

  // 统计总文件数
  Object.values(TRANSITION_PHRASES).forEach(category => {
    totalFiles += category.length;
  });

  console.log(`📊 总共需要生成 ${totalFiles} 个音频文件\n`);

  // 逐个生成
  for (const [category, phrases] of Object.entries(TRANSITION_PHRASES)) {
    console.log(`\n--- 类别: ${category} (${phrases.length} 个文件) ---`);

    for (const phrase of phrases) {
      const outputPath = path.join(OUTPUT_DIR, phrase.file);

      // 如果文件已存在,跳过
      if (fs.existsSync(outputPath)) {
        console.log(`⏭️  跳过 (已存在): ${phrase.file}`);
        successCount++;
        continue;
      }

      const success = await generateAudio(phrase.text, outputPath);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }

      // 延迟 500ms 避免 API 限流
      await delay(500);
    }
  }

  // 生成总结
  console.log('\n' + '='.repeat(50));
  console.log('📊 生成完成统计:');
  console.log(`   ✅ 成功: ${successCount}/${totalFiles}`);
  console.log(`   ❌ 失败: ${failCount}/${totalFiles}`);
  console.log(`   📁 输出目录: ${OUTPUT_DIR}`);
  console.log('='.repeat(50));

  if (failCount > 0) {
    console.log('\n⚠️  部分文件生成失败,请检查错误信息');
    process.exit(1);
  } else {
    console.log('\n🎉 所有音频文件生成成功!');
    console.log('\n下一步: 在 transitionAudio.ts 中取消注释音频加载代码');
  }
}

// 运行生成脚本
generateAll().catch(error => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});
