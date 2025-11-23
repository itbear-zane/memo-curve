import { isBefore, endOfDay, isToday } from 'date-fns';
import type { Note } from '../constants'

// --- Helper Functions ---

export const generateId = () => Math.random().toString(36).substring(2, 11);

export const getRelativeTime = (timestamp: number) => {
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
export const isNoteOverdue = (note: Note): boolean => {
    const reviewDayEnd = endOfDay(note.nextReviewDate);
    return isBefore(reviewDayEnd, Date.now());
};

// Check if a note is due (overdue after end of review day)
export const isNoteDue = (note: Note): boolean => {
    return isNoteOverdue(note);
};

// Compress image to avoid massive blobs if user uploads 4k photos
export const compressImage = async (file: File): Promise<string> => {
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
