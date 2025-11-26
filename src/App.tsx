import { RotateCw, X } from 'lucide-react';
import { useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';

// Views
import Dashboard from './views/Dashboard';
import AddNote from './views/AddNote';
import ReviewSession from './views/ReviewSession';
import SettingsView from './views/SettingsView';
import CategoryManager from './views/CategoryManager';
import AIAnalysisView from './views/AIAnalysisView';
import AuthView from './views/AuthView';

// Components
import NavBar from './components/NavBar';
import AnalyticsModal from './components/AnalyticsModal';

const MainLayout = () => {
  const { loading, view, toast, showAnalytics, setShowAnalytics, previewImage, setPreviewImage, showAuthModal, setShowAuthModal, aiAnalysisNote, setAIAnalysisNote, setView: appSetView, onAuthModalClose, settings, saveSettingsToDB } = useApp();
  const { loading: authLoading, isAuthenticated } = useAuth();

  // 当用户登录成功后,如果有待分析的笔记,自动启用AI功能并跳转到 AI 分析页面
  useEffect(() => {
    if (isAuthenticated && aiAnalysisNote) {
      // 关闭登录弹窗(如果打开着)
      if (showAuthModal) {
        setShowAuthModal(false);
      }
      
      // 如果AI功能未启用,自动启用
      if (!settings.aiConfig.enabled) {
        const newAiConfig = { ...settings.aiConfig, enabled: true };
        saveSettingsToDB({ ...settings, aiConfig: newAiConfig });
      }
      
      // 跳转到 AI 分析页面
      appSetView('ai-analysis');
    }
  }, [isAuthenticated, aiAnalysisNote, showAuthModal, settings, setShowAuthModal, appSetView, saveSettingsToDB]);

  // 如果认证正在加载或应用正在加载,显示加载界面
  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-indigo-600">
        <RotateCw className="w-10 h-10 animate-spin mb-4" />
        <p className="font-bold">正在从本地数据库加载...</p>
        <p className="text-xs text-gray-400 mt-2">支持海量存储模式</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 relative overflow-hidden font-sans text-slate-900">
      {/* Global Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full shadow-lg z-[60] text-white text-sm animate-in fade-in slide-in-from-top-2 ${toast.type === 'error' ? 'bg-red-500' : 'bg-gray-800'}`}>
          {toast.msg}
        </div>
      )}

      {/* Routes */}
      {view === 'dashboard' && <Dashboard />}
      {view === 'add' && <AddNote />}
      {view === 'review' && <ReviewSession />}
      {view === 'settings' && <SettingsView />}
      {view === 'category' && <CategoryManager />}
      {view === 'ai-analysis' && <AIAnalysisView />}

      {/* Modals */}
      {showAnalytics && <AnalyticsModal onClose={() => setShowAnalytics(false)} />}

      {/* 登录弹窗 */}
      {showAuthModal && (
        <AuthView 
          isModal={true} 
          onClose={() => {
            setShowAuthModal(false);
            // 如果用户未登录就关闭弹窗,清理待分析的笔记
            if (!isAuthenticated && aiAnalysisNote) {
              setAIAnalysisNote(null);
            }
            // 如果有自定义的关闭回调，执行它
            if (onAuthModalClose) {
              onAuthModalClose();
            }
          }}
        />
      )}

      {previewImage && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70]" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <img src={previewImage} className="max-w-full max-h-full object-contain" alt="预览图片" />
            <button onClick={() => setPreviewImage(null)} className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition"><X className="w-6 h-6" /></button>
          </div>
        </div>
      )}

      {/* NavBar (Only show on certain views) */}
      {(view === 'dashboard' || view === 'settings' || view === 'category') && <NavBar />}
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <MainLayout />
      </AppProvider>
    </AuthProvider>
  );
}