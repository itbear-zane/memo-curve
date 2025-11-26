import OpenAI from 'openai';
import type { Note } from '../types';

/**
 * Multi-Agent Analysis Service
 * 实现多Agent协作分析笔记的功能
 */

export interface AgentResponse {
  success: boolean;
  content: string;
  error?: string;
}

export interface IntentAnalysisResult {
  intent: string;
  reviewPassed: boolean;
  attempts: number;
}

/**
 * 创建OpenAI客户端
 */
function createClient(config: {
  baseURL: string;
  apiKey: string;
  provider?: string;
  siteUrl?: string;
  siteName?: string;
}): OpenAI {
  const clientConfig: any = {
    baseURL: config.baseURL,
    apiKey: config.apiKey,
    dangerouslyAllowBrowser: true,
  };

  // Add OpenRouter specific headers
  if (config.provider === 'openrouter') {
    clientConfig.defaultHeaders = {};
    if (config.siteUrl) {
      clientConfig.defaultHeaders['HTTP-Referer'] = config.siteUrl;
    }
    if (config.siteName) {
      clientConfig.defaultHeaders['X-Title'] = config.siteName;
    }
  }

  return new OpenAI(clientConfig);
}

/**
 * Agent 1: 用户意图分析Agent
 */
export async function analyzeUserIntent(
  client: OpenAI,
  model: string,
  userMessageContent: any[],
  onStream?: (content: string) => void
): Promise<string> {
  const intentPrompt = `你是一个专业的学习笔记意图分析助手。你的任务是分析用户拍摄的笔记照片，找出用户真正想要学习或纠正的错题。如果该笔记没有照片，则直接输出原文即可。

分析重点：
1. 存在一些题目用户可能做对了但不理解，所以会在旁边订正
2. 错误的题目如果有图片，用户一般会用红色标注或圈画在旁边标注或订正
3. 如果没有发现没有重点标注就把所有题目均视为用户意图题目
4. 对于选择题（单选或多选），多选题可能存在半做对（选对了但不全）

输出要求：
- 只需输出所有用户意图题目的原文
- 如果分析不出任何题目，则返回"没有找到用户意图题目"
- 对于公式必须用LaTeX格式
- 每道题需要单独标注是单选题、多选题、填空题、解答题中的哪一种`;

  const stream = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: intentPrompt,
      },
      {
        role: 'user',
        content: userMessageContent,
      },
    ],
    temperature: 0.3,
    max_tokens: 1024,
    stream: true,
  });

  let fullContent = '';
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    if (content) {
      fullContent += content;
      onStream?.(fullContent);
    }
  }

  return fullContent;
}

/**
 * Review Agent: 审查意图分析结果
 */
export async function reviewIntentAnalysis(
  client: OpenAI,
  model: string,
  intentAnalysis: string,
  userMessageContent: any[],
  onStream?: (content: string) => void
): Promise<{ passed: boolean; feedback: string }> {
  const reviewPrompt = `你是一个严格的质量审查专家。你需要审查前一个Agent对学习笔记意图的分析是否准确。

审查标准：
1. 是否准确识别了用户做错的所有题目（不能遗漏，也不能误判）
2. 是否存在一些用户可能做对了但不理解的题目没有被分析出来
4. 是否存在半做对的多选题没有被分析出来
5. 是否所有输出的用户意图题目都与原文完全一致

请对比原始笔记图片和意图分析结果，判断分析是否准确。

输出格式：
第一行必须是：PASS 或 FAIL
如果是FAIL，接下来说明问题在哪里，需要如何改进（简洁明确，不超过500字）
如果是PASS，简短说明"分析准确"即可`;

  const stream = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: reviewPrompt,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `原始笔记内容：`,
          },
          ...userMessageContent,
          {
            type: 'text',
            text: `\n\n前一个Agent的意图分析结果：\n${intentAnalysis}`,
          },
        ],
      },
    ],
    temperature: 0.2,
    max_tokens: 1024,
    stream: true,
  });

  let reviewResult = '';
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    if (content) {
      reviewResult += content;
      onStream?.(reviewResult);
    }
  }

  const passed = reviewResult.trim().startsWith('PASS');
  const feedback = reviewResult
    .split('\n')
    .slice(1)
    .join('\n')
    .trim();

  return { passed, feedback };
}

/**
 * 迭代式意图分析（最多3次）
 */
export async function analyzeIntentWithReview(
  client: OpenAI,
  model: string,
  userMessageContent: any[],
  onProgress?: (message: string) => void,
  onAgentStream?: (agentId: string, content: string) => void
): Promise<IntentAnalysisResult> {
  const MAX_ATTEMPTS = 3;
  let attempts = 0;
  let intentAnalysis = '';
  let reviewPassed = false;

  while (attempts < MAX_ATTEMPTS && !reviewPassed) {
    attempts++;
    onProgress?.(
      `🔍 正在进行第 ${attempts} 次意图分析...`
    );

    // Agent 1: 分析用户意图
    intentAnalysis = await analyzeUserIntent(
      client,
      model,
      userMessageContent,
      (content) => onAgentStream?.('intent', content)
    );

    onProgress?.(`📋 意图分析完成，正在审查...`);

    // Review Agent: 审查分析结果
    const review = await reviewIntentAnalysis(
      client,
      model,
      intentAnalysis,
      userMessageContent,
      (content) => onAgentStream?.('review', content)
    );

    reviewPassed = review.passed;

    if (!reviewPassed && attempts < MAX_ATTEMPTS) {
      onProgress?.(
        `⚠️ 审查未通过：${review.feedback}\n准备重新分析...`
      );
      // 如果审查未通过,将反馈加入到下一次分析中
      userMessageContent.push({
        type: 'text',
        text: `\n\n【上一次分析的问题】：${review.feedback}\n请根据以上反馈重新分析。`,
      });
    } else if (reviewPassed) {
      onProgress?.(`✅ 意图审查通过`);
    }
  }

  return {
    intent: intentAnalysis,
    reviewPassed,
    attempts,
  };
}

/**
 * Agent 2: 原始记录分析Agent
 */
export async function analyzeOriginalRecord(
  client: OpenAI,
  model: string,
  intent: string,
  userMessageContent: any[],
  onStream?: (content: string) => void
): Promise<string> {
  const prompt = `你是一个专业的错题诊断专家。根据已确认的用户意图，分析用户在做题时的原始记录。

用户意图分析结果：
${intent}

你的任务：
1. 仔细查看用户做题时的原始记录（注意区分原始记录和看答案后的订正）
2. 红色标注往往不是原始记录
3. 找出用户在解题过程中哪里出错了
4. 分析错误的原因（概念理解错误/计算失误/思路偏差/知识点遗漏等）

输出要求：
- 如果没发现原始记录，就直接输出’无原始记录‘，除此之外不要输出任何内容
- 针对每道错题，只需要具体指出原始记录中的内容和错误本身
- 不需要给出分析过程
- 不需要输出你认为的正确答案
- 不需要给出总结
- 使用中文，逻辑清晰，适当使用表情符号
- 对于公式必须用LaTeX格式`;

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: prompt,
      },
      {
        role: 'user',
        content: userMessageContent,
      },
    ],
    temperature: 0.4,
    max_tokens: 2048,
    stream: true,
  });

  let fullContent = '';
  for await (const chunk of response) {
    const content = chunk.choices[0]?.delta?.content || '';
    if (content) {
      fullContent += content;
      onStream?.(fullContent);
    }
  }

  return fullContent;
}

/**
 * Agent 3: 订正答案分析Agent
 */
export async function analyzeCorrection(
  client: OpenAI,
  model: string,
  intent: string,
  userMessageContent: any[],
  onStream?: (content: string) => void
): Promise<string> {
  const prompt = `你是一个专业的解题思路专家。根据已确认的用户意图，分析用户在错题旁边的订正答案。

用户意图分析结果：
${intent}

你的任务：
1. 找出用户在错题旁边订正的答案（这些往往是正确的，一般用红色笔书写）
2. 如果没找到订正答案，就则你自己分析正确的解题思路和步骤
3. 如果有订正的答案，则根据其分析正确的解题思路和步骤
4. 注意识别手写内容，准确理解订正的逻辑

输出要求：
- 如果没有发现任何具体题目，就直接输出’没有找到用户意图题目‘，除此之外不要输出任何内容
- 针对每道题，只需清晰展示正确的解题思路和答案
- 不需要给出总结
- 使用中文，条理清晰，适当使用表情符号
- 对于公式必须用LaTeX格式`;

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: prompt,
      },
      {
        role: 'user',
        content: userMessageContent,
      },
    ],
    temperature: 0.4,
    max_tokens: 2048,
    stream: true,
  });

  let fullContent = '';
  for await (const chunk of response) {
    const content = chunk.choices[0]?.delta?.content || '';
    if (content) {
      fullContent += content;
      onStream?.(fullContent);
    }
  }

  return fullContent;
}

/**
 * Agent 4: 总结Agent
 */
export async function generateSummary(
  client: OpenAI,
  model: string,
  note: Note,
  intent: string,
  originalAnalysis: string,
  correctionAnalysis: string,
  categoryName: string,
  curveName: string,
  curveIntervals: number[],
  onStream?: (content: string) => void
): Promise<string> {
  const prompt = `你是一个专业的学习指导专家。基于前面各个Agent的分析结果，为用户生成一个全面的总结报告。

分析材料：
1. 用户意图分析：
${intent}

2. 原始记录分析：
${originalAnalysis}

3. 订正答案分析：
${correctionAnalysis}

笔记信息：
- 标题：${note.title}
- 分类：${categoryName}
- 遗忘曲线：${curveName} (复习间隔: ${curveIntervals.join(', ')} 天)
- 创建时间：${new Date(note.createdAt).toLocaleDateString('zh-CN')}
- 当前复习阶段：第${note.stage}次复习
- 下次复习时间：${new Date(note.nextReviewDate).toLocaleDateString('zh-CN')}

你的任务：
1. 一道一道总结这些题为什么做错了
2. 提供如何避免犯类似错误的建议，简单易懂就好
3. 简要分析题目难度和出现频率，给出针对性建议：
   - 如果题目很难、比较小众：告诉用户不用着急
   - 如果题目简单、高频出现：提醒用户着重注意，应该经常复习
4. 针对遗忘曲线和当前复习次数：
   - 如果已经过期：给出一些压力的话（语气稍重）
   - 如果未过期：加粗提醒下次复习时间（简洁）
   - '第0次复习'意味着今天刚添加，不需要强调
5. 如果发现没有原始记录或订正答案，就直接输出'没有找到用户意图题目'，除此之外不要输出任何内容

输出要求：
1. 使用中文，清晰的段落结构，尽可能保持简洁
2. 更多使用表情符号增强可读性
3. 保持专业且友好、充满鼓励的语气（不需要具体写鼓励的话）
4. 对于公式必须用LaTeX格式

请使用Markdown格式，包含合适的标题、列表、加粗等格式化元素。`;

  const stream = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: prompt,
      },
      {
        role: 'user',
        content: '请生成总结报告',
      },
    ],
    temperature: 0.6,
    max_tokens: 4096,
    stream: true,
  });

  let fullContent = '';
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    if (content) {
      fullContent += content;
      onStream?.(fullContent);
    }
  }

  return fullContent;
}

/**
 * 生成友善的失败回复
 */
export function generateFriendlyFailureMessage(attempts: number): string {
  return `## 😊 分析遇到了一些困难

经过 ${attempts} 次尝试，我在理解这份笔记时遇到了一些挑战。这可能是因为：

- 📷 图片中的内容比较复杂或不够清晰
- ✍️ 手写内容的辨识存在困难
- 🎯 笔记的重点标注不够明显

### 💡 建议

1. **重新拍摄**：尝试在光线更好的环境下重新拍摄笔记
2. **突出重点**：用更明显的标记（如红笔圈画）标注需要分析的题目
3. **分批分析**：如果笔记内容较多，可以分成几份分别拍摄分析

### 🤝 需要帮助？

如果问题持续存在，你可以：
- 在笔记内容中用文字补充说明哪道题有问题
- 提供更清晰的图片
- 尝试描述具体遇到的困难

不要气馁！学习过程中遇到困难是正常的，让我们一起找到更好的方式来帮助你理解这些知识点 💪`;
}

/**
 * 多Agent分析结果
 */
export interface MultiAgentAnalysisResult {
  intent: string;
  original: string;
  correction: string;
  summary: string;
  reviewPassed: boolean;
}

/**
 * 主函数：多Agent协作分析
 */
export async function multiAgentAnalysis(
  config: {
    baseURL: string;
    apiKey: string;
    model: string;
    provider?: string;
    siteUrl?: string;
    siteName?: string;
  },
  note: Note,
  userMessageContent: any[],
  categoryName: string,
  curveName: string,
  curveIntervals: number[],
  onProgress?: (message: string) => void,
  onStream?: (agentId: string, content: string) => void
): Promise<MultiAgentAnalysisResult> {
  const client = createClient(config);

  try {
    // Step 1: 意图分析（带审查和重试）
    onProgress?.('🎯 开始分析用户意图...');
    const intentResult = await analyzeIntentWithReview(
      client,
      config.model,
      [...userMessageContent],
      onProgress,
      onStream
    );

    // 如果经过3次尝试仍未通过审查，返回友善的失败消息
    if (!intentResult.reviewPassed) {
      onProgress?.('⚠️ 意图分析未能通过审查，返回友善提示');
      const failureMessage = generateFriendlyFailureMessage(intentResult.attempts);
      return {
        intent: intentResult.intent,
        original: failureMessage,
        correction: '',
        summary: '',
        reviewPassed: false,
      };
    }

    // Step 2 & 3: 并行分析原始记录和订正答案
    onProgress?.('📝 正在分析原始记录和订正答案...');
    const [originalAnalysis, correctionAnalysis] = await Promise.all([
      analyzeOriginalRecord(
        client,
        config.model,
        intentResult.intent,
        userMessageContent,
        (content) => onStream?.('original', content)
      ),
      analyzeCorrection(
        client,
        config.model,
        intentResult.intent,
        userMessageContent,
        (content) => onStream?.('correction', content)
      ),
    ]);

    onProgress?.('📊 原始记录和订正分析完成');

    // Step 4: 生成总结
    onProgress?.('✨ 正在生成总结报告...');
    const summary = await generateSummary(
      client,
      config.model,
      note,
      intentResult.intent,
      originalAnalysis,
      correctionAnalysis,
      categoryName,
      curveName,
      curveIntervals,
      (content) => onStream?.('summary', content)
    );

    onProgress?.('✅ 分析完成！');

    // 返回每个agent的单独结果
    return {
      intent: intentResult.intent,
      original: originalAnalysis,
      correction: correctionAnalysis,
      summary: summary,
      reviewPassed: intentResult.reviewPassed,
    };
  } catch (error) {
    console.error('Multi-agent analysis failed:', error);
    throw error;
  }
}
