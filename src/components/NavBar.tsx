import { BookOpen, Plus, Settings } from 'lucide-react';
import { useApp } from '../context/AppContext';

const NavBar = () => {
  const { view, setView } = useApp();
  
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-3 text-xs text-gray-500 z-50 pb-safe">
      <button
        onClick={() => setView('dashboard')}
        className={`flex flex-col items-center gap-1 ${view === 'dashboard' ? 'text-indigo-600 font-bold' : ''}`}
      >
        <BookOpen className="w-6 h-6" />
        首页
      </button>

      <button
        onClick={() => setView('add')}
        className="flex flex-col items-center gap-1 -mt-6"
      >
        <div className="bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:scale-105 transition">
          <Plus className="w-6 h-6" />
        </div>
      </button>

      <button
        onClick={() => setView('settings')}
        className={`flex flex-col items-center gap-1 ${view === 'settings' ? 'text-indigo-600 font-bold' : ''}`}
      >
        <Settings className="w-6 h-6" />
        设置
      </button>
    </div>
  );
};

export default NavBar;