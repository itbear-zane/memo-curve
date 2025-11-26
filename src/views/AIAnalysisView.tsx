import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Brain, Sparkles, Loader2 } from 'lucide-react';
import OpenAI from 'openai';
import { useApp } from '../context/AppContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

const AIAnalysisView = () => {
  const { aiAnalysisNote, setAIAnalysisNote, setView, settings, handleUpdateNote, categories } = useApp();
  const [analysis, setAnalysis] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const analysisRef = useRef<HTMLDivElement>(null);

  const analyzeNote = useCallback(async () => {
    if (!aiAnalysisNote) return;

    setIsLoading(true);
    setError(null);
    setAnalysis('');

    try {
      const { aiConfig } = settings;

      // Check if AI analysis is enabled
      if (!aiConfig.enabled) {
        throw new Error('请先在设置中启用 AI 分析功能');
      }

      // 获取当前提供商的配置
      const currentConfig = aiConfig[aiConfig.provider];

      // Check if API key is configured
      if (!currentConfig.apiKey || currentConfig.apiKey.trim() === '') {
        throw new Error('请先在设置中配置 API 密钥');
      }

      // Check if base URL is configured
      if (!currentConfig.baseURL || currentConfig.baseURL.trim() === '') {
        throw new Error('请先在设置中配置 API URL');
      }

      // Create client with user configuration
      const clientConfig: any = {
        baseURL: currentConfig.baseURL,
        apiKey: currentConfig.apiKey,
        dangerouslyAllowBrowser: true, // Required for browser environment
      };

      // Add OpenRouter specific headers
      if (aiConfig.provider === 'openrouter') {
        const openrouterConfig = aiConfig.openrouter as any;
        clientConfig.defaultHeaders = {};
        if (openrouterConfig.siteUrl) {
          clientConfig.defaultHeaders['HTTP-Referer'] = openrouterConfig.siteUrl;
        }
        if (openrouterConfig.siteName) {
          clientConfig.defaultHeaders['X-Title'] = openrouterConfig.siteName;
        }
      }

      const client = new OpenAI(clientConfig);

      setIsStreaming(true);

      // Get category and curve information
      const category = categories.find(c => c.id === aiAnalysisNote.categoryId);
      const curve = settings.curveProfiles.find(c => c.id === aiAnalysisNote.curveId);

      // Build messages with multimodal support
      const userMessageContent: any[] = [
        {
          type: 'text',
          text: `请分析以下笔记内容：

笔记标题：${aiAnalysisNote.title}
笔记内容：${aiAnalysisNote.content}
分类：${category?.name || '未分类'}
遗忘曲线：${curve?.name || '默认曲线'}${curve ? ` (复习间隔: ${curve.intervals.join(', ')} 天)` : ''}
创建时间：${new Date(aiAnalysisNote.createdAt).toLocaleDateString('zh-CN')}
当前复习阶段：第${aiAnalysisNote.stage}次复习
下次复习时间：${new Date(aiAnalysisNote.nextReviewDate).toLocaleDateString('zh-CN')}`
        }
      ];

      // Add images if present
      if (aiAnalysisNote.images.length > 0) {
        userMessageContent.push({
          type: 'text',
          text: `\n\n笔记中包含以下 ${aiAnalysisNote.images.length} 张图片，请仔细分析图片内容：`
        });
        
        aiAnalysisNote.images.forEach((image) => {
          userMessageContent.push({
            type: 'image_url',
            image_url: {
              url: image,
              detail: 'auto'
            }
          });
        });
      }

//       const system_prompt = `你是一个专业的笔记分析助手,专门帮助高三学生用户分析学习笔记。

// 请分析用户提供的笔记内容,并给出：
// 1. 找出用户的这篇笔记主要是在学习什么，分辨出用户标记的犯错误的地方（即用户拍的这个笔记的错题是哪一道或哪几道，用户没做错的题目不需要分析）。错误的点如果有图片，用户会一般会用红色笔在旁边标注。一篇笔记中，只分析用户重点标注的点；如果没有重点标注才都分析一遍。（简短）
//     1.1 如果笔记中包含图片，请：
//         - 仔细识别和分析图片中的文字、公式、图表等内容
//         - 结合图片内容给出用户犯错的关键点是什么以及如何改正
//         - 指出图片中的重点知识点和易错点
// 2. 针对用户犯错误的地方仔细分析，要非常具体地结合每个题目指出用户犯错的点（可以长一点，逻辑清晰，讲解通顺易懂）
// 3. 针对遗忘曲线和当前第几次复习，如果发现已经过期，则给出复习建议；否则就加粗提醒一下下次复习时间（提醒尽量简洁，列举一下下次复习需要注意的地方）。

// 对于可能的公式，必须用latex格式，以方便渲染为可读性高的公式。
// 请用中文回复，尽可能的简洁。
// 保持专业且非常友好、充满鼓励的语气，鼓励的话只需简短的一两句话，但又切中要害。
// 使用清晰的段落结构，更多地使用表情符号增强可读性。`

      const system_prompt = `1. 用户意图分析：用户拍的这个照片里面，到底是哪道题或哪几道题目做错了。用户本身可能做对了，但是不理解题目，所以也在旁边订正了。错误的点如果有图片，用户会一般会用红色笔在旁边标注。一篇笔记中，只分析用户重点标注的点；如果没有重点标注才都分析一遍。对于选择题，可能是单选或多选，多选可能是半做对--选对了但不全，多选题做对了的选项不需要分析（如果后续选项没用到这个推导时）。

2. 分析用户在旁边坐的原始记录，即用户做题时的记录，看看哪里错了。注意分清楚是原始记录还是看过答案后的笔记。

3. 分析用户在错题旁边订正的答案，这个往往是对的，需要利用好。

4. 给出用户一个总结，一道一道给出这道题为什么做错了，正确的解题思路是什么，以及如何避免犯类似的错误。分析一下这个题目在考题中是否是高频出现，如果很难，比较小众，就告诉用户不用着急；如果容易，则提醒用户着重注意，应该经常复习。

5. 针对遗忘曲线和当前第几次复习，如果发现已经过期，则给出一些压力的话（语气稍重）；否则就加粗提醒一下下次复习时间，提醒尽量简洁。‘第0次复习’意味着今天刚添加的笔记，不需要强调。

整个回复的要求：
1. 请用中文回复，使用清晰的段落结构，更多地使用表情符号增强可读性，尽可能的简洁。
2. 不管是用户手写的公式还是打印的公式，都应该仔细辨别字母和数字，不要把题目都看错了。
3. 保持专业且非常友好、充满鼓励的语气，不需要具体写鼓励的话。
4. 对于可能的公式，必须用latex格式，以方便渲染为可读性高的公式。
`;

      // Create the streaming completion
      const stream = await client.chat.completions.create({
        model: currentConfig.model || 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: system_prompt
          },
          {
            role: 'user',
            content: userMessageContent
          }
        ],
        stream: true,
        max_tokens: 5196,
        temperature: 0.5,
      });

      // Process the stream
      let fullContent = '';
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullContent += content;
          setAnalysis(fullContent);

          // Auto-scroll to bottom
          if (analysisRef.current) {
            analysisRef.current.scrollTop = analysisRef.current.scrollHeight;
          }
        }
      }

      setIsStreaming(false);

      // Save analysis result to database
      try {
        const updatedNote = {
          ...aiAnalysisNote,
          aiAnalysis: {
            content: fullContent,
            generatedAt: Date.now(),
          },
        };
        await handleUpdateNote(updatedNote);
      } catch (saveErr) {
        console.error('保存 AI 分析结果失败:', saveErr);
        // Don't show error to user as the analysis is already displayed
      }
    } catch (err) {
      console.error('AI 分析失败:', err);
      setError(err instanceof Error ? err.message : '分析失败，请检查网络连接和 API 密钥');
      setIsStreaming(false);
    } finally {
      setIsLoading(false);
    }
  }, [aiAnalysisNote, settings, handleUpdateNote]);

  // Use ref to track if analysis has been started for this note
  const hasAnalyzedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!aiAnalysisNote) {
      // 如果没有待分析的笔记,不做任何操作(由handleBack函数处理跳转)
      return;
    }

    // Check if there's a cached analysis result
    if (aiAnalysisNote.aiAnalysis?.content) {
      setAnalysis(aiAnalysisNote.aiAnalysis.content);
      hasAnalyzedRef.current = aiAnalysisNote.id;
    } else if (hasAnalyzedRef.current !== aiAnalysisNote.id) {
      // Only start analysis once when view opens for a new note without cache
      hasAnalyzedRef.current = aiAnalysisNote.id;
      analyzeNote();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiAnalysisNote?.id]);

  const handleBack = () => {
    // 清理AI分析笔记状态
    setAIAnalysisNote(null);
    // 返回到分类页面
    setView('category');
  };

  if (!aiAnalysisNote) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between bg-white">
        <div className="flex items-center gap-3">
          <button onClick={handleBack}>
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <h2 className="font-bold text-lg">AI 笔记分析</h2>
        </div>
        {isStreaming && (
          <div className="flex items-center gap-1 text-sm text-indigo-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>分析中...</span>
          </div>
        )}
      </div>

      {/* Note Info */}
      <div className="bg-white p-4 mx-4 mt-4 rounded-xl shadow-sm border border-gray-100">
        <h2 className="font-bold text-gray-800 text-lg mb-3">{aiAnalysisNote.title}</h2>
        <div className="text-sm text-gray-600 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">创建时间：</span>
            <span>{new Date(aiAnalysisNote.createdAt).toLocaleString('zh-CN')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">复习阶段：</span>
            <span>第 {aiAnalysisNote.stage} 次复习</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">下次复习：</span>
            <span>{new Date(aiAnalysisNote.nextReviewDate).toLocaleDateString('zh-CN')}</span>
          </div>
          {aiAnalysisNote.images.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400">附件：</span>
              <span>包含 {aiAnalysisNote.images.length} 张图片</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 mt-4">
        {isLoading && !analysis && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
            <div className="flex flex-col items-center justify-center text-gray-500">
              <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-600" />
              <p className="font-medium">正在启动 AI 分析...</p>
              <p className="text-xs text-gray-400 mt-2">这可能需要几秒钟</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-red-800 mb-2">
              <Brain className="w-5 h-5" />
              <span className="font-medium">分析失败</span>
            </div>
            <p className="text-red-700 text-sm mb-3">{error}</p>
            <div className="text-xs text-red-600 bg-red-100 rounded-lg p-3">
              <p className="font-medium mb-2">请检查：</p>
              <ul className="list-disc list-inside space-y-1">
                <li>是否在设置中启用了 AI 分析功能</li>
                <li>API 密钥是否正确配置</li>
                <li>API 端点是否正确配置</li>
                <li>网络连接是否正常</li>
                <li>API 密钥是否有足够的额度</li>
              </ul>
            </div>
            <button
              onClick={analyzeNote}
              disabled={isLoading}
              className="mt-4 w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
              <Brain className="w-4 h-4" />
              重试
            </button>
          </div>
        )}

        {analysis && (
          <div className="bg-gradient-to-br from-slate-50/50 via-white to-blue-50/20 rounded-2xl shadow-lg border border-slate-200/60 overflow-hidden backdrop-blur-sm">
            <div className="relative bg-gradient-to-r from-indigo-400 via-purple-400 to-blue-400 p-5 border-b border-indigo-200/30">
              <div className="absolute inset-0 bg-white/10"></div>
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/30 rounded-lg backdrop-blur-sm">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <span className="font-bold text-white text-base">AI 分析结果</span>
                    <p className="text-white/90 text-xs mt-0.5">基于多模态大语言模型生成</p>
                  </div>
                </div>
                {aiAnalysisNote.aiAnalysis?.generatedAt && (
                  <span className="text-xs text-white/90 bg-white/20 px-3 py-1.5 rounded-full backdrop-blur-sm">
                    {new Date(aiAnalysisNote.aiAnalysis.generatedAt).toLocaleString('zh-CN', { 
                      month: 'short', 
                      day: 'numeric', 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                )}
              </div>
            </div>
            <div
              ref={analysisRef}
              className="prose prose-sm max-w-none p-6 text-slate-600 leading-relaxed bg-white/80 prose-headings:text-slate-800 prose-headings:font-bold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-strong:text-slate-800 prose-strong:font-semibold prose-code:text-indigo-600 prose-code:bg-indigo-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-slate-800 prose-pre:text-slate-100 prose-blockquote:border-l-indigo-500 prose-blockquote:text-slate-600 prose-table:text-sm"
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-4">
                      <table className="min-w-full divide-y divide-slate-200 border border-slate-200 rounded-lg">
                        {children}
                      </table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead className="bg-slate-50">{children}</thead>
                  ),
                  tbody: ({ children }) => (
                    <tbody className="bg-white divide-y divide-slate-100">{children}</tbody>
                  ),
                  th: ({ children }) => (
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="px-4 py-2 text-sm text-slate-600">{children}</td>
                  ),
                  code: ({ inline, children, ...props }: any) => {
                    return inline ? (
                      <code className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-sm" {...props}>
                        {children}
                      </code>
                    ) : (
                      <code className="block bg-slate-800 text-slate-100 p-4 rounded-lg overflow-x-auto" {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {analysis}
              </ReactMarkdown>
            </div>
            <div className="p-5 border-t border-slate-200/50 bg-gradient-to-br from-slate-50/30 to-blue-50/20">
              <button
                onClick={analyzeNote}
                disabled={isLoading}
                className="w-full px-5 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 font-medium shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>重新分析中...</span>
                  </>
                ) : (
                  <>
                    <Brain className="w-4 h-4" />
                    <span>重新分析</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {!isLoading && !analysis && !error && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
            <div className="text-center text-gray-500">
              <Brain className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="font-medium">准备开始分析</p>
              <p className="text-sm text-gray-400 mt-2">点击下方按钮开始 AI 分析</p>
              <button
                onClick={analyzeNote}
                className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-2 mx-auto"
              >
                <Brain className="w-4 h-4" />
                开始分析
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Info */}
      <div className="text-center text-xs text-gray-400 mt-6 px-4">
        <p>由 AI 提供智能分析</p>
      </div>
    </div>
  );
};

export default AIAnalysisView;
