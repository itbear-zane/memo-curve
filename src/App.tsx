import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  Plus,
  Settings,
  RotateCw,
  X,
  Trash2,
  ArrowLeft,
  TrendingUp,
  Save,
  Edit3,
  Clock,
  HardDrive,
  Download,
  Upload,
  Eye,
  GripVertical,
  Calendar,
  Target,
  PieChart as PieChartIcon,
  TrendingUp as TrendingUpIcon
} from 'lucide-react';
import { isBefore, endOfDay, isToday, startOfDay, subDays, format } from 'date-fns';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import html2canvas from 'html2canvas';

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
      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NOTES)) db.createObjectStore(STORE_NOTES, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(STORE_CATS)) db.createObjectStore(STORE_CATS, { keyPath: 'id' });
        // Settings is a singleton object, we'll use a fixed key 'appSettings' or just store/put
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) db.createObjectStore(STORE_SETTINGS);
      };
      request.onsuccess = (event: Event) => {
        dbHelper.db = (event.target as IDBOpenDBRequest).result;
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

  async put(storeName: string, data: unknown, key?: string) {
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
  sortOrder?: number; // 新增排序字段
};

type AppSettings = {
  curveProfiles: CurveProfile[];
  enableNotifications: boolean;
};

const DEFAULT_CURVES: CurveProfile[] = [
  { id: 'curve_gaokao_intensive', name: '高考高频冲刺（30次复习）', intervals: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 21, 24, 27, 30, 33, 37, 41, 45, 50, 55, 60, 70, 80, 90, 100], isDefault: true },
  { id: 'curve_gaokao_layered', name: '高考分层复习', intervals: [1, 2, 3, 4, 5, 7, 9, 11, 13, 15, 18, 21, 24, 27, 30, 34, 38, 42, 46, 50, 55, 60, 66, 72, 78, 84, 91, 98, 105, 112, 120, 128, 136, 145, 154, 163, 172, 181], isDefault: true },
  { id: 'curve_gaokao_intensive_ultra', name: '终极密集曲线（适合重点内容）', intervals: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 23, 25, 27, 29, 31, 33, 35, 37, 39, 41, 43, 45, 47, 49, 51, 53, 55, 57, 59, 61, 64, 67, 70, 73, 76, 79, 82, 85, 88, 91, 95, 99, 103, 107, 111, 115, 120, 125, 130, 135, 140, 145, 150, 155, 160, 165, 170, 175, 180], isDefault: true },
  { id: 'curve_english_vocab', name: '英语单词专项', intervals: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70, 72, 74, 76, 78, 80, 82, 84, 86, 88, 90, 92, 94, 96, 98, 100, 102, 104, 106, 108, 110, 112, 114, 116, 118, 120, 122, 124, 126, 128, 130, 132, 134, 136, 138, 140, 142, 144, 146, 148, 150, 152, 154, 156, 158, 160, 162, 164, 166, 168, 170, 172, 174, 176, 178, 180], isDefault: true }
];

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat_chinese', name: '语文', color: 'bg-red-100 text-red-800', sortOrder: 1 },
  { id: 'cat_math', name: '数学', color: 'bg-sky-100 text-sky-800', sortOrder: 2 },
  { id: 'cat_english', name: '英语', color: 'bg-green-100 text-green-800', sortOrder: 3 },
  { id: 'cat_physics', name: '物理', color: 'bg-purple-100 text-purple-800', sortOrder: 4 },
  { id: 'cat_chemistry', name: '化学', color: 'bg-yellow-100 text-yellow-800', sortOrder: 5 },
  { id: 'cat_biology', name: '生物', color: 'bg-pink-100 text-pink-800', sortOrder: 6 },
];

// --- Helper Functions ---

const generateId = () => Math.random().toString(36).substring(2, 11);

const getRelativeTime = (timestamp: number) => {
  const diff = timestamp - Date.now();
  const diffDays = Math.ceil(diff / (1000 * 60 * 60 * 24));

  // 使用新的过期逻辑：如果笔记的复习时间在今天晚上12点之前，显示"今天"
  if (isToday(timestamp)) {
    return '今天';
  }

  // 如果笔记的复习时间已经过了当天晚上12点，显示"已过期"
  const reviewDayEnd = endOfDay(timestamp);
  if (isBefore(reviewDayEnd, Date.now())) {
    return '已过期';
  }

  if (diffDays <= 0) return '今天';
  if (diffDays === 1) return '明天';
  return `${diffDays}天后`;
};

// Check if a note is overdue (after end of the review day)
const isNoteOverdue = (note: Note): boolean => {
  const reviewDayEnd = endOfDay(note.nextReviewDate);
  return isBefore(reviewDayEnd, Date.now());
};

// Check if a note is due (overdue after end of review day)
const isNoteDue = (note: Note): boolean => {
  return isNoteOverdue(note);
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    curveProfiles: DEFAULT_CURVES,
    enableNotifications: false,
  });

  const [view, setView] = useState<'dashboard' | 'add' | 'review' | 'settings' | 'category'>('dashboard');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);


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
        } else if (dbCats.length === 0) {
            // If no categories exist in DB, save default categories
            console.log("Saving default categories to IndexedDB...");
            const categoriesWithSortOrder = DEFAULT_CATEGORIES.map((cat, index) => ({
                ...cat,
                sortOrder: index
            }));
            for (const c of categoriesWithSortOrder) await dbHelper.put(STORE_CATS, c);
            setCategories(categoriesWithSortOrder);
            if (dbSettings) setSettings(prev => ({...prev, ...dbSettings}));
        } else {
            // Normal Load - 为现有分类添加排序顺序（如果没有的话）
            setNotes(dbNotes);
            if (dbCats.length > 0) {
                // 检查是否需要为现有分类添加排序顺序
                const categoriesWithSortOrder = dbCats.map((cat, index) => ({
                    ...cat,
                    sortOrder: cat.sortOrder ?? index
                }));
                setCategories(categoriesWithSortOrder);
            }
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
      const dueCount = notes.filter(n => isNoteDue(n)).length;
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

  const dueNotes = notes.filter(n => isNoteDue(n)).sort((a, b) => a.nextReviewDate - b.nextReviewDate);

  const handleAddNote = async (noteData: Omit<Note, 'id' | 'createdAt' | 'nextReviewDate' | 'stage' | 'reviewHistory'>) => {
    // Calculate first review date based on the selected curve's first interval
    const curve = settings.curveProfiles.find(c => c.id === noteData.curveId) || settings.curveProfiles[0];
    const firstIntervalDays = curve.intervals[0] || 1; // Default to 1 day if no intervals
    const firstReviewDate = Date.now() + (firstIntervalDays * 24 * 60 * 60 * 1000);

    const newNote: Note = {
      ...noteData,
      id: generateId(),
      createdAt: Date.now(),
      nextReviewDate: firstReviewDate,
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

      // 计算实际间隔天数 = 下一次复习的累计天数 - 当前复习的累计天数
      const currentCumulativeDays = note.stage < intervals.length ? intervals[note.stage] : intervals[intervals.length - 1];
      const nextCumulativeDays = newStage < intervals.length
        ? intervals[newStage]
        : (intervals[intervals.length - 1] * 2);

      const actualIntervalDays = nextCumulativeDays - currentCumulativeDays;

      nextDate = Date.now() + (actualIntervalDays * 24 * 60 * 60 * 1000);
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
          } catch {
              showToast('文件格式错误', 'error');
          } finally {
              setLoading(false);
          }
      };
      reader.readAsText(file);
  };

  // --- 统计数据计算 ---

  // 今日新增笔记数
  const getTodayAddedNotes = () => {
    const today = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    return notes.filter(note =>
      note.createdAt >= today.getTime() && note.createdAt <= todayEnd.getTime()
    ).length;
  };

  // 今日完成复习数
  const getTodayCompletedReviews = () => {
    const today = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    let completedCount = 0;

    notes.forEach(note => {
      note.reviewHistory.forEach(review => {
        if (review.date >= today.getTime() && review.date <= todayEnd.getTime()) {
          completedCount++;
        }
      });
    });

    return completedCount;
  };

  // 导出今日概览为图片（包含图表）
  const exportDailyOverview = async () => {
    try {
      console.log('开始导出详细概览...');

      // 获取所有概览数据
      const today = format(new Date(), 'yyyy年MM月dd日');
      const todayAdded = getTodayAddedNotes();
      const todayCompleted = getTodayCompletedReviews();
      const totalNotes = notes.length;
      const accuracy = getMemoryAccuracy();
      const totalMemoryPoints = notes.reduce((acc, n) => acc + n.stage, 0);
      const dueCount = dueNotes.length;

      // 获取详细分析数据
      const categoryData = getCategoryDistribution();
      const todayAddedData = getTodayAddedCategoryDistribution();
      const trendData = getDailyLearningTrend();
      const completionData = getCategoryCompletionRates();

      console.log('概览数据:', {
        today, todayAdded, todayCompleted, totalNotes, accuracy,
        totalMemoryPoints, dueCount, categoryData, todayAddedData,
        trendData, completionData
      });

      const fileName = format(new Date(), 'yyyy-MM-dd');

      // 创建HTML导出（包含图表数据的可视化）
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'fixed';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '0';
      tempDiv.style.background = 'white';
      tempDiv.style.padding = '20px';
      tempDiv.style.width = '800px';
      tempDiv.style.fontFamily = 'system-ui, -apple-system, sans-serif';

      // 构建详细的HTML内容
      tempDiv.innerHTML = `
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="font-size: 28px; font-weight: bold; color: #374151; margin: 0 0 8px 0;">MemoCurve 每日详细统计报告</h1>
          <p style="font-size: 16px; color: #6b7280; margin: 0;">${today}</p>
        </div>

        <!-- 今日统计 -->
        <div style="background: #f8fafc; border-radius: 12px; padding: 24px; border: 1px solid #e2e8f0; margin-bottom: 24px;">
          <h2 style="font-size: 20px; font-weight: 600; color: #374151; margin: 0 0 20px 0;">📊 今日学习统计</h2>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
            <div style="background: #eef2ff; border-radius: 8px; padding: 16px; text-align: center;">
              <div style="font-size: 32px; font-weight: bold; color: #6366f1;">${todayAdded}</div>
              <div style="font-size: 14px; color: #4b5563;">今日新增笔记</div>
            </div>
            <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; text-align: center;">
              <div style="font-size: 32px; font-weight: bold; color: #10b981;">${todayCompleted}</div>
              <div style="font-size: 14px; color: #4b5563;">完成复习</div>
            </div>
            <div style="background: #fef3c7; border-radius: 8px; padding: 16px; text-align: center;">
              <div style="font-size: 28px; font-weight: bold; color: #d97706;">${dueCount}</div>
              <div style="font-size: 14px; color: #4b5563;">待复习笔记</div>
            </div>
          </div>
        </div>

        <!-- 总体统计 -->
        <div style="background: #f8fafc; border-radius: 12px; padding: 24px; border: 1px solid #e2e8f0; margin-bottom: 24px;">
          <h2 style="font-size: 20px; font-weight: 600; color: #374151; margin: 0 0 20px 0;">📈 总体学习概览</h2>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;">
            <div style="background: white; border-radius: 8px; padding: 16px; text-align: center; border: 1px solid #e5e7eb;">
              <div style="font-size: 24px; font-weight: bold; color: #374151;">${totalNotes}</div>
              <div style="font-size: 14px; color: #6b7280;">总笔记数</div>
            </div>
            <div style="background: white; border-radius: 8px; padding: 16px; text-align: center; border: 1px solid #e5e7eb;">
              <div style="font-size: 24px; font-weight: bold; color: #7c3aed;">${totalMemoryPoints}</div>
              <div style="font-size: 14px; color: #6b7280;">累计记忆点</div>
            </div>
            <div style="background: white; border-radius: 8px; padding: 16px; text-align: center; border: 1px solid #e5e7eb;">
              <div style="font-size: 24px; font-weight: bold; color: #ec4899;">${accuracy}%</div>
              <div style="font-size: 14px; color: #6b7280;">记忆准确率</div>
            </div>
            <div style="background: white; border-radius: 8px; padding: 16px; text-align: center; border: 1px solid #e5e7eb;">
              <div style="font-size: 24px; font-weight: bold; color: #f59e0b;">${categories.length}</div>
              <div style="font-size: 14px; color: #6b7280;">分类数量</div>
            </div>
          </div>
        </div>

        <!-- 分类分布 -->
        ${categoryData.length > 0 ? `
        <div style="background: #f8fafc; border-radius: 12px; padding: 24px; border: 1px solid #e2e8f0; margin-bottom: 24px;">
          <h2 style="font-size: 20px; font-weight: 600; color: #374151; margin: 0 0 20px 0;">🎯 分类分布统计</h2>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
            ${categoryData.map((item) => `
              <div style="background: white; border-radius: 8px; padding: 12px; border-left: 4px solid ${item.color}; display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-weight: 600; color: #374151;">${item.name}</div>
                  <div style="font-size: 12px; color: #6b7280;">分类笔记</div>
                </div>
                <div style="font-size: 20px; font-weight: bold; color: ${item.color};">${item.value}</div>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}

        <!-- 今日新增分布 -->
        ${todayAddedData.length > 0 ? `
        <div style="background: #f8fafc; border-radius: 12px; padding: 24px; border: 1px solid #e2e8f0; margin-bottom: 24px;">
          <h2 style="font-size: 20px; font-weight: 600; color: #374151; margin: 0 0 20px 0;">📝 今日新增笔记分布</h2>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
            ${todayAddedData.map((item) => `
              <div style="background: #f0fdf4; border-radius: 8px; padding: 12px; border-left: 4px solid #10b981; display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-weight: 600; color: #374151;">${item.name}</div>
                  <div style="font-size: 12px; color: #6b7280;">今日新增</div>
                </div>
                <div style="font-size: 20px; font-weight: bold; color: #10b981;">${item.value}</div>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}

        <!-- 学习趋势 -->
        ${trendData.length > 0 ? `
        <div style="background: #f8fafc; border-radius: 12px; padding: 24px; border: 1px solid #e2e8f0; margin-bottom: 24px;">
          <h2 style="font-size: 20px; font-weight: 600; color: #374151; margin: 0 0 20px 0;">📊 最近7天学习趋势</h2>
          <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; margin-bottom: 16px;">
            ${trendData.map((day) => `
              <div style="background: white; border-radius: 6px; padding: 8px; text-align: center; border: 1px solid #e5e7eb;">
                <div style="font-size: 11px; color: #6b7280;">${day.date}</div>
                <div style="font-size: 16px; font-weight: bold; color: #6366f1; margin-top: 4px;">${day.added}</div>
              </div>
            `).join('')}
          </div>
          <div style="text-align: center; font-size: 12px; color: #6b7280;">
            平均每日新增: ${Math.round(trendData.reduce((sum, day) => sum + day.added, 0) / trendData.length)} 条笔记
          </div>
        </div>
        ` : ''}

        <!-- 完成率统计 -->
        ${completionData.length > 0 ? `
        <div style="background: #f8fafc; border-radius: 12px; padding: 24px; border: 1px solid #e2e8f0; margin-bottom: 24px;">
          <h2 style="font-size: 20px; font-weight: 600; color: #374151; margin: 0 0 20px 0;">🎯 今日复习完成率</h2>
          <div style="display: grid; gap: 12px;">
            ${completionData.map((item) => `
              <div style="background: white; border-radius: 8px; padding: 16px; border: 1px solid #e5e7eb;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <div style="font-weight: 600; color: #374151;">${item.name}</div>
                  <div style="font-size: 14px; color: #6b7280;">
                    ${item.isNewNoteOnly ?
                      `<span style="color: #10b981;">今日新添加 (${item.total}条)</span>` :
                      `${item.completed}/${item.needReview} (${item.rate}%)`
                    }
                  </div>
                </div>
                ${!item.isNewNoteOnly ? `
                  <div style="background: #f3f4f6; border-radius: 4px; height: 8px; overflow: hidden;">
                    <div style="background: #6366f1; height: 8px; border-radius: 4px; width: ${item.rate}%; transition: width 0.3s ease;"></div>
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}

        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb;">
          <div style="font-size: 12px; color: #9ca3af; margin-bottom: 8px;">由 MemoCurve 生成 - 间隔重复学习系统</div>
          <div style="font-size: 10px; color: #d1d5db;">导出时间: ${new Date().toLocaleString('zh-CN')}</div>
        </div>
      `;

      console.log('创建详细HTML内容完成');

      // 添加到DOM
      document.body.appendChild(tempDiv);
      console.log('临时元素已添加到DOM');

      const canvas = await html2canvas(tempDiv, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: true,
        useCORS: true,
        allowTaint: true,
        width: tempDiv.scrollWidth,
        height: tempDiv.scrollHeight
      });

      console.log('Canvas生成成功，尺寸:', canvas.width, 'x', canvas.height);

      // 移除临时div
      document.body.removeChild(tempDiv);

      // 创建图片下载链接
      const imgLink = document.createElement('a');
      imgLink.download = `MemoCurve-详细概览-${fileName}.png`;
      imgLink.href = canvas.toDataURL('image/png');
      imgLink.click();

      console.log('导出完成！已生成详细概览图片。');

      // 显示成功提示
      showToast('导出成功！已生成详细概览图片', 'success');

    } catch (error) {
      console.error('导出详细概览失败:', error);
      showToast('导出失败，请重试', 'error');
    }
  };

  // 记忆准确率
  const getMemoryAccuracy = () => {
    let rememberedCount = 0;
    let totalCount = 0;

    notes.forEach(note => {
      note.reviewHistory.forEach(review => {
        if (review.action === 'remembered') {
          rememberedCount++;
        }
        totalCount++;
      });
    });

    return totalCount > 0 ? Math.round((rememberedCount / totalCount) * 100) : 100;
  };

  // 各分类笔记数量分布
  const getCategoryDistribution = () => {
    const distribution = categories.map(cat => ({
      name: cat.name,
      value: notes.filter(note => note.categoryId === cat.id).length,
      color: cat.color
    })).filter(item => item.value > 0);

    return distribution;
  };

  // 今日新增笔记分类分布
  const getTodayAddedCategoryDistribution = () => {
    const today = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    const distribution = categories.map(cat => ({
      name: cat.name,
      value: notes.filter(note =>
        note.categoryId === cat.id &&
        note.createdAt >= today.getTime() &&
        note.createdAt <= todayEnd.getTime()
      ).length,
      color: cat.color
    })).filter(item => item.value > 0);

    return distribution;
  };

  // 各分类复习完成率
  const getCategoryCompletionRates = () => {
    return categories.map(cat => {
      const categoryNotes = notes.filter(note => note.categoryId === cat.id);
      const totalNotes = categoryNotes.length;
      const completedToday = categoryNotes.filter(note => {
        return note.reviewHistory.some(review => {
          const today = startOfDay(new Date());
          const todayEnd = endOfDay(new Date());
          return review.date >= today.getTime() && review.date <= todayEnd.getTime();
        });
      }).length;

      // 计算今天应该复习的笔记数量（排除今天新添加且还没到复习时间的笔记）
      const today = startOfDay(new Date());
      const todayEnd = endOfDay(new Date());
      const notesToReview = categoryNotes.filter(note => {
        // 如果是今天新添加的笔记，且还没有任何复习记录，则不算入需要复习的数量
        const isTodayNewNote = note.createdAt >= today.getTime() && note.createdAt <= todayEnd.getTime();
        const hasNoReviewHistory = note.reviewHistory.length === 0;

        return !isTodayNewNote || !hasNoReviewHistory;
      }).length;

      return {
        name: cat.name,
        total: totalNotes,
        completed: completedToday,
        needReview: notesToReview,
        rate: notesToReview > 0 ? Math.round((completedToday / notesToReview) * 100) : 100,
        isNewNoteOnly: notesToReview === 0 && totalNotes > 0
      };
    }).filter(item => item.total > 0);
  };

  // 每日学习笔记数量趋势（最近7天）
  const getDailyLearningTrend = () => {
    const trend = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStart = startOfDay(date);
      const dateEnd = endOfDay(date);

      const addedCount = notes.filter(note =>
        note.createdAt >= dateStart.getTime() && note.createdAt <= dateEnd.getTime()
      ).length;

      trend.push({
        date: format(date, 'MM/dd'),
        fullDate: format(date, 'yyyy-MM-dd'),
        added: addedCount
      });
    }

    return trend;
  };

  // --- 分析详情模态框组件 ---
  const AnalyticsOverview = () => {
    const [activeTab, setActiveTab] = useState<'category' | 'today' | 'trend' | 'completion'>('category');

    const categoryData = getCategoryDistribution();
    const todayAddedData = getTodayAddedCategoryDistribution();
    const trendData = getDailyLearningTrend();
    const completionData = getCategoryCompletionRates();

    // 为饼图准备颜色
    const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
          {/* Header */}
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="font-bold text-lg">学习数据分析</h3>
            <button onClick={() => setShowAnalytics(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('category')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === 'category'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <PieChartIcon className="w-4 h-4 inline mr-1" />
              分类分布
            </button>
            <button
              onClick={() => setActiveTab('today')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === 'today'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Calendar className="w-4 h-4 inline mr-1" />
              今日新增
            </button>
            <button
              onClick={() => setActiveTab('trend')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === 'trend'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <TrendingUpIcon className="w-4 h-4 inline mr-1" />
              学习趋势
            </button>
            <button
              onClick={() => setActiveTab('completion')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === 'completion'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Target className="w-4 h-4 inline mr-1" />
              完成率
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === 'category' && (
              <div className="space-y-8">
                {/* 总体分布 */}
                {categoryData.length > 0 && (
                  <div className="space-y-6">
                    <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                      <PieChartIcon className="w-5 h-5" />
                      各分类笔记数量分布
                    </h4>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {categoryData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {categoryData.map((item, index) => (
                        <div key={item.name} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          ></div>
                          <span className="font-medium">{item.name}</span>
                          <span className="ml-auto text-gray-600">{item.value} 条</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {categoryData.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    暂无分类数据
                  </div>
                )}
              </div>
            )}

            {activeTab === 'today' && (
              <div className="space-y-6">
                {todayAddedData.length > 0 ? (
                  <>
                    <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-green-600" />
                      今日新增笔记分类分布
                    </h4>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={todayAddedData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                            outerRadius={100}
                            fill="#10b981"
                            dataKey="value"
                          >
                            {todayAddedData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {todayAddedData.map((item, index) => (
                        <div key={item.name} className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          ></div>
                          <span className="font-medium">{item.name}</span>
                          <span className="ml-auto text-green-600 font-semibold">{item.value} 条</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p>今日暂无新增笔记</p>
                    <p className="text-sm text-gray-400 mt-2">开始添加新笔记来查看分布情况</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'trend' && (
              <div className="space-y-6">
                <h4 className="font-semibold text-gray-800">最近7天学习笔记数量趋势</h4>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="added"
                        stroke="#4f46e5"
                        strokeWidth={2}
                        name="新增笔记"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-7 gap-2 text-center">
                  {trendData.map((day) => (
                    <div key={day.fullDate} className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-xs text-gray-500">{day.date}</div>
                      <div className="text-lg font-bold text-indigo-600 mt-1">{day.added}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'completion' && completionData.length > 0 && (
              <div className="space-y-6">
                <h4 className="font-semibold text-gray-800">各分类今日复习完成率</h4>
                <div className="space-y-4">
                  {completionData.map((item) => (
                    <div key={item.name} className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">{item.name}</span>
                        <span className="text-sm text-gray-600">
                          {item.isNewNoteOnly ? (
                            <span className="text-green-600">今日新添加 ({item.total}条)</span>
                          ) : (
                            `${item.completed}/${item.needReview} (${item.rate}%)`
                          )}
                        </span>
                      </div>
                      {!item.isNewNoteOnly && (
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${item.rate}%` }}
                          ></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

  
            {(completionData.length === 0 && activeTab === 'completion') && (
              <div className="text-center py-12 text-gray-500">
                暂无复习数据
              </div>
            )}
          </div>
        </div>
      </div>
    );
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

    // 获取排序后的分类列表
    const sortedCategories = [...categories].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

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
            {sortedCategories.map(cat => {
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

        {/* Enhanced Overview with Statistics */}
        <div className="px-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-bold text-gray-700">概览</h2>
            <div className="flex gap-2">
              <button
                onClick={exportDailyOverview}
                className="bg-green-600 text-white text-sm font-medium flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                title="导出详细概览（包含所有统计数据的可视化图片）"
              >
                <Download className="w-4 h-4" />
                导出详细报告
              </button>
              <button
                onClick={() => setShowAnalytics(true)}
                className="text-indigo-600 text-sm font-medium flex items-center gap-1"
              >
                <TrendingUp className="w-4 h-4" />
                查看详情
              </button>
            </div>
          </div>

          <div id="daily-overview-content">
            {/* Today's Stats */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4">
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-500" />
                今日统计
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-indigo-50 p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-indigo-600">{getTodayAddedNotes()}</div>
                  <div className="text-gray-600">新增笔记</div>
                </div>
                <div className="bg-green-50 p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-600">{getTodayCompletedReviews()}</div>
                  <div className="text-gray-600">完成复习</div>
                </div>
              </div>
            </div>


            {/* Overall Stats */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-700 mb-3">总体统计</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-center border-r border-gray-100">
                  <div className="text-xl font-bold text-gray-800">{notes.length}</div>
                  <div className="text-gray-600">总笔记</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-800">{notes.reduce((acc, n) => acc + n.stage, 0)}</div>
                  <div className="text-gray-600">累计记忆点</div>
                </div>
                <div className="text-center border-r border-gray-100 pt-3">
                  <div className="text-xl font-bold text-purple-600">{getMemoryAccuracy()}%</div>
                  <div className="text-gray-600">记忆准确率</div>
                </div>
                <div className="text-center pt-3">
                  <div className="text-xl font-bold text-orange-600">{dueCount}</div>
                  <div className="text-gray-600">待复习</div>
                </div>
              </div>
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
    const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
    const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
    const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);

    // 过滤掉已经复习过的笔记
    const availableDueNotes = dueNotes.filter(note => isNoteDue(note));
    const note = availableDueNotes[currentReviewIndex];

    if (!note) return <div className="p-10 text-center">加载中...</div>;

    const categoryName = categories.find(c => c.id === note.categoryId)?.name;
    const curve = settings.curveProfiles.find(c => c.id === note.curveId) || settings.curveProfiles[0];

    // 计算实际间隔天数 = 下一次复习的累计天数 - 当前复习的累计天数
    const currentCumulativeDays = note.stage < curve.intervals.length ? curve.intervals[note.stage] : curve.intervals[curve.intervals.length - 1];
    const nextCumulativeDays = note.stage + 1 < curve.intervals.length
      ? curve.intervals[note.stage + 1]
      : (curve.intervals[curve.intervals.length - 1] * 2);

    const nextInterval = nextCumulativeDays - currentCumulativeDays;

    // Swipe gesture handling for navigation
    const minSwipeDistance = 50;

    const onTouchStart = (e: React.TouchEvent) => {
      if (isAnimating) return;
      setTouchEnd(null);
      setTouchStart({
        x: e.targetTouches[0].clientX,
        y: e.targetTouches[0].clientY,
      });
    };

    const onTouchMove = (e: React.TouchEvent) => {
      if (isAnimating) return;
      setTouchEnd({
        x: e.targetTouches[0].clientX,
        y: e.targetTouches[0].clientY,
      });
    };

    // Calculate swipe progress for visual feedback
    const getSwipeProgress = () => {
      if (!touchStart || !touchEnd || isAnimating) return 0;

      const distanceX = touchStart.x - touchEnd.x;
      const distanceY = touchStart.y - touchEnd.y;
      const isHorizontalSwipe = Math.abs(distanceX) > Math.abs(distanceY);

      if (!isHorizontalSwipe) return 0;

      // Normalize progress between 0 and 1
      const progress = Math.min(Math.abs(distanceX) / minSwipeDistance, 1);
      return progress * (distanceX > 0 ? -1 : 1); // Negative for left, positive for right
    };

    // Get current swipe progress for real-time visual feedback
    const swipeProgress = getSwipeProgress();

    const onTouchEnd = () => {
      if (!touchStart || !touchEnd || isAnimating) return;

      const distanceX = touchStart.x - touchEnd.x;
      const distanceY = touchStart.y - touchEnd.y;
      const isHorizontalSwipe = Math.abs(distanceX) > Math.abs(distanceY);

      if (isHorizontalSwipe && Math.abs(distanceX) > minSwipeDistance) {
        setIsAnimating(true);

        if (distanceX > 0) {
          // Swipe left - next note
          if (currentReviewIndex < availableDueNotes.length - 1) {
            setSlideDirection('left');
            setTimeout(() => {
              setCurrentReviewIndex(prev => prev + 1);
              setShowAnswer(false);
              setSlideDirection(null);
              setIsAnimating(false);
            }, 300);
          } else {
            setIsAnimating(false);
          }
        } else {
          // Swipe right - previous note
          if (currentReviewIndex > 0) {
            setSlideDirection('right');
            setTimeout(() => {
              setCurrentReviewIndex(prev => prev - 1);
              setShowAnswer(false);
              setSlideDirection(null);
              setIsAnimating(false);
            }, 300);
          } else {
            setIsAnimating(false);
          }
        }
      }
    };

    return (
      <div className="h-full flex flex-col bg-gray-50">
        <div className="p-4 flex justify-between items-center text-gray-500">
          <button onClick={() => setView('dashboard')}><X className="w-6 h-6" /></button>
          <span className="font-mono">{currentReviewIndex + 1} / {availableDueNotes.length}</span>
          <div className="w-6"></div>
        </div>

        <div className="flex-1 p-4 flex flex-col justify-center max-w-md mx-auto w-full relative">
          {/* Swipe Progress Indicator */}
          {swipeProgress !== 0 && (
            <div className="absolute top-4 left-0 right-0 flex justify-center z-10">
              <div className="bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                {swipeProgress > 0 ? (
                  <>
                    <span>← 滑动返回</span>
                    <div className="w-16 bg-white/30 rounded-full h-1">
                      <div
                        className="bg-white h-1 rounded-full transition-all duration-100"
                        style={{ width: `${Math.abs(swipeProgress) * 100}%` }}
                      ></div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-16 bg-white/30 rounded-full h-1">
                      <div
                        className="bg-white h-1 rounded-full transition-all duration-100"
                        style={{ width: `${Math.abs(swipeProgress) * 100}%` }}
                      ></div>
                    </div>
                    <span>滑动继续 →</span>
                  </>
                )}
              </div>
            </div>
          )}

          <div
            className={`bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col min-h-[400px] relative cursor-pointer transition-all duration-300 ease-out ${
              slideDirection === 'left' ? 'translate-x-full opacity-0 scale-95' :
              slideDirection === 'right' ? '-translate-x-full opacity-0 scale-95' :
              'translate-x-0 opacity-100 scale-100'
            }`}
            style={{
              transform: swipeProgress !== 0
                ? `translateX(${swipeProgress * 20}px) scale(${1 - Math.abs(swipeProgress) * 0.05})`
                : undefined,
              opacity: swipeProgress !== 0
                ? 1 - Math.abs(swipeProgress) * 0.3
                : undefined
            }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onClick={() => {
              if (!showAnswer && !isAnimating) {
                setShowAnswer(true);
              }
            }}
          >
            <div className="p-8 flex-1 flex flex-col items-center justify-center text-center">
              <div className="flex gap-2 mb-4">
                <span className="inline-block px-3 py-1 rounded-full bg-gray-100 text-xs text-gray-500">
                  {categoryName}
                </span>
                <span className="inline-block px-3 py-1 rounded-full bg-indigo-50 text-xs text-indigo-600">
                  {curve.name} {note.stage === 0 ? '今日新添加' : `第${note.stage}次复习`}
                </span>
              </div>

              <h2 className="text-2xl font-bold text-gray-800 mb-4">{note.title}</h2>

              {!showAnswer && (
                <div className="space-y-4">
                  <p className="text-gray-400 text-sm animate-pulse">点击卡片显示答案</p>
                  <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
                    {currentReviewIndex > 0 && <span>← 滑动查看上一个</span>}
                    {currentReviewIndex < availableDueNotes.length - 1 && <span>滑动查看下一个 →</span>}
                  </div>
                </div>
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
                  <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-400">
                    {currentReviewIndex > 0 && <span>← 滑动查看上一个</span>}
                    {currentReviewIndex < availableDueNotes.length - 1 && <span>滑动查看下一个 →</span>}
                  </div>
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

  // Curve Visualization Component
  const CurveVisualization = ({
    curve,
    onClose
  }: {
    curve: CurveProfile;
    onClose: () => void;
  }) => {
    const [showDetails, setShowDetails] = useState(false);

    // Generate data points for the review curve visualization
    // This shows the actual review schedule (when reviews happen)
    const generateReviewCurveData = () => {
      const data = [];

      // Add initial point (day 0, first review)
      data.push({
        reviewNumber: 0,
        cumulativeDays: 0,
        interval: 0
      });

      // Generate points for each review interval
      for (let i = 0; i < curve.intervals.length; i++) {
        const cumulativeDays = curve.intervals[i];
        const interval = i === 0 ? cumulativeDays : cumulativeDays - curve.intervals[i - 1];

        data.push({
          reviewNumber: i + 1,
          cumulativeDays,
          interval
        });
      }

      return data;
    };

    const curveData = generateReviewCurveData();
    const maxCumulativeDays = Math.max(...curveData.map(d => d.cumulativeDays));
    const maxReviewNumber = curveData.length - 1;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
          {/* Header */}
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="font-bold text-lg">{curve.name} - 复习曲线</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Chart Area */}
          <div className="flex-1 p-4 overflow-y-auto">
            {/* Chart Container */}
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <div className="text-center text-sm text-gray-500 mb-2">
                复习时间点分布
              </div>

              {/* Chart */}
              <div className="relative h-48 bg-white rounded-lg border border-gray-200 p-2">
                {/* Y-axis labels (Review Numbers) */}
                <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col justify-between text-xs text-gray-400">
                  <span>第{maxReviewNumber}次</span>
                  <span>第{Math.floor(maxReviewNumber * 3/4)}次</span>
                  <span>第{Math.floor(maxReviewNumber / 2)}次</span>
                  <span>第{Math.floor(maxReviewNumber / 4)}次</span>
                  <span>第0次</span>
                </div>

                {/* X-axis labels (Days) */}
                <div className="absolute left-8 right-0 bottom-0 h-6 flex justify-between text-xs text-gray-400 px-2">
                  <span>0天</span>
                  <span>{Math.floor(maxCumulativeDays / 4)}天</span>
                  <span>{Math.floor(maxCumulativeDays / 2)}天</span>
                  <span>{Math.floor(maxCumulativeDays * 3 / 4)}天</span>
                  <span>{maxCumulativeDays}天</span>
                </div>

                {/* Chart content */}
                <div className="absolute left-8 right-2 top-2 bottom-6">
                  {/* Grid lines */}
                  <div className="absolute inset-0 grid grid-cols-4 grid-rows-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="border-r border-gray-100 last:border-r-0" />
                    ))}
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="border-b border-gray-100 last:border-b-0" />
                    ))}
                  </div>

                  {/* Review points */}
                  <svg className="w-full h-full" viewBox={`0 0 100 100`} preserveAspectRatio="none">
                    {/* Vertical lines for each review point */}
                    {curveData.map((point, index) => (
                      <line
                        key={index}
                        x1={(point.cumulativeDays / maxCumulativeDays) * 100}
                        y1="0"
                        x2={(point.cumulativeDays / maxCumulativeDays) * 100}
                        y2="100"
                        stroke="#e5e7eb"
                        strokeWidth="1"
                        strokeDasharray="2,2"
                      />
                    ))}

                    {/* Review points */}
                    {curveData.map((point, index) => (
                      <circle
                        key={index}
                        cx={(point.cumulativeDays / maxCumulativeDays) * 100}
                        cy={100 - ((point.reviewNumber / maxReviewNumber) * 100)}
                        r="3"
                        fill="#4f46e5"
                        className="cursor-pointer hover:r-4 transition-all"
                      />
                    ))}

                    {/* Connecting lines between review points */}
                    <path
                      d={`M 0,100 ${curveData.map((point) =>
                        `L ${(point.cumulativeDays / maxCumulativeDays) * 100},${100 - ((point.reviewNumber / maxReviewNumber) * 100)}`
                      ).join(' ')}`}
                      fill="none"
                      stroke="#4f46e5"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>

              <div className="text-center text-xs text-gray-500 mt-2">
                从第一天开始的天数 (X轴) vs 复习次数 (Y轴)
              </div>
            </div>

            {/* Interval Details */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-sm text-gray-700">复习间隔详情</h4>
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-xs text-indigo-600 flex items-center gap-1"
                >
                  <Eye className="w-3 h-3" />
                  {showDetails ? '隐藏详情' : '显示详情'}
                </button>
              </div>

              {showDetails && (
                <div className="bg-gray-50 rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
                  {curveData.slice(1).map((point, index) => (
                    <div key={index} className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">
                        第{point.reviewNumber}次复习
                      </span>
                      <div className="flex gap-4">
                        <span className="text-gray-500">
                          第{point.cumulativeDays}天
                        </span>
                        <span className="text-indigo-600 font-medium">
                          间隔: {point.interval}天
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t">
            <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
              <div className="text-center">
                <div className="font-bold text-gray-800">{curve.intervals.length}</div>
                <div>复习次数</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-gray-800">{maxCumulativeDays}</div>
                <div>总周期</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Curve Editor Component
  const CurveEditor = ({
    curve,
    isNew,
    onSave,
    onCancel
  }: {
    curve: CurveProfile;
    isNew: boolean;
    onSave: (curve: CurveProfile) => void;
    onCancel: () => void;
  }) => {
    const [name, setName] = useState(curve.name);
    const [intervals, setIntervals] = useState(curve.intervals.join(', '));
    const [errors, setErrors] = useState<string[]>([]);

    const validate = () => {
      const newErrors: string[] = [];

      if (!name.trim()) {
        newErrors.push('曲线名称不能为空');
      }

      const parsedIntervals = intervals
        .split(',')
        .map(n => parseFloat(n.trim()))
        .filter(n => !isNaN(n) && n > 0);

      if (parsedIntervals.length === 0) {
        newErrors.push('请输入有效的间隔天数');
      }

      if (parsedIntervals.some(n => n <= 0)) {
        newErrors.push('间隔天数必须大于0');
      }

      setErrors(newErrors);
      return newErrors.length === 0;
    };

    const handleSave = () => {
      if (!validate()) return;

      const parsedIntervals = intervals
        .split(',')
        .map(n => parseFloat(n.trim()))
        .filter(n => !isNaN(n) && n > 0);

      const updatedCurve: CurveProfile = {
        ...curve,
        name: name.trim(),
        intervals: parsedIntervals
      };

      onSave(updatedCurve);
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-lg">
              {isNew ? '新建遗忘曲线' : '编辑遗忘曲线'}
            </h3>
            <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>

          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              {errors.map((error, idx) => (
                <div key={idx} className="text-red-600 text-sm flex items-center gap-1">
                  • {error}
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-500 mb-1">曲线名称</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="例如：英语单词专项"
              className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-500 mb-1">
              复习间隔 (天)
              <span className="text-xs text-gray-400 ml-1">用逗号分隔</span>
            </label>
            <textarea
              value={intervals}
              onChange={e => setIntervals(e.target.value)}
              placeholder="例如：1, 2, 3, 5, 8, 13, 21, 34"
              className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none font-mono text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">
              输入复习间隔天数，用逗号分隔。例如：第1天、第2天、第3天、第5天...
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onCancel}
              className="flex-1 py-3 border border-gray-300 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    );
  };

  const SettingsView = () => {
    const [editedCurves, setEditedCurves] = useState<CurveProfile[]>(settings.curveProfiles);
    const [isDirty, setIsDirty] = useState(false);
    const [quota, setQuota] = useState<{usage: number, quota: number} | null>(null);
    const [editingCurve, setEditingCurve] = useState<CurveProfile | null>(null);
    const [isNewCurve, setIsNewCurve] = useState(false);
    const [viewingCurve, setViewingCurve] = useState<CurveProfile | null>(null);

    useEffect(() => {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            navigator.storage.estimate().then(({usage, quota}) => {
                setQuota({ usage: usage || 0, quota: quota || 0 });
            });
        }
    }, []);


    const addCurve = () => {
      // 确保新曲线有唯一的ID，避免与默认曲线冲突
      let newId: string;
      do {
        newId = generateId();
      } while (editedCurves.some(curve => curve.id === newId));

      const newCurve: CurveProfile = {
        id: newId,
        name: '新曲线',
        intervals: [1, 2, 3, 5],
        isDefault: false
      };

      setEditingCurve(newCurve);
      setIsNewCurve(true);
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
                <TrendingUp className="w-5 h-5 text-indigo-500" /> 遗忘曲线管理
              </h3>
              <button onClick={addCurve} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded font-bold">+ 新建</button>
            </div>
            
            <div className="space-y-4">
              {editedCurves.map((curve, idx) => (
                <div key={curve.id} className="border-b pb-4 last:border-0 last:pb-0">
                  <div className="flex justify-between items-center mb-2">
                    <div
                      className="font-bold text-sm cursor-pointer hover:text-indigo-600 flex items-center gap-1"
                      onClick={() => {
                        setEditingCurve(curve);
                        setIsNewCurve(false);
                      }}
                    >
                      {curve.name}
                      <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setViewingCurve(curve)}
                        className="text-gray-400 hover:text-indigo-500"
                        title="查看曲线可视化"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {!curve.isDefault && (
                        <button onClick={() => deleteCurve(idx)} className="text-gray-400 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mb-1">间隔 (天):</div>
                  <div
                    className="w-full p-2 bg-gray-50 rounded-lg font-mono text-xs cursor-pointer hover:bg-gray-100 transition-colors max-h-16 overflow-y-auto"
                    onClick={() => {
                      setEditingCurve(curve);
                      setIsNewCurve(false);
                    }}
                    title="点击编辑间隔"
                  >
                    {curve.intervals.length <= 10 ? curve.intervals.join(', ') :
                      `${curve.intervals.slice(0, 8).join(', ')}, ... 共${curve.intervals.length}个间隔`}
                  </div>
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

        {/* Curve Editor Modal */}
        {editingCurve && (
          <CurveEditor
            curve={editingCurve}
            isNew={isNewCurve}
            onSave={(updatedCurve) => {
              let newCurves: CurveProfile[];

              if (isNewCurve) {
                // Add new curve
                newCurves = [...editedCurves, updatedCurve];
              } else {
                // Update existing curve
                const index = editedCurves.findIndex(c => c.id === updatedCurve.id);
                if (index !== -1) {
                  newCurves = [...editedCurves];
                  newCurves[index] = updatedCurve;
                } else {
                  newCurves = editedCurves;
                }
              }

              // Update state and save to database immediately
              setEditedCurves(newCurves);
              saveSettingsToDB({ ...settings, curveProfiles: newCurves });
              setIsDirty(false);
              setEditingCurve(null);
              setIsNewCurve(false);
              showToast(isNewCurve ? '曲线已创建' : '曲线已更新');
            }}
            onCancel={() => {
              setEditingCurve(null);
              setIsNewCurve(false);
            }}
          />
        )}

        {/* Curve Visualization Modal */}
        {viewingCurve && (
          <CurveVisualization
            curve={viewingCurve}
            onClose={() => setViewingCurve(null)}
          />
        )}
      </div>
    );
  };

  const CategoryManager = () => {
    const [editingNote, setEditingNote] = useState<Note | null>(null);
    const [newCatName, setNewCatName] = useState('');
    const [selectedColor, setSelectedColor] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; category: Category | null }>({ show: false, category: null });

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
          } catch {
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

      // 检查分类名称是否已存在
      const existingCategory = categories.find(cat =>
        cat.name.toLowerCase().trim() === newCatName.toLowerCase().trim()
      );

      if (existingCategory) {
        showToast('分类名称已存在，请选择其他名称', 'error');
        return;
      }

      const colors = [
        'bg-red-100 text-red-800',
        'bg-blue-100 text-blue-800',
        'bg-green-100 text-green-800',
        'bg-yellow-100 text-yellow-800',
        'bg-purple-100 text-purple-800',
        'bg-pink-100 text-pink-800',
        'bg-indigo-100 text-indigo-800',
        'bg-orange-100 text-orange-800',
        'bg-teal-100 text-teal-800',
        'bg-cyan-100 text-cyan-800',
        'bg-lime-100 text-lime-800',
        'bg-emerald-100 text-emerald-800',
        'bg-sky-100 text-sky-800',
        'bg-violet-100 text-violet-800',
        'bg-fuchsia-100 text-fuchsia-800',
        'bg-rose-100 text-rose-800',
        'bg-amber-100 text-amber-800'
      ];
      const color = selectedColor || colors[Math.floor(Math.random() * colors.length)];
      const newCat = {
        id: generateId(),
        name: newCatName,
        color,
        sortOrder: categories.length // 新分类添加到最后
      };

      await dbHelper.put(STORE_CATS, newCat);
      setCategories([...categories, newCat]);
      setNewCatName('');
      setSelectedColor('');
    };

    const deleteCat = async (id: string) => {
      const category = categories.find(c => c.id === id);
      if (!category) return;

      if(notes.some(n => n.categoryId === id)) {
        showToast('无法删除：该分类下还有笔记', 'error');
        return;
      }

      // Show confirmation modal
      setDeleteConfirm({ show: true, category });
    };

    const confirmDelete = async () => {
      if (deleteConfirm.category) {
        await dbHelper.delete(STORE_CATS, deleteConfirm.category.id);
        setCategories(categories.filter(c => c.id !== deleteConfirm.category!.id));
        setDeleteConfirm({ show: false, category: null });
        showToast('分类已删除');
      }
    };

    const cancelDelete = () => {
      setDeleteConfirm({ show: false, category: null });
    };

    // 处理拖拽排序
    const handleDragEnd = (result: { destination?: { index: number } | null; source: { index: number } }) => {
      if (!result.destination) return;

      const { source, destination } = result;

      // 如果拖拽到相同位置，不做任何操作
      if (source.index === destination.index) return;

      // 获取排序后的分类列表
      const sortedCategories = [...categories].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

      // 重新排序
      const [removed] = sortedCategories.splice(source.index, 1);
      sortedCategories.splice(destination.index, 0, removed);

      // 更新排序顺序
      const updatedCategories = sortedCategories.map((cat, index) => ({
        ...cat,
        sortOrder: index
      }));

      // 批量保存到数据库
      Promise.all(updatedCategories.map(cat => dbHelper.put(STORE_CATS, cat)))
        .then(() => {
          setCategories(updatedCategories);
          showToast('分类排序已更新');
        })
        .catch(() => {
          showToast('分类排序更新失败', 'error');
        });
    };

    // 获取排序后的分类列表
    const sortedCategories = [...categories].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

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
                    <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded">{n.stage === 0 ? '今日新添加' : `第${n.stage}次复习`}</span>
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
            <div className="mb-6">
              <div className="flex gap-2 mb-3">
                <input
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  placeholder="新分类名称"
                  className="flex-1 p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <button onClick={addCat} className="bg-indigo-600 text-white px-4 rounded-xl font-bold">添加</button>
              </div>

              {/* 颜色选择器 */}
              <div className="mb-3">
                <p className="text-sm text-gray-600 mb-2">选择颜色（可选，不选则随机）</p>
                <div className="grid grid-cols-8 gap-2">
                  {[
                    'bg-red-500',
                    'bg-blue-500',
                    'bg-green-500',
                    'bg-yellow-500',
                    'bg-purple-500',
                    'bg-pink-500',
                    'bg-indigo-500',
                    'bg-orange-500',
                    'bg-teal-500',
                    'bg-cyan-500',
                    'bg-lime-500',
                    'bg-emerald-500',
                    'bg-sky-500',
                    'bg-violet-500',
                    'bg-fuchsia-500',
                    'bg-rose-500',
                    'bg-amber-500'
                  ].map((color, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedColor(color.replace('500', '100') + ' ' + color.replace('500', '800'))}
                      className={`w-8 h-8 rounded-full ${color} ${selectedColor === color.replace('500', '100') + ' ' + color.replace('500', '800') ? 'ring-2 ring-gray-400 ring-offset-2' : 'hover:scale-110'} transition-transform`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="categories">
                  {(provided, snapshot) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className={`space-y-3 ${snapshot.isDraggingOver ? 'bg-gray-50 rounded-xl p-2' : ''}`}
                    >
                      {sortedCategories.map((c, index) => (
                        <Draggable key={c.id} draggableId={c.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`bg-white p-4 rounded-xl shadow-sm flex justify-between items-center transition-all ${
                                snapshot.isDragging ? 'shadow-lg scale-105' : ''
                              }`}
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <div
                                  {...provided.dragHandleProps}
                                  className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
                                >
                                  <GripVertical className="w-5 h-5" />
                                </div>
                                <div className={`w-3 h-3 rounded-full ${c.color.split(' ')[0].replace('bg', 'bg')}`}></div>
                                <span className="font-medium">{c.name}</span>
                              </div>
                              <button onClick={() => deleteCat(c.id)} className="text-gray-300 hover:text-red-500">
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </div>
          </div>

          {/* Delete Confirmation Modal */}
          {deleteConfirm.show && deleteConfirm.category && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 animate-in fade-in zoom-in-95">
                <div className="text-center">
                  <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-3">
                    <Trash2 className="w-6 h-6 text-red-600" />
                  </div>
                  <h3 className="font-bold text-lg text-gray-800 mb-2">确认删除分类</h3>
                  <p className="text-gray-600 text-sm">
                    确定要删除分类 <span className="font-semibold text-gray-800">{deleteConfirm.category.name}</span> 吗？
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    此操作不可撤销，删除后无法恢复
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={cancelDelete}
                    className="flex-1 py-2 border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition"
                  >
                    取消
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="flex-1 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          )}
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

      {/* Analytics Overview Modal */}
      {showAnalytics && <AnalyticsOverview />}

      {/* Show Nav bar only on main screens */}
      {(view === 'dashboard' || view === 'settings' || (view === 'category' && !activeCategory)) && <NavBar />}
    </div>
  );
}