import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Brain, Sparkles, Loader2, CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { multiAgentAnalysis } from '../utils/multiAgentService';
import type { MultiAgentAnalysisResult } from '../types';

interface AnalysisStep {
  id: string;
  title: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message?: string;
  timestamp?: number;
  streamContent?: string;  // 流式输出内容
}

const AIAnalysisView = () => {
  const { aiAnalysisNote, setAIAnalysisNote, setView, settings, handleUpdateNote, categories } = useApp();
  const [analysis, setAnalysis] = useState<MultiAgentAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [analysisSteps, setAnalysisSteps] = useState<AnalysisStep[]>([]);
  const [streamingContent, setStreamingContent] = useState<Record<string, string>>({});
  const analysisRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);

  const analyzeNote = useCallback(async () => {
    if (!aiAnalysisNote) return;

    setIsLoading(true);
    setError(null);
    setAnalysis(null);
    setProgressMessage('');
    setStreamingContent({});
    
    // 初始化分析步骤
    const initialSteps: AnalysisStep[] = [
      { id: 'intent', title: '🎯 用户意图分析', status: 'pending' },
      { id: 'review', title: '📋 意图审查', status: 'pending' },
      { id: 'original', title: '📝 原始记录分析', status: 'pending' },
      { id: 'correction', title: '✅ 订正答案分析', status: 'pending' },
      { id: 'summary', title: '✨ 生成总结报告', status: 'pending' },
    ];
    setAnalysisSteps(initialSteps);

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
          text: `\n\n笔记中包含以下 ${aiAnalysisNote.images.length} 张图片：`
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

      // Prepare config for multi-agent analysis
      const analysisConfig = {
        baseURL: currentConfig.baseURL,
        apiKey: currentConfig.apiKey,
        model: currentConfig.model || 'deepseek-chat',
        provider: aiConfig.provider,
      };

      // Add OpenRouter specific configs
      if (aiConfig.provider === 'openrouter') {
        const openrouterConfig = aiConfig.openrouter as any;
        (analysisConfig as any).siteUrl = openrouterConfig.siteUrl;
        (analysisConfig as any).siteName = openrouterConfig.siteName;
      }

      // Use multi-agent analysis
      const result = await multiAgentAnalysis(
        analysisConfig,
        aiAnalysisNote,
        userMessageContent,
        category?.name || '未分类',
        curve?.name || '默认曲线',
        curve?.intervals || [],
        (message) => {
          setProgressMessage(message);
          
          // 更新步骤状态
          setAnalysisSteps(prev => {
            const updated = [...prev];
            
            // 根据消息更新对应步骤的状态
            if (message.includes('意图分析')) {
              const intentIdx = updated.findIndex(s => s.id === 'intent');
              if (intentIdx !== -1) {
                updated[intentIdx] = {
                  ...updated[intentIdx],
                  status: message.includes('完成') ? 'completed' : 'processing',
                  message: message,
                  timestamp: Date.now(),
                };
              }
            } else if (message.includes('审查')) {
              const reviewIdx = updated.findIndex(s => s.id === 'review');
              if (reviewIdx !== -1) {
                updated[reviewIdx] = {
                  ...updated[reviewIdx],
                  status: message.includes('通过') ? 'completed' : message.includes('未通过') ? 'failed' : 'processing',
                  message: message,
                  timestamp: Date.now(),
                };
              }
            } else if (message.includes('原始记录') && message.includes('订正')) {
              // 开始并行分析原始记录和订正答案
              const originalIdx = updated.findIndex(s => s.id === 'original');
              const correctionIdx = updated.findIndex(s => s.id === 'correction');
              if (originalIdx !== -1) {
                updated[originalIdx] = {
                  ...updated[originalIdx],
                  status: 'processing',
                  message: '正在分析原始记录...',
                  timestamp: Date.now(),
                };
              }
              if (correctionIdx !== -1) {
                updated[correctionIdx] = {
                  ...updated[correctionIdx],
                  status: 'processing',
                  message: '正在分析订正答案...',
                  timestamp: Date.now(),
                };
              }
            } else if (message.includes('原始记录') && message.includes('完成')) {
              // 原始记录和订正分析完成
              const originalIdx = updated.findIndex(s => s.id === 'original');
              const correctionIdx = updated.findIndex(s => s.id === 'correction');
              if (originalIdx !== -1) {
                updated[originalIdx] = {
                  ...updated[originalIdx],
                  status: 'completed',
                  message: message,
                  timestamp: Date.now(),
                };
              }
              if (correctionIdx !== -1) {
                updated[correctionIdx] = {
                  ...updated[correctionIdx],
                  status: 'completed',
                  message: '订正答案分析完成',
                  timestamp: Date.now(),
                };
              }
            } else if (message.includes('总结')) {
              const summaryIdx = updated.findIndex(s => s.id === 'summary');
              if (summaryIdx !== -1) {
                updated[summaryIdx] = {
                  ...updated[summaryIdx],
                  status: message.includes('完成') ? 'completed' : 'processing',
                  message: message,
                  timestamp: Date.now(),
                };
              }
            }
            
            return updated;
          });
          
          // Auto-scroll steps to bottom
          if (stepsRef.current) {
            stepsRef.current.scrollTop = stepsRef.current.scrollHeight;
          }
        },
        (agentId, content) => {
          // 处理agent stream输出到AI分析结果模块
          setStreamingContent(prev => ({
            ...prev,
            [agentId]: content
          }));
          
          setAnalysisSteps(prev => {
            const updated = [...prev];
            const idx = updated.findIndex(s => s.id === agentId);
            if (idx !== -1) {
              updated[idx] = {
                ...updated[idx],
                status: 'processing',
              };
            }
            return updated;
          });
          
          // Auto-scroll to bottom
          if (analysisRef.current) {
            analysisRef.current.scrollTop = analysisRef.current.scrollHeight;
          }
        }
      );

      // 流式输出完成后，确保所有步骤都标记为完成
      setAnalysisSteps(prev => {
        return prev.map(step => {
          if (step.status === 'processing') {
            return { ...step, status: 'completed' };
          }
          return step;
        });
      });

      setAnalysis(result);
      setIsStreaming(false);
      setProgressMessage('');

      // Save analysis result to database
      try {
        const updatedNote = {
          ...aiAnalysisNote,
          aiAnalysis: {
            content: result,
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
      setProgressMessage('');
    } finally {
      setIsLoading(false);
    }
  }, [aiAnalysisNote, settings, handleUpdateNote, categories]);

  // Use ref to track if analysis has been started for this note
  const hasAnalyzedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!aiAnalysisNote) {
      // 如果没有待分析的笔记,不做任何操作(由handleBack函数处理跳转)
      return;
    }

    // Check if there's a cached analysis result
    if (aiAnalysisNote.aiAnalysis?.content) {
      // 检查content是否为对象类型(新格式)
      if (typeof aiAnalysisNote.aiAnalysis.content === 'object') {
        setAnalysis(aiAnalysisNote.aiAnalysis.content);
      } else {
        // 如果是旧的string类型,则重新分析
        hasAnalyzedRef.current = null;
      }
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
          <div className="flex items-center gap-2 text-sm text-indigo-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{progressMessage || '分析中...'}</span>
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
        {/* 分析流程展示 */}
        {(isLoading || analysisSteps.length > 0) && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-4 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Brain className="w-4 h-4 text-indigo-600" />
                分析流程
              </h3>
            </div>
            <div ref={stepsRef} className="p-4 space-y-3 max-h-96 overflow-y-auto">
              {analysisSteps.map((step) => (
                <div key={step.id} className="flex gap-3 items-start">
                  <div className="flex-shrink-0 mt-0.5">
                    {step.status === 'completed' && (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    )}
                    {step.status === 'processing' && (
                      <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                    )}
                    {step.status === 'failed' && (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                    {step.status === 'pending' && (
                      <Circle className="w-5 h-5 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium text-sm ${
                        step.status === 'completed' ? 'text-green-700' :
                        step.status === 'processing' ? 'text-indigo-700' :
                        step.status === 'failed' ? 'text-red-700' :
                        'text-gray-400'
                      }`}>
                        {step.title}
                      </span>
                      {step.timestamp && (
                        <span className="text-xs text-gray-400">
                          {new Date(step.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      )}
                    </div>
                    {step.message && (
                      <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{step.message}</p>
                    )}
                  </div>
                </div>
              ))}
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

        {(analysis || Object.keys(streamingContent).length > 0) && (
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
              className="prose prose-sm max-w-none p-6 text-slate-600 leading-relaxed bg-white/80 prose-headings:text-slate-800 prose-headings:font-bold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-strong:text-slate-800 prose-strong:font-semibold prose-code:text-indigo-600 prose-code:bg-indigo-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-slate-800 prose-pre:text-slate-100 prose-blockquote:border-l-indigo-500 prose-blockquote:text-slate-600 prose-table:text-sm max-h-[600px] overflow-y-auto [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:max-w-full [&_.katex]:text-sm [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_table]:overflow-x-auto [&_table]:block [&_table]:max-w-full"
            >
              {/* 显示流式输出内容 */}
              {isStreaming && (
                <div className="space-y-6">
                  {streamingContent.intent && (
                    <div className="p-4 rounded-lg bg-blue-50/50 border border-blue-100">
                      <h2 className="!text-lg !font-bold !mb-3 flex items-center gap-2 !text-blue-800">
                        🎯 意图识别
                        {analysisSteps.find(s => s.id === 'intent')?.status === 'processing' && (
                          <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                        )}
                      </h2>
                      <div className="prose-headings:!text-blue-800 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:max-w-full [&_.katex]:text-sm [&_pre]:overflow-x-auto [&_pre]:max-w-full">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                        >
                          {streamingContent.intent}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                  
                  {streamingContent.intent && streamingContent.review && (
                    <hr className="my-6 border-slate-200" />
                  )}
                  
                  {streamingContent.review && (
                    <div className="p-4 rounded-lg bg-green-50/50 border border-green-100">
                      <h2 className="!text-lg !font-bold !mb-3 flex items-center gap-2 !text-green-800">
                        📋 意图审查
                        {analysisSteps.find(s => s.id === 'review')?.status === 'processing' && (
                          <Loader2 className="w-4 h-4 text-green-600 animate-spin" />
                        )}
                      </h2>
                      <div className="prose-headings:!text-green-800 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:max-w-full [&_.katex]:text-sm [&_pre]:overflow-x-auto [&_pre]:max-w-full">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                        >
                          {streamingContent.review}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                  
                  {streamingContent.review && streamingContent.original && (
                    <hr className="my-6 border-slate-200" />
                  )}
                  
                  {streamingContent.original && (
                    <div className="p-4 rounded-lg bg-amber-50/50 border border-amber-100">
                      <h2 className="!text-lg !font-bold !mb-3 flex items-center gap-2 !text-amber-800">
                        📝 原始记录分析
                        {analysisSteps.find(s => s.id === 'original')?.status === 'processing' && (
                          <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />
                        )}
                      </h2>
                      <div className="prose-headings:!text-amber-800 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:max-w-full [&_.katex]:text-sm [&_pre]:overflow-x-auto [&_pre]:max-w-full">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                        >
                          {streamingContent.original}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                  
                  {streamingContent.original && streamingContent.correction && (
                    <hr className="my-6 border-slate-200" />
                  )}
                  
                  {streamingContent.correction && (
                    <div className="p-4 rounded-lg bg-emerald-50/50 border border-emerald-100">
                      <h2 className="!text-lg !font-bold !mb-3 flex items-center gap-2 !text-emerald-800">
                        ✅ 订正解析
                        {analysisSteps.find(s => s.id === 'correction')?.status === 'processing' && (
                          <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                        )}
                      </h2>
                      <div className="prose-headings:!text-emerald-800 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:max-w-full [&_.katex]:text-sm [&_pre]:overflow-x-auto [&_pre]:max-w-full">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                        >
                          {streamingContent.correction}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                  
                  {streamingContent.correction && streamingContent.summary && (
                    <hr className="my-6 border-slate-200" />
                  )}
                  
                  {streamingContent.summary && (
                    <div className="p-4 rounded-lg bg-purple-50/50 border border-purple-100">
                      <h2 className="!text-lg !font-bold !mb-3 flex items-center gap-2 !text-purple-800">
                        💡 整体总结
                        {analysisSteps.find(s => s.id === 'summary')?.status === 'processing' && (
                          <Loader2 className="w-4 h-4 text-purple-600 animate-spin" />
                        )}
                      </h2>
                      <div className="prose-headings:!text-purple-800 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:max-w-full [&_.katex]:text-sm [&_pre]:overflow-x-auto [&_pre]:max-w-full">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                        >
                          {streamingContent.summary}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* 显示最终结果 - 复用流式输出的样式 */}
              {!isStreaming && analysis && (
                <div className="space-y-6">
                  <div className="p-4 rounded-lg bg-blue-50/50 border border-blue-100">
                    <h2 className="!text-lg !font-bold !mb-3 !text-blue-800">
                      🎯 意图识别
                    </h2>
                    <div className="prose-headings:!text-blue-800 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:max-w-full [&_.katex]:text-sm [&_pre]:overflow-x-auto [&_pre]:max-w-full">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                      >
                        {analysis.intent}
                      </ReactMarkdown>
                    </div>
                  </div>
                  
                  <hr className="my-6 border-slate-200" />
                  
                  <div className="p-4 rounded-lg bg-amber-50/50 border border-amber-100">
                    <h2 className="!text-lg !font-bold !mb-3 !text-amber-800">
                      📝 原始记录分析
                    </h2>
                    <div className="prose-headings:!text-amber-800 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:max-w-full [&_.katex]:text-sm [&_pre]:overflow-x-auto [&_pre]:max-w-full">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                      >
                        {analysis.original}
                      </ReactMarkdown>
                    </div>
                  </div>
                  
                  <hr className="my-6 border-slate-200" />
                  
                  <div className="p-4 rounded-lg bg-emerald-50/50 border border-emerald-100">
                    <h2 className="!text-lg !font-bold !mb-3 !text-emerald-800">
                      ✅ 订正解析
                    </h2>
                    <div className="prose-headings:!text-emerald-800 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:max-w-full [&_.katex]:text-sm [&_pre]:overflow-x-auto [&_pre]:max-w-full">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                      >
                        {analysis.correction}
                      </ReactMarkdown>
                    </div>
                  </div>
                  
                  <hr className="my-6 border-slate-200" />
                  
                  <div className="p-4 rounded-lg bg-purple-50/50 border border-purple-100">
                    <h2 className="!text-lg !font-bold !mb-3 !text-purple-800">
                      💡 总结建议
                    </h2>
                    <div className="prose-headings:!text-purple-800 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:max-w-full [&_.katex]:text-sm [&_pre]:overflow-x-auto [&_pre]:max-w-full">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                      >
                        {analysis.summary}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}
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
