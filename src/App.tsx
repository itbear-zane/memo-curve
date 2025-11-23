import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  Plus,
  Settings,
  RotateCw,
  X,
  Trash2,
  BarChart,
  ArrowLeft,
  TrendingUp,
  Save,
  Edit3,
  Clock,
  HardDrive,
  Download,
  Upload
} from 'lucide-react';

// --- 1. IndexedDB Utility Layer (No external deps) ---

const DB_NAME = 'MemoCurveDB';
const DB_VERSION = 1;
const STORE_NOTES = 'notes';
const STORE_CATS = 'categories';
const STORE_SETTINGS = 'settings';

// 使用标准方法定义以避免TSX泛型解析错误
const dbHelper = {
  db: null as IDBDatabase | null,

  init() {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NOTES)) db.createObjectStore(STORE_NOTES, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(STORE_CATS)) db.createObjectStore(STORE_CATS, { keyPath: 'id' });
        // Settings is a singleton object, we'll use a fixed key 'appSettings' or just store/put
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) db.createObjectStore(STORE_SETTINGS);
      };
      request.onsuccess = (event: any) => {
        dbHelper.db = event.target.result;
        // Try to ask for persistent storage
        if (navigator.storage && navigator.storage.persist) {
          navigator.storage.persist().then(granted => {
            console.log(granted ? "Storage will not be cleared except by explicit user action" : "Storage may be cleared by the UA under storage pressure.");
          });
        }
        resolve();
      };
      request.onerror = (e) => reject(e);
    });
  },

  async getAll<T>(storeName: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      if (!dbHelper.db) return reject('DB not init');
      const transaction = dbHelper.db.transaction([storeName], 'readonly');
      const request = transaction.objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async get<T>(storeName: string, key: string): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      if (!dbHelper.db) return reject('DB not init');
      const transaction = dbHelper.db.transaction([storeName], 'readonly');
      const request = transaction.objectStore(storeName).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async put(storeName: string, data: any, key?: string) {
    return new Promise<void>((resolve, reject) => {
      if (!dbHelper.db) return reject('DB not init');
      const transaction = dbHelper.db.transaction([storeName], 'readwrite');
      const request = key ? transaction.objectStore(storeName).put(data, key) : transaction.objectStore(storeName).put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async delete(storeName: string, key: string) {
    return new Promise<void>((resolve, reject) => {
      if (!dbHelper.db) return reject('DB not init');
      const transaction = dbHelper.db.transaction([storeName], 'readwrite');
      const request = transaction.objectStore(storeName).delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async clearStore(storeName: string) {
    return new Promise<void>((resolve, reject) => {
        if (!dbHelper.db) return reject('DB not init');
        const transaction = dbHelper.db.transaction([storeName], 'readwrite');
        const request = transaction.objectStore(storeName).clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
  }
};

// --- Types & Constants ---

type CurveProfile = {
  id: string;
  name: string;
  intervals: number[]; 
  isDefault?: boolean; 
};

type Note = {
  id: string;
  categoryId: string;
  curveId: string; 
  title: string;
  content: string;
  images: string[]; 
  createdAt: number;
  nextReviewDate: number;
  stage: number; 
  reviewHistory: { date: number; action: 'remembered' | 'forgot' }[];
};

type Category = {
  id: string;
  name: string;
  color: string;
};

type AppSettings = {
  curveProfiles: CurveProfile[];
  enableNotifications: boolean;
};

const DEFAULT_CURVES: CurveProfile[] = [
  { id: 'curve_std', name: '标准艾宾浩斯', intervals: [0.02, 1, 2, 4, 7, 15, 30, 60, 120], isDefault: true },
  { id: 'curve_exam', name: '短期突击模式', intervals: [0.02, 0.5, 1, 2, 3, 5, 8, 14], isDefault: true },
  { id: 'curve_slow', name: '长期稳固模式', intervals: [1, 3, 7, 14, 30, 60, 90, 180, 360], isDefault: true }
];

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat_1', name: '英语单词', color: 'bg-blue-100 text-blue-800' },
  { id: 'cat_2', name: '数学', color: 'bg-purple-100 text-purple-800' },
  { id: 'cat_3', name: '化学', color: 'bg-green-100 text-green-800' },
];

// --- Helper Functions ---

const generateId = () => Math.random().toString(36).substr(2, 9);

const getRelativeTime = (timestamp: number) => {
  const diff = timestamp - Date.now();
  const diffDays = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (diff < 0) return '已过期';
  if (diffDays <= 0) return '今天';
  if (diffDays === 1) return '明天';
  return `${diffDays}天后`;
};

// Compress image to avoid massive blobs if user uploads 4k photos
const compressImage = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800; // Limit width
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7)); // Compress quality
            };
        };
    });
};

// --- Components ---

export default function App() {
  // --- State ---
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Note[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [settings, setSettings] = useState<AppSettings>({
    curveProfiles: DEFAULT_CURVES,
    enableNotifications: false,
  });

  const [view, setView] = useState<'dashboard' | 'add' | 'review' | 'settings' | 'category'>('dashboard');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);


  // --- Initialization & Migration Logic ---
  useEffect(() => {
    const init = async () => {
      try {
        await dbHelper.init();

        // 1. Check IndexedDB first
        const dbNotes = await dbHelper.getAll<Note>(STORE_NOTES);
        const dbCats = await dbHelper.getAll<Category>(STORE_CATS);
        const dbSettings = await dbHelper.get<AppSettings>(STORE_SETTINGS, 'config');

        // 2. Migration Check: If IDB is empty but localStorage has data (First run after update)
        const lsNotes = localStorage.getItem('memo_notes');
        if (dbNotes.length === 0 && lsNotes) {
            console.log("Migrating from LocalStorage to IndexedDB...");
            const parsedNotes = JSON.parse(lsNotes);
            const parsedCats = JSON.parse(localStorage.getItem('memo_cats') || '[]');
            const parsedSettings = JSON.parse(localStorage.getItem('memo_settings') || '{}');

            // Batch save to IDB
            for (const n of parsedNotes) await dbHelper.put(STORE_NOTES, n);
            for (const c of parsedCats) await dbHelper.put(STORE_CATS, c);
            if (parsedSettings) await dbHelper.put(STORE_SETTINGS, parsedSettings, 'config');

            // Load from LS data
            setNotes(parsedNotes);
            if (parsedCats.length) setCategories(parsedCats);
            if (parsedSettings.curveProfiles) setSettings(parsedSettings);

            // Optional: Clear LS after successful migration?
            // localStorage.removeItem('memo_notes'); // Keeping it for safety for now or user manual clear
            showToast("数据已升级到大容量存储");
        } else {
            // Normal Load
            setNotes(dbNotes);
            if (dbCats.length > 0) setCategories(dbCats);
            if (dbSettings) setSettings(prev => ({...prev, ...dbSettings}));
        }
      } catch (e) {
        console.error("DB Init Failed", e);
        showToast("数据库初始化失败", 'error');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  // --- Data Persistence Handlers ---
  // Unlike localStorage (sync), IDB is async. We don't want to save on every keypress strictly, 
  // but for simplicity in React, we will trigger saves when state changes.
  // In a production app, we might debounce this or use specific actions.

  const saveNoteToDB = async (note: Note) => {
      await dbHelper.put(STORE_NOTES, note);
      setNotes(prev => {
          const exists = prev.find(n => n.id === note.id);
          if (exists) return prev.map(n => n.id === note.id ? note : n);
          return [...prev, note];
      });
  };

  const deleteNoteFromDB = async (id: string) => {
      await dbHelper.delete(STORE_NOTES, id);
      setNotes(prev => prev.filter(n => n.id !== id));
  };

  
  const saveSettingsToDB = async (newSettings: AppSettings) => {
      setSettings(newSettings);
      await dbHelper.put(STORE_SETTINGS, newSettings, 'config');
  };

  // Notification Check
  useEffect(() => {
    if (settings.enableNotifications && !loading) {
      const dueCount = notes.filter(n => n.nextReviewDate <= Date.now()).length;
      if (dueCount > 0 && Notification.permission === 'granted') {
        const timer = setTimeout(() => {
           new Notification('复习提醒', { body: `你有 ${dueCount} 条笔记需要现在复习！` });
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [notes, settings.enableNotifications, loading]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // --- Logic ---

  const dueNotes = notes.filter(n => n.nextReviewDate <= Date.now()).sort((a, b) => a.nextReviewDate - b.nextReviewDate);

  const handleAddNote = async (noteData: Omit<Note, 'id' | 'createdAt' | 'nextReviewDate' | 'stage' | 'reviewHistory'>) => {
    const newNote: Note = {
      ...noteData,
      id: generateId(),
      createdAt: Date.now(),
      nextReviewDate: Date.now(),
      stage: 0,
      reviewHistory: []
    };
    await saveNoteToDB(newNote);
    showToast('笔记已保存');
    // Clear saved form state after successful save
    sessionStorage.removeItem('addNoteFormState');
    setView('dashboard');
  };

  const handleUpdateNote = async (updatedNote: Note) => {
    await saveNoteToDB(updatedNote);
    showToast('笔记已更新');
  };

  const handleDeleteNote = async (id: string) => {
    if (confirm('确定要删除这条笔记吗？')) {
      await deleteNoteFromDB(id);
      showToast('笔记已删除');
    }
  };

  const handleReview = async (note: Note, result: 'remembered' | 'forgot') => {
    let newStage = note.stage;
    let nextDate = Date.now();

    const curve = settings.curveProfiles.find(c => c.id === note.curveId) || settings.curveProfiles[0];
    const intervals = curve.intervals;

    if (result === 'remembered') {
      newStage = note.stage + 1;
      const intervalDays = intervals[newStage] !== undefined
        ? intervals[newStage]
        : (intervals[intervals.length - 1] * 2);

      nextDate = Date.now() + (intervalDays * 24 * 60 * 60 * 1000);
    } else {
      newStage = Math.max(0, note.stage - 1);
      if (note.stage <= 1) newStage = 0;
      nextDate = Date.now() + (10 * 60 * 1000);
    }

    const updatedNote: Note = {
      ...note,
      stage: newStage,
      nextReviewDate: nextDate,
      reviewHistory: [...note.reviewHistory, { date: Date.now(), action: result }]
    };

    await saveNoteToDB(updatedNote);

    // 检查是否还有待复习的笔记
    const remainingDueNotes = dueNotes.filter(n => n.id !== note.id);

    if (remainingDueNotes.length > 0) {
      // 还有待复习的笔记，继续复习
      setCurrentReviewIndex(prev => Math.min(prev, remainingDueNotes.length - 1));
    } else {
      showToast('复习完成！太棒了！');
      setView('dashboard');
      setCurrentReviewIndex(0);
    }
  };

  const requestNotificationPermission = () => {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        saveSettingsToDB({ ...settings, enableNotifications: true });
        showToast('通知已开启');
      } else {
        showToast('通知权限被拒绝', 'error');
      }
    });
  };

  // --- Export / Import Data ---
  const handleExportData = async () => {
      const exportData = {
          notes,
          categories,
          settings,
          exportedAt: Date.now()
      };
      const blob = new Blob([JSON.stringify(exportData)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `memocurve_backup_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
          try {
              const data = JSON.parse(ev.target?.result as string);
              if (data.notes && Array.isArray(data.notes)) {
                  if(!confirm('导入将覆盖现有的一些数据（如果ID相同），确定吗？建议先备份。')) return;
                  
                  setLoading(true);
                  // Batch put
                  for(const n of data.notes) await dbHelper.put(STORE_NOTES, n);
                  if(data.categories) for(const c of data.categories) await dbHelper.put(STORE_CATS, c);
                  if(data.settings) await dbHelper.put(STORE_SETTINGS, data.settings, 'config');
                  
                  // Reload state
                  const dbNotes = await dbHelper.getAll<Note>(STORE_NOTES);
                  setNotes(dbNotes);
                  if (data.categories) setCategories(data.categories);
                  if (data.settings) setSettings(data.settings);
                  
                  showToast(`成功导入 ${data.notes.length} 条笔记`);
              }
          } catch (err) {
              showToast('文件格式错误', 'error');
          } finally {
              setLoading(false);
          }
      };
      reader.readAsText(file);
  };

  // --- Views ---

  if (loading) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-indigo-600">
              <RotateCw className="w-10 h-10 animate-spin mb-4" />
              <p className="font-bold">正在从本地数据库加载...</p>
              <p className="text-xs text-gray-400 mt-2">支持海量存储模式</p>
          </div>
      );
  }

  const Dashboard = () => {
    const dueCount = dueNotes.length;

    return (
      <div className="space-y-6 pb-20">
        {/* Header */}
        <div className="bg-indigo-600 p-6 rounded-b-3xl shadow-lg text-white">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <RotateCw className="w-6 h-6" /> MemoCurve
            </h1>
            <button onClick={() => setView('settings')} className="p-2 hover:bg-indigo-500 rounded-full transition">
              <Settings className="w-5 h-5" />
            </button>
          </div>
          
          <div className="bg-indigo-700/50 p-4 rounded-2xl flex items-center justify-between backdrop-blur-sm">
            <div>
              <p className="text-indigo-200 text-sm">待复习</p>
              <p className="text-3xl font-bold">{dueCount}</p>
            </div>
            <button 
              onClick={() => {
                if (dueCount > 0) {
                  setCurrentReviewIndex(0);
                  setView('review');
                } else {
                  showToast('暂无待复习内容', 'error');
                }
              }}
              className={`px-6 py-2 rounded-full font-semibold transition shadow-md ${dueCount > 0 ? 'bg-white text-indigo-600 hover:bg-indigo-50' : 'bg-indigo-800 text-indigo-400 cursor-not-allowed'}`}
            >
              开始复习
            </button>
          </div>
        </div>

        {/* Categories */}
        <div className="px-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-bold text-gray-700">分类</h2>
            <button onClick={() => setView('category')} className="text-indigo-600 text-sm font-medium">管理</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {categories.map(cat => {
              const count = notes.filter(n => n.categoryId === cat.id).length;
              return (
                <div 
                  key={cat.id} 
                  onClick={() => { setActiveCategory(cat.id); setView('category'); }}
                  className={`${cat.color} p-4 rounded-xl cursor-pointer hover:opacity-90 transition shadow-sm`}
                >
                  <h3 className="font-bold truncate">{cat.name}</h3>
                  <p className="text-xs mt-1 opacity-80">{count} 条笔记</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Activity / Stats */}
        <div className="px-4">
          <h2 className="font-bold text-gray-700 mb-3">概览</h2>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-4 text-sm text-gray-600">
            <div className="flex-1 text-center border-r border-gray-100">
              <div className="text-xl font-bold text-gray-800">{notes.length}</div>
              <div>总笔记</div>
            </div>
            <div className="flex-1 text-center">
              <div className="text-xl font-bold text-gray-800">{notes.reduce((acc, n) => acc + n.stage, 0)}</div>
              <div>累计记忆点</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const AddNote = () => {
    // Load form state from sessionStorage if available
    const savedFormState = sessionStorage.getItem('addNoteFormState');
    const initialFormState = savedFormState ? JSON.parse(savedFormState) : {
      title: '',
      content: '',
      selectedCat: categories[0]?.id || '',
      selectedCurve: settings.curveProfiles[0]?.id || '',
      images: []
    };

    const [title, setTitle] = useState(initialFormState.title);
    const [content, setContent] = useState(initialFormState.content);
    const [selectedCat, setSelectedCat] = useState(initialFormState.selectedCat);
    const [selectedCurve, setSelectedCurve] = useState(initialFormState.selectedCurve);
    const [images, setImages] = useState<string[]>(initialFormState.images); // Base64 strings
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isProcessingImg, setIsProcessingImg] = useState(false);

    // Save form state to sessionStorage whenever it changes
    useEffect(() => {
      const formState = {
        title,
        content,
        selectedCat,
        selectedCurve,
        images
      };
      sessionStorage.setItem('addNoteFormState', JSON.stringify(formState));
    }, [title, content, selectedCat, selectedCurve, images]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        setIsProcessingImg(true);
        try {
            const files = Array.from(e.target.files);
            // Process all selected files
            for (const file of files) {
              // Compress image before storage
              const compressedBase64 = await compressImage(file);
              setImages(prev => [...prev, compressedBase64]);
            }
        } catch {
            showToast('图片处理失败', 'error');
        } finally {
            setIsProcessingImg(false);
        }
      }
    };

    const submit = () => {
      if (!title.trim()) {
        showToast('请输入标题', 'error');
        return; // Just show error, don't clear form state
      }
      handleAddNote({
        title,
        content,
        categoryId: selectedCat,
        curveId: selectedCurve,
        images
      });
    };

    return (
      <div className="h-full flex flex-col bg-white">
        <div className="p-4 border-b flex items-center gap-3">
          <button onClick={() => setView('dashboard')}><ArrowLeft className="w-6 h-6 text-gray-600" /></button>
          <h2 className="font-bold text-lg">新建笔记</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-500 mb-1">分类</label>
              <select
                value={selectedCat}
                onChange={e => setSelectedCat(e.target.value)}
                className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-indigo-500"
              >
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> 复习策略
              </label>
              <select
                value={selectedCurve}
                onChange={e => setSelectedCurve(e.target.value)}
                className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-indigo-500"
              >
                {settings.curveProfiles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-500 mb-1">标题</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="核心概念 / 单词"
              className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-indigo-500 font-bold"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-500 mb-1">内容详情</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="详细解释、例句或备注..."
              className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-indigo-500 h-40 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-500 mb-2">图片笔记</label>
            <div className="flex flex-wrap gap-2">
              {images.map((img, idx) => (
                <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border">
                  <img src={img} className="w-full h-full object-cover" />
                  <button
                    onClick={() => setImages(images.filter((_, i) => i !== idx))}
                    className="absolute top-0 right-0 bg-black/50 text-white p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingImg}
                className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:text-indigo-500 hover:border-indigo-500 transition disabled:opacity-50"
              >
                {isProcessingImg ? <RotateCw className="w-5 h-5 animate-spin" /> : <Plus className="w-6 h-6" />}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageUpload}
              />
            </div>
          </div>
        </div>

        <div className="p-4 border-t">
          <button 
            onClick={submit}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition"
          >
            保存笔记
          </button>
        </div>
      </div>
    );
  };

  const ReviewSession = () => {
    const [showAnswer, setShowAnswer] = useState(false);
    // 过滤掉已经复习过的笔记
    const availableDueNotes = dueNotes.filter(note => note.nextReviewDate <= Date.now());
    const note = availableDueNotes[currentReviewIndex];

    if (!note) return <div className="p-10 text-center">加载中...</div>;

    const categoryName = categories.find(c => c.id === note.categoryId)?.name;
    const curve = settings.curveProfiles.find(c => c.id === note.curveId) || settings.curveProfiles[0];
    const nextInterval = curve.intervals[note.stage + 1] !== undefined 
      ? curve.intervals[note.stage + 1] 
      : (curve.intervals[curve.intervals.length - 1] * 2);

    return (
      <div className="h-full flex flex-col bg-gray-50">
        <div className="p-4 flex justify-between items-center text-gray-500">
          <button onClick={() => setView('dashboard')}><X className="w-6 h-6" /></button>
          <span className="font-mono">{currentReviewIndex + 1} / {availableDueNotes.length}</span>
          <div className="w-6"></div>
        </div>

        <div className="flex-1 p-4 flex flex-col justify-center max-w-md mx-auto w-full">
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col min-h-[400px] relative">
            <div className="p-8 flex-1 flex flex-col items-center justify-center text-center">
              <div className="flex gap-2 mb-4">
                <span className="inline-block px-3 py-1 rounded-full bg-gray-100 text-xs text-gray-500">
                  {categoryName}
                </span>
                <span className="inline-block px-3 py-1 rounded-full bg-indigo-50 text-xs text-indigo-600">
                  {curve.name} Lv.{note.stage}
                </span>
              </div>
              
              <h2 className="text-2xl font-bold text-gray-800 mb-4">{note.title}</h2>
              
              {!showAnswer && (
                <p className="text-gray-400 text-sm animate-pulse mt-10">点击下方显示答案</p>
              )}

              {showAnswer && (
                <div className="w-full mt-6 pt-6 border-t border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <p className="text-gray-600 text-left whitespace-pre-wrap">{note.content || "（无文字内容）"}</p>
                  {note.images.length > 0 && (
                    <div className="mt-4 grid gap-2">
                      {note.images.map((img, i) => (
                        <img key={i} src={img} className="rounded-lg w-full object-cover" alt="note attachment" />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 pb-10">
          {!showAnswer ? (
            <button 
              onClick={() => setShowAnswer(true)}
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-indigo-700 transition"
            >
              显示答案
            </button>
          ) : (
            <div className="flex gap-4">
              <button 
                onClick={() => { handleReview(note, 'forgot'); setShowAnswer(false); }}
                className="flex-1 bg-red-100 text-red-600 py-4 rounded-2xl font-bold hover:bg-red-200 transition flex flex-col items-center"
              >
                <span className="text-lg">忘记了</span>
                <span className="text-xs font-normal opacity-70">重置进度</span>
              </button>
              <button 
                onClick={() => { handleReview(note, 'remembered'); setShowAnswer(false); }}
                className="flex-1 bg-green-100 text-green-600 py-4 rounded-2xl font-bold hover:bg-green-200 transition flex flex-col items-center"
              >
                <span className="text-lg">记得</span>
                <span className="text-xs font-normal opacity-70">下次: {nextInterval}天后</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const SettingsView = () => {
    const [editedCurves, setEditedCurves] = useState<CurveProfile[]>(settings.curveProfiles);
    const [isDirty, setIsDirty] = useState(false);
    const [quota, setQuota] = useState<{usage: number, quota: number} | null>(null);

    useEffect(() => {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            navigator.storage.estimate().then(({usage, quota}) => {
                setQuota({ usage: usage || 0, quota: quota || 0 });
            });
        }
    }, []);

    const updateCurve = (index: number, field: keyof CurveProfile, value: any) => {
      const newCurves = [...editedCurves];
      if (field === 'intervals') {
        const arr = value.split(',').map((n: string) => parseFloat(n.trim())).filter((n: number) => !isNaN(n));
        newCurves[index] = { ...newCurves[index], intervals: arr };
      } else {
        newCurves[index] = { ...newCurves[index], [field]: value };
      }
      setEditedCurves(newCurves);
      setIsDirty(true);
    };

    const addCurve = () => {
      setEditedCurves([...editedCurves, { id: generateId(), name: '新曲线', intervals: [1, 2, 3, 5], isDefault: false }]);
      setIsDirty(true);
    };

    const deleteCurve = (index: number) => {
      if (editedCurves.length <= 1) {
        showToast('至少保留一个复习曲线', 'error');
        return;
      }
      const newCurves = editedCurves.filter((_, i) => i !== index);
      setEditedCurves(newCurves);
      setIsDirty(true);
    };

    const saveSettings = () => {
      saveSettingsToDB({ ...settings, curveProfiles: editedCurves });
      setIsDirty(false);
      showToast('设置已保存');
    };
    
    const formatBytes = (bytes: number, decimals = 2) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    return (
      <div className="bg-gray-50 min-h-screen pb-20">
        <div className="p-4 bg-white shadow-sm flex items-center justify-between mb-6 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setView('dashboard')}><ArrowLeft className="w-6 h-6 text-gray-600" /></button>
            <h2 className="font-bold text-lg">设置</h2>
          </div>
          {isDirty && (
            <button onClick={saveSettings} className="text-indigo-600 font-bold flex items-center gap-1 text-sm">
              <Save className="w-4 h-4" /> 保存
            </button>
          )}
        </div>

        <div className="px-4 space-y-6">
           {/* Storage Management */}
           <section className="bg-white p-4 rounded-xl shadow-sm">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-indigo-500" /> 存储空间 (IndexedDB)
            </h3>
            {quota ? (
                <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-600">
                        <span>已用: {formatBytes(quota.usage)}</span>
                        <span>总量: {formatBytes(quota.quota)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                        <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${Math.min((quota.usage / quota.quota) * 100, 100)}%` }}></div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                        * 数据存储在本地浏览器中。为防止丢失，请定期导出备份。
                    </p>
                </div>
            ) : (
                <p className="text-sm text-gray-500">正在计算存储空间...</p>
            )}
            
            <div className="grid grid-cols-2 gap-3 mt-4">
                <button onClick={handleExportData} className="flex items-center justify-center gap-2 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-semibold hover:bg-indigo-100">
                    <Download className="w-4 h-4" /> 导出备份
                </button>
                <label className="flex items-center justify-center gap-2 py-2 bg-gray-50 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-100 cursor-pointer">
                    <Upload className="w-4 h-4" /> 导入数据
                    <input type="file" accept=".json" className="hidden" onChange={handleImportData} />
                </label>
            </div>
          </section>

          <section className="bg-white p-4 rounded-xl shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <BarChart className="w-5 h-5 text-indigo-500" /> 遗忘曲线管理
              </h3>
              <button onClick={addCurve} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded font-bold">+ 新建</button>
            </div>
            
            <div className="space-y-4">
              {editedCurves.map((curve, idx) => (
                <div key={curve.id} className="border-b pb-4 last:border-0 last:pb-0">
                  <div className="flex justify-between items-center mb-2">
                    <input 
                      value={curve.name}
                      onChange={e => updateCurve(idx, 'name', e.target.value)}
                      className="font-bold text-sm bg-transparent border-none focus:ring-0 p-0 w-full"
                      placeholder="曲线名称"
                    />
                    {!curve.isDefault && (
                      <button onClick={() => deleteCurve(idx)} className="text-gray-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mb-1">间隔 (天):</div>
                  <input 
                    value={curve.intervals.join(', ')}
                    onChange={e => updateCurve(idx, 'intervals', e.target.value)}
                    className="w-full p-2 bg-gray-50 rounded-lg font-mono text-xs border-none"
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white p-4 rounded-xl shadow-sm">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-500" /> 通知设置
            </h3>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">复习提醒</span>
              <button 
                onClick={requestNotificationPermission}
                className={`w-12 h-6 rounded-full transition-colors relative ${settings.enableNotifications ? 'bg-green-500' : 'bg-gray-300'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${settings.enableNotifications ? 'left-6.5' : 'left-0.5'}`}></div>
              </button>
            </div>
          </section>

          <section className="bg-white p-4 rounded-xl shadow-sm">
             <h3 className="font-bold text-gray-800 mb-4 text-red-500 flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> 危险区域
            </h3>
            <button 
              onClick={async () => {
                if(confirm('这将清除所有数据且无法恢复！确定吗？')) {
                  await dbHelper.clearStore(STORE_NOTES);
                  await dbHelper.clearStore(STORE_CATS);
                  // Clear settings but keep defaults maybe? or full nuke
                  await dbHelper.clearStore(STORE_SETTINGS);
                  window.location.reload();
                }
              }}
              className="w-full py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
            >
              清除所有数据
            </button>
          </section>
        </div>
      </div>
    );
  };

  const CategoryManager = () => {
    const [editingNote, setEditingNote] = useState<Note | null>(null);
    const [newCatName, setNewCatName] = useState('');

    // Sub-component for editing a note
    const NoteEditor = ({ note, onClose }: { note: Note, onClose: () => void }) => {
      const [title, setTitle] = useState(note.title);
      const [content, setContent] = useState(note.content);
      const [curveId, setCurveId] = useState(note.curveId);
      const [reschedule, setReschedule] = useState(false);
      const [images, setImages] = useState<string[]>(note.images); // Base64 strings
      const fileInputRef = useRef<HTMLInputElement>(null);
      const [isProcessingImg, setIsProcessingImg] = useState(false);

      const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
          setIsProcessingImg(true);
          try {
              const files = Array.from(e.target.files);
              // Process all selected files
              for (const file of files) {
                // Compress image before storage
                const compressedBase64 = await compressImage(file);
                setImages(prev => [...prev, compressedBase64]);
              }
          } catch (e) {
              showToast('图片处理失败', 'error');
          } finally {
              setIsProcessingImg(false);
          }
        }
      };

      const save = async () => {
        const updatedNote = { ...note, title, content, curveId, images };

        if (reschedule && curveId !== note.curveId) {
          const newCurve = settings.curveProfiles.find(c => c.id === curveId);
          if (newCurve) {
             updatedNote.nextReviewDate = Date.now();
             updatedNote.stage = Math.max(0, updatedNote.stage - 1);
          }
        }

        await handleUpdateNote(updatedNote);
        onClose();
      };

      return (
        <div className="fixed inset-0 bg-white z-50 flex flex-col">
          <div className="p-4 border-b flex items-center justify-between">
             <div className="flex items-center gap-3">
                <button onClick={onClose}><ArrowLeft className="w-6 h-6 text-gray-600" /></button>
                <h2 className="font-bold text-lg">编辑笔记</h2>
             </div>
             <button onClick={save} className="text-indigo-600 font-bold">保存</button>
          </div>
          <div className="p-4 space-y-4 overflow-y-auto">
            <div>
              <label className="block text-sm text-gray-500 mb-1">标题</label>
              <input value={title} onChange={e => setTitle(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl font-bold" />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">内容</label>
              <textarea value={content} onChange={e => setContent(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl h-40 resize-none" />
            </div>

            {/* Image Management Section */}
            <div>
              <label className="block text-sm text-gray-500 mb-2">图片笔记</label>
              <div className="flex flex-wrap gap-2">
                {images.map((img, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border">
                    <img src={img} className="w-full h-full object-cover" alt="note image" />
                    <button
                      onClick={() => setImages(images.filter((_, i) => i !== idx))}
                      className="absolute top-0 right-0 bg-black/50 text-white p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessingImg}
                  className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:text-indigo-500 hover:border-indigo-500 transition disabled:opacity-50"
                >
                  {isProcessingImg ? <RotateCw className="w-5 h-5 animate-spin" /> : <Plus className="w-6 h-6" />}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </div>
            </div>

            <div className="bg-indigo-50 p-4 rounded-xl">
               <label className="block text-sm text-indigo-800 mb-2 font-bold flex items-center gap-2">
                 <TrendingUp className="w-4 h-4" /> 复习策略 (遗忘曲线)
               </label>
               <select
                  value={curveId}
                  onChange={e => setCurveId(e.target.value)}
                  className="w-full p-2 bg-white rounded-lg border border-indigo-100 mb-2"
                >
                  {settings.curveProfiles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
               </select>
               {curveId !== note.curveId && (
                 <div className="flex items-center gap-2 text-xs text-indigo-600 mt-2">
                   <input
                    type="checkbox"
                    id="reschedule"
                    checked={reschedule}
                    onChange={e => setReschedule(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                   />
                   <label htmlFor="reschedule">立即重新安排复习 (设为今天到期)</label>
                 </div>
               )}
            </div>
          </div>
        </div>
      );
    };

    if (editingNote) {
      return <NoteEditor note={editingNote} onClose={() => setEditingNote(null)} />;
    }

    const addCat = async () => {
      if(!newCatName.trim()) return;
      const colors = ['bg-blue-100 text-blue-800', 'bg-purple-100 text-purple-800', 'bg-green-100 text-green-800', 'bg-orange-100 text-orange-800', 'bg-pink-100 text-pink-800'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      const newCat = { id: generateId(), name: newCatName, color: randomColor };
      
      await dbHelper.put(STORE_CATS, newCat);
      setCategories([...categories, newCat]);
      setNewCatName('');
    };

    const deleteCat = async (id: string) => {
      if(notes.some(n => n.categoryId === id)) {
        showToast('无法删除：该分类下还有笔记', 'error');
        return;
      }
      await dbHelper.delete(STORE_CATS, id);
      setCategories(categories.filter(c => c.id !== id));
    };

    // Category Detail View
    if (activeCategory) {
      const cat = categories.find(c => c.id === activeCategory);
      const catNotes = notes.filter(n => n.categoryId === activeCategory);
      
      return (
        <div className="bg-gray-50 min-h-screen pb-20">
           <div className="p-4 bg-white shadow-sm flex items-center gap-3 sticky top-0 z-10">
            <button onClick={() => { setActiveCategory(null); setView('dashboard'); }}><ArrowLeft className="w-6 h-6 text-gray-600" /></button>
            <h2 className="font-bold text-lg">{cat?.name || '分类详情'}</h2>
          </div>
          
          <div className="p-4 space-y-3">
            {catNotes.length === 0 && <div className="text-center text-gray-400 mt-10">该分类下暂无笔记</div>}
            {catNotes.map(n => (
              <div
                key={n.id}
                onClick={() => setEditingNote(n)}
                className="bg-white p-4 rounded-xl shadow-sm flex justify-between items-start cursor-pointer hover:bg-gray-50 transition active:scale-[0.98]"
              >
                <div className="flex-1">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    {n.title}
                    <Edit3 className="w-3 h-3 text-gray-300" />
                  </h3>
                  <p className="text-sm text-gray-500 truncate mt-1">{n.content || (n.images.length > 0 ? '图片笔记' : '')}</p>

                  {/* Show image thumbnails if note has images */}
                  {n.images.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {n.images.slice(0, 3).map((img, idx) => (
                        <div key={idx} className="w-8 h-8 rounded overflow-hidden border">
                          <img src={img} className="w-full h-full object-cover" alt="thumbnail" />
                        </div>
                      ))}
                      {n.images.length > 3 && (
                        <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-xs text-gray-500">
                          +{n.images.length - 3}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded">Lv.{n.stage}</span>
                    <span className="text-gray-400">下次: {getRelativeTime(n.nextReviewDate)}</span>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteNote(n.id); }}
                  className="text-gray-300 hover:text-red-500 p-2"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
       <div className="bg-gray-50 min-h-screen pb-20">
         <div className="p-4 bg-white shadow-sm flex items-center gap-3 mb-4">
            <button onClick={() => setView('dashboard')}><ArrowLeft className="w-6 h-6 text-gray-600" /></button>
            <h2 className="font-bold text-lg">分类管理</h2>
          </div>
          
          <div className="px-4">
            <div className="flex gap-2 mb-6">
              <input 
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                placeholder="新分类名称"
                className="flex-1 p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <button onClick={addCat} className="bg-indigo-600 text-white px-4 rounded-xl font-bold">添加</button>
            </div>

            <div className="space-y-3">
              {categories.map(c => (
                <div key={c.id} className="bg-white p-4 rounded-xl shadow-sm flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${c.color.split(' ')[0].replace('bg', 'bg')}`}></div>
                    <span className="font-medium">{c.name}</span>
                  </div>
                  <button onClick={() => deleteCat(c.id)} className="text-gray-300 hover:text-red-500">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
       </div>
    );
  };

  // --- Navigation Bar ---
  const NavBar = () => (
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

  // --- Main Render ---

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 relative overflow-hidden font-sans text-slate-900">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full shadow-lg z-[60] text-white text-sm animate-in fade-in slide-in-from-top-2 ${toast.type === 'error' ? 'bg-red-500' : 'bg-gray-800'}`}>
          {toast.msg}
        </div>
      )}

      {view === 'dashboard' && <Dashboard />}
      {view === 'add' && <AddNote />}
      {view === 'review' && <ReviewSession />}
      {view === 'settings' && <SettingsView />}
      {view === 'category' && <CategoryManager />}

      {/* Show Nav bar only on main screens */}
      {(view === 'dashboard' || view === 'settings' || (view === 'category' && !activeCategory)) && <NavBar />}
    </div>
  );
}