export interface CurveProfile {
    id: string;
    name: string;
    intervals: number[];
    isDefault?: boolean;
  }

  // 用户认证相关接口
  export interface User {
    id: string;
    email: string;
    email_confirmed_at?: string;
    user_metadata?: Record<string, any>;
  }

  export interface AuthContextType {
    user: User | null;
    session: any;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
    signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
    isAuthenticated: boolean;
  }
  
  export interface Note {
    id: string;
    title: string;
    content: string;
    categoryId: string;
    curveId: string;
    images: string[];
    createdAt: number;
    nextReviewDate: number;
    stage: number;
    reviewHistory: { date: number; action: 'remembered' | 'forgot' }[];
    aiAnalysis?: {
      content: string;
      generatedAt: number;
    };
  }
  
  export interface Category {
    id: string;
    name: string;
    color: string;
    sortOrder?: number;
  }
  
  export interface AppSettings {
    curveProfiles: CurveProfile[];
    enableNotifications: boolean;
    aiConfig: {
      provider: 'deepseek' | 'openai' | 'openrouter';
      enabled: boolean;
      // 每个提供商独立的配置
      deepseek: {
        baseURL: string;
        apiKey: string;
        model: string;
      };
      openai: {
        baseURL: string;
        apiKey: string;
        model: string;
      };
      openrouter: {
        baseURL: string;
        apiKey: string;
        model: string;
        siteUrl?: string;
        siteName?: string;
      };
    };
  }
  
  // 为了方便 Context 使用，我们定义 Context 的接口
  export interface AppContextType {
    loading: boolean;
    notes: Note[];
    categories: Category[];
    settings: AppSettings;
    setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
    view: 'dashboard' | 'add' | 'review' | 'settings' | 'category' | 'ai-analysis';
    setView: (view: 'dashboard' | 'add' | 'review' | 'settings' | 'category' | 'ai-analysis') => void;
    activeCategory: string | null;
    setActiveCategory: (id: string | null) => void;
    currentReviewIndex: number;
    setCurrentReviewIndex: React.Dispatch<React.SetStateAction<number>>;
    toast: { msg: string; type: 'success' | 'error' } | null;
    showToast: (msg: string, type?: 'success' | 'error') => void;
    previewImage: string | null;
    setPreviewImage: (img: string | null) => void;
    showAnalytics: boolean;
    setShowAnalytics: (show: boolean) => void;
    aiAnalysisNote: Note | null;
    setAIAnalysisNote: (note: Note | null) => void;
    
    // Actions
    saveNoteToDB: (note: Note) => Promise<void>;
    deleteNoteFromDB: (id: string) => Promise<void>;
    saveSettingsToDB: (newSettings: AppSettings) => Promise<void>;
    handleAddNote: (noteData: Omit<Note, 'id' | 'createdAt' | 'nextReviewDate' | 'stage' | 'reviewHistory'>) => Promise<void>;
    handleUpdateNote: (updatedNote: Note) => Promise<void>;
    handleDeleteNote: (id: string) => Promise<void>;
    handleReview: (note: Note, result: 'remembered' | 'forgot') => Promise<void>;
    requestNotificationPermission: () => void;
    handleExportData: () => Promise<void>;
    handleImportData: (e: React.ChangeEvent<HTMLInputElement>) => void;
    setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
    setNotes: React.Dispatch<React.SetStateAction<Note[]>>;
  }