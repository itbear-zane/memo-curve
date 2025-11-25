import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Brain, Sparkles, Loader2 } from 'lucide-react';
import type { Note } from '../types';
import OpenAI from 'openai';
import { useApp } from '../context/AppContext';

interface AIAnalysisModalProps {
  note: Note;
  onClose: () => void;
}


const AIAnalysisModal = ({ note, onClose }: AIAnalysisModalProps) => {
  const [analysis, setAnalysis] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const analysisRef = useRef<HTMLDivElement>(null);

  const { settings } = useApp();

  const analyzeNote = useCallback(async () => {
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

笔记标题：${note.title}
笔记内容：${note.content}
${note.images.length > 0 ? `包含 ${note.images.length} 张图片` : ''}
创建时间：${new Date(note.createdAt).toLocaleDateString('zh-CN')}
当前复习阶段：第${note.stage}次复习
下次复习时间：${new Date(note.nextReviewDate).toLocaleDateString('zh-CN')}`
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
    } catch (err) {
      console.error('AI 分析失败:', err);
      setError(err instanceof Error ? err.message : '分析失败，请检查网络连接和 API 密钥');
      setIsStreaming(false);
    } finally {
      setIsLoading(false);
    }
  }, [note.content, note.createdAt, note.images.length, note.nextReviewDate, note.stage, note.title, settings]);

  // Use ref to track if analysis has been started for this note
  const hasAnalyzedRef = useRef<string | null>(null);

  useEffect(() => {
    // Only start analysis once when modal opens for a new note
    if (hasAnalyzedRef.current !== note.id) {
      hasAnalyzedRef.current = note.id;
      analyzeNote();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  const formatAnalysisText = (text: string) => {
    // Add line breaks and formatting
    return text
      .replace(/\n\n/g, '<br/><br/>')
      .replace(/\n/g, '<br/>')
      .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
      .replace(/_(.*?)_/g, '<em>$1</em>');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Brain className="w-6 h-6 text-blue-600" />
            <h3 className="font-bold text-lg">AI 笔记分析</h3>
            {isStreaming && (
              <div className="flex items-center gap-1 text-sm text-blue-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>分析中...</span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Note Info */}
        <div className="p-4 border-b bg-gray-50">
          <h4 className="font-semibold text-gray-800 mb-2">{note.title}</h4>
          <div className="text-sm text-gray-600 space-y-1">
            <div>创建时间：{new Date(note.createdAt).toLocaleString('zh-CN')}</div>
            <div>复习阶段：第{note.stage}次复习</div>
            <div>下次复习：{new Date(note.nextReviewDate).toLocaleDateString('zh-CN')}</div>
            {note.images.length > 0 && (
              <div>包含 {note.images.length} 张图片</div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {isLoading && !analysis && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-600" />
              <p>正在启动 AI 分析...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-800 mb-2">
                <X className="w-5 h-5" />
                <span className="font-medium">分析失败</span>
              </div>
              <p className="text-red-700 text-sm">{error}</p>
              <div className="mt-3 text-xs text-red-600">
                <p>请检查：</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>是否在设置中启用了 AI 分析功能</li>
                  <li>API 密钥是否正确配置</li>
                  <li>API 端点是否正确配置</li>
                  <li>网络连接是否正常</li>
                  <li>API 密钥是否有足够的额度</li>
                </ul>
              </div>
            </div>
          )}

          {analysis && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-blue-600">
                <Sparkles className="w-5 h-5" />
                <span className="font-medium">AI 分析结果</span>
              </div>
              <div
                ref={analysisRef}
                className="prose prose-sm max-w-none bg-blue-50 rounded-lg p-4 border border-blue-200"
                dangerouslySetInnerHTML={{ __html: formatAnalysisText(analysis) }}
              />
            </div>
          )}

          {!isLoading && !analysis && !error && (
            <div className="text-center py-12 text-gray-500">
              <Brain className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p>点击分析按钮开始 AI 分析</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex justify-between items-center">
          <div className="text-sm text-gray-500">
            由 AI 提供分析
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition"
            >
              关闭
            </button>
            {(error || !isLoading) && (
              <button
                onClick={analyzeNote}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    重新分析
                  </>
                ) : (
                  <>
                    <Brain className="w-4 h-4" />
                    重新分析
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAnalysisModal;