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

export type { CurveProfile, Note, Category, AppSettings };
export { DEFAULT_CURVES, DEFAULT_CATEGORIES };
