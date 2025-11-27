import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import dbHelper, { STORE_NOTES, STORE_CATS, STORE_SETTINGS } from '../utils/database';
import { generateId, isNoteDue } from '../utils/helper_functions';
import type { Note, Category, AppSettings, AppContextType } from '../types';
import { DEFAULT_CURVES, DEFAULT_CATEGORIES } from '../constants';
import { loadAIKeysFromSupabase } from '../utils/aiKeyService';

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  // --- State ---
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Note[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    curveProfiles: DEFAULT_CURVES,
    enableNotifications: false,
    aiConfig: {
      provider: 'openrouter',
      enabled: false,
      deepseek: {
        baseURL: 'https://api.deepseek.com',
        apiKey: '',
        model: 'deepseek-chat',
      },
      openai: {
        baseURL: 'https://api.openai.com',
        apiKey: '',
        model: 'gpt-4o-mini',
      },
      openrouter: {
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: '',
        model: 'qwen/qwen3-vl-235b-a22b-instruct',
        siteUrl: '',
        siteName: '',
      },
      dashscope: {
        baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        apiKey: '',
        model: 'qwen3-vl-plus',
      },
    },
  });

  const [view, setView] = useState<'dashboard' | 'add' | 'review' | 'settings' | 'category' | 'ai-analysis'>('dashboard');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [aiAnalysisNote, setAIAnalysisNote] = useState<Note | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [onAuthModalClose, setOnAuthModalClose] = useState<(() => void) | undefined>(undefined);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // --- Initialization ---
  useEffect(() => {
    const init = async () => {
      try {
        await dbHelper.init();
        const dbNotes = await dbHelper.getAll<Note>(STORE_NOTES);
        const dbCats = await dbHelper.getAll<Category>(STORE_CATS);
        const dbSettings = await dbHelper.get<AppSettings>(STORE_SETTINGS, 'config');

        // Migration Check
        const lsNotes = localStorage.getItem('memo_notes');
        if (dbNotes.length === 0 && lsNotes) {
          console.log("Migrating from LocalStorage to IndexedDB...");
          const parsedNotes = JSON.parse(lsNotes);
          const parsedCats = JSON.parse(localStorage.getItem('memo_cats') || '[]');
          const parsedSettings = JSON.parse(localStorage.getItem('memo_settings') || '{}');

          for (const n of parsedNotes) await dbHelper.put(STORE_NOTES, n);
          for (const c of parsedCats) await dbHelper.put(STORE_CATS, c);
          if (parsedSettings) await dbHelper.put(STORE_SETTINGS, parsedSettings, 'config');

          setNotes(parsedNotes);
          if (parsedCats.length) setCategories(parsedCats);
          if (parsedSettings.curveProfiles) setSettings(parsedSettings);
          showToast("数据已升级到大容量存储");
        } else if (dbCats.length === 0) {
          console.log("Saving default categories to IndexedDB...");
          const categoriesWithSortOrder = DEFAULT_CATEGORIES.map((cat, index) => ({
            ...cat,
            sortOrder: index
          }));
          for (const c of categoriesWithSortOrder) await dbHelper.put(STORE_CATS, c as Category);
          setCategories(categoriesWithSortOrder);
          if (dbSettings) setSettings((prev: AppSettings) => ({ ...prev, ...dbSettings }));
        } else {
          setNotes(dbNotes);
          if (dbCats.length > 0) {
            const categoriesWithSortOrder = dbCats.map((cat: Category, index: number) => ({
              ...cat,
              sortOrder: cat.sortOrder ?? index
            }));
            setCategories(categoriesWithSortOrder);
          }
          if (dbSettings) {
            // 迁移旧的 AI 配置格式到新格式
            let migratedSettings = { ...dbSettings };
            if (dbSettings.aiConfig && 'baseURL' in dbSettings.aiConfig) {
              // 旧格式，需要迁移
              const oldConfig = dbSettings.aiConfig as any;
              migratedSettings = {
                ...dbSettings,
                aiConfig: {
                  provider: oldConfig.provider === 'custom' ? 'openrouter' : (oldConfig.provider || 'openrouter'),
                  enabled: oldConfig.enabled || false,
                  deepseek: {
                    baseURL: oldConfig.provider === 'deepseek' ? (oldConfig.baseURL || 'https://api.deepseek.com') : 'https://api.deepseek.com',
                    apiKey: oldConfig.provider === 'deepseek' ? (oldConfig.apiKey || '') : '',
                    model: oldConfig.provider === 'deepseek' ? (oldConfig.model || 'deepseek-chat') : 'deepseek-chat',
                  },
                  openai: {
                    baseURL: oldConfig.provider === 'openai' ? (oldConfig.baseURL || 'https://api.openai.com') : 'https://api.openai.com',
                    apiKey: oldConfig.provider === 'openai' ? (oldConfig.apiKey || '') : '',
                    model: oldConfig.provider === 'openai' ? (oldConfig.model || 'gpt-4o-mini') : 'gpt-4o-mini',
                  },
                  openrouter: {
                    baseURL: oldConfig.provider === 'openrouter' || oldConfig.provider === 'custom' ? (oldConfig.baseURL || 'https://openrouter.ai/api/v1') : 'https://openrouter.ai/api/v1',
                    apiKey: oldConfig.provider === 'openrouter' || oldConfig.provider === 'custom' ? (oldConfig.apiKey || '') : '',
                    model: oldConfig.provider === 'openrouter' || oldConfig.provider === 'custom' ? (oldConfig.model || 'qwen/qwen3-vl-235b-a22b-instruct') : 'qwen/qwen3-vl-235b-a22b-instruct',
                    siteUrl: oldConfig.siteUrl || '',
                    siteName: oldConfig.siteName || '',
                  },
                  dashscope: {
                    baseURL: oldConfig.provider === 'dashscope' ? (oldConfig.baseURL || 'https://dashscope.aliyuncs.com/compatible-mode/v1') : 'https://dashscope.aliyuncs.com/compatible-mode/v1',
                    apiKey: oldConfig.provider === 'dashscope' ? (oldConfig.apiKey || '') : '',
                    model: oldConfig.provider === 'dashscope' ? (oldConfig.model || 'qwen3-vl-plus') : 'qwen3-vl-plus',
                  },
                }
              };
              // 保存迁移后的配置
              await dbHelper.put(STORE_SETTINGS, migratedSettings, 'config');
              console.log('AI 配置已迁移到新格式');
            }

            // 从 Supabase 加载 AI API 密钥并合并
            try {
              console.log('开始从 Supabase 加载 AI 密钥...');
              const updatedSettings = await loadAIKeysFromSupabase(migratedSettings);
              
              // 如果从 Supabase 成功加载了密钥,使用更新后的配置
              if (updatedSettings.aiConfig.openrouter.apiKey || 
                  updatedSettings.aiConfig.deepseek.apiKey || 
                  updatedSettings.aiConfig.openai.apiKey ||
                  updatedSettings.aiConfig.dashscope.apiKey) {
                migratedSettings = updatedSettings;
                // 同时保存到本地数据库
                await dbHelper.put(STORE_SETTINGS, updatedSettings, 'config');
                console.log('✅ AI 密钥已从 Supabase 同步到本地');
              }
            } catch (supabaseError) {
              console.warn('从 Supabase 加载 AI 密钥失败,将使用本地配置:', supabaseError);
              // 不影响应用正常启动,仅记录警告
            }

            setSettings((prev: AppSettings) => ({ ...prev, ...migratedSettings }));
          }
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

  // --- Notifications ---
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

  // --- Actions ---
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

  const handleAddNote = async (noteData: Omit<Note, 'id' | 'createdAt' | 'nextReviewDate' | 'stage' | 'reviewHistory'>) => {
    const curve = settings.curveProfiles.find(c => c.id === noteData.curveId) || settings.curveProfiles[0];
    const firstIntervalDays = curve.intervals[0] || 1;

    // Calculate target date and set to midnight (00:00:00)
    const targetDate = new Date(Date.now() + (firstIntervalDays * 24 * 60 * 60 * 1000));
    targetDate.setHours(0, 0, 0, 0);
    const firstReviewDate = targetDate.getTime();

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
      const currentCumulativeDays = note.stage < intervals.length ? intervals[note.stage] : intervals[intervals.length - 1];
      const nextCumulativeDays = newStage < intervals.length
        ? intervals[newStage]
        : (intervals[intervals.length - 1] * 2);
      const actualIntervalDays = nextCumulativeDays - currentCumulativeDays;

      // Calculate target date and set to midnight (00:00:00)
      const targetDate = new Date(Date.now() + (actualIntervalDays * 24 * 60 * 60 * 1000));
      targetDate.setHours(0, 0, 0, 0);
      nextDate = targetDate.getTime();
    } else {
      newStage = Math.max(0, note.stage - 1);
      if (note.stage <= 1) newStage = 0;
      const targetDate = new Date(Date.now() + (24 * 60 * 60 * 1000));
      targetDate.setHours(0, 0, 0, 0);
      nextDate = targetDate.getTime();
    }

    const updatedNote: Note = {
      ...note,
      stage: newStage,
      nextReviewDate: nextDate,
      reviewHistory: [...note.reviewHistory, { date: Date.now(), action: result }]
    };

    await saveNoteToDB(updatedNote);

    const dueNotes = notes.filter(n => isNoteDue(n)).sort((a, b) => a.nextReviewDate - b.nextReviewDate);
    const remainingDueNotes = dueNotes.filter(n => n.id !== note.id);

    if (remainingDueNotes.length > 0) {
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

  const handleExportData = async () => {
    const exportData = { notes, categories, settings, exportedAt: Date.now() };
    const blob = new Blob([JSON.stringify(exportData)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `memocurve_backup_${new Date().toISOString().slice(0, 10)}.json`;
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
          if (!confirm('导入将覆盖现有的一些数据（如果ID相同），确定吗？建议先备份。')) return;
          setLoading(true);
          for (const n of data.notes) await dbHelper.put(STORE_NOTES, n);
          if (data.categories) for (const c of data.categories) await dbHelper.put(STORE_CATS, c);
          if (data.settings) await dbHelper.put(STORE_SETTINGS, data.settings, 'config');

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

  const value = {
    loading, notes, categories, settings, setSettings,
    view, setView, activeCategory, setActiveCategory,
    currentReviewIndex, setCurrentReviewIndex,
    toast, showToast, previewImage, setPreviewImage,
    showAnalytics, setShowAnalytics,
    aiAnalysisNote, setAIAnalysisNote,
    showAuthModal, setShowAuthModal,
    onAuthModalClose, setOnAuthModalClose,
    saveNoteToDB, deleteNoteFromDB, saveSettingsToDB,
    handleAddNote, handleUpdateNote, handleDeleteNote, handleReview,
    requestNotificationPermission, handleExportData, handleImportData,
    setCategories, setNotes
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};