import { RotateCw, X } from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';

// Views
import Dashboard from './views/Dashboard';
import AddNote from './views/AddNote';
import ReviewSession from './views/ReviewSession';
import SettingsView from './views/SettingsView';
import CategoryManager from './views/CategoryManager';

// Components
import NavBar from './components/NavBar';
import AnalyticsModal from './components/AnalyticsModal';

const MainLayout = () => {
  const { loading, view, toast, showAnalytics, setShowAnalytics, previewImage, setPreviewImage } = useApp();

  if (loading) {
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

      {/* Modals */}
      {showAnalytics && <AnalyticsModal onClose={() => setShowAnalytics(false)} />}

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
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}