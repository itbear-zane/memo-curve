import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Brain, Sparkles, Loader2 } from 'lucide-react';
import OpenAI from 'openai';
import { useApp } from '../context/AppContext';

const AIAnalysisView = () => {
  const { aiAnalysisNote, setView, settings, handleUpdateNote } = useApp();
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

      // Check if API key is configured
      if (!aiConfig.apiKey || aiConfig.apiKey.trim() === '') {
        throw new Error('请先在设置中配置 API 密钥');
      }

      // Check if base URL is configured
      if (!aiConfig.baseURL || aiConfig.baseURL.trim() === '') {
        throw new Error('请先在设置中配置 API URL');
      }

      // Create client with user configuration
      const client = new OpenAI({
        baseURL: aiConfig.baseURL,
        apiKey: aiConfig.apiKey,
        dangerouslyAllowBrowser: true, // Required for browser environment
      });

      setIsStreaming(true);

      // Create the streaming completion
      const stream = await client.chat.completions.create({
        model: aiConfig.model || 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `你是一个专业的笔记分析助手,专门帮助高三学生用户分析学习笔记。

请分析用户提供的笔记内容,并给出：
1. 主要学习主题和关键词
2. 学习建议和改进方向
3. 复习计划建议（基于艾宾浩斯遗忘曲线）
4. 相关知识点扩展建议

请用中文回复，保持专业且友好的语气。使用清晰的段落结构，适当使用表情符号增强可读性。`
          },
          {
            role: 'user',
            content: `请分析以下笔记内容：

笔记标题：${aiAnalysisNote.title}
笔记内容：${aiAnalysisNote.content}
${aiAnalysisNote.images.length > 0 ? `包含 ${aiAnalysisNote.images.length} 张图片` : ''}
创建时间：${new Date(aiAnalysisNote.createdAt).toLocaleDateString('zh-CN')}
当前复习阶段：第${aiAnalysisNote.stage}次复习
下次复习时间：${new Date(aiAnalysisNote.nextReviewDate).toLocaleDateString('zh-CN')}`
          }
        ],
        stream: true,
        max_tokens: 200,
        temperature: 0.7,
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
      setView('dashboard');
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

  const formatAnalysisText = (text: string) => {
    // Add line breaks and formatting
    return text
      .replace(/\n\n/g, '<br/><br/>')
      .replace(/\n/g, '<br/>')
      .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
      .replace(/_(.*?)_/g, '<em>$1</em>');
  };

  const handleBack = () => {
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
              className="prose prose-sm max-w-none p-6 text-slate-600 leading-relaxed bg-white/80"
              style={{ 
                lineHeight: '1.8',
                fontSize: '0.9375rem'
              }}
              dangerouslySetInnerHTML={{ __html: formatAnalysisText(analysis) }}
            />
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
