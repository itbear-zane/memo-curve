import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { isBefore, startOfDay } from 'date-fns';
import type { Note, Category } from '../types';

export const useAnalytics = () => {
  const { notes, categories } = useApp();

  // Use state to track current time and avoid calling Date.now() directly in useMemo
  const [currentTime] = useState(() => Date.now());

  const todayAddedNotes = useMemo((): Note[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return notes.filter(note => {
      const noteDate = new Date(note.createdAt);
      return noteDate >= today && noteDate < tomorrow;
    });
  }, [notes]);

  const todayCompletedReviews = useMemo((): { date: number; action: 'remembered' | 'forgot' }[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return notes.flatMap(note =>
      note.reviewHistory.filter(review => {
        const reviewDate = new Date(review.date);
        return reviewDate >= today && reviewDate < tomorrow;
      })
    );
  }, [notes]);

  const memoryAccuracy = useMemo((): number => {
    const reviews = notes.flatMap(note => note.reviewHistory);
    if (reviews.length === 0) return 0;

    const rememberedCount = reviews.filter(review => review.action === 'remembered').length;
    return (rememberedCount / reviews.length) * 100;
  }, [notes]);

  const dueNotes = useMemo((): Note[] => {
    return notes.filter(note => {
      // Check if note is due (overdue after start of review day)
      const reviewDayStart = startOfDay(note.nextReviewDate);
      return isBefore(reviewDayStart, currentTime);
    });
  }, [notes, currentTime]);

  const categoryDistribution = useMemo((): { category: Category; count: number }[] => {
    return categories
      .map(category => ({
        category,
        count: notes.filter(note => note.categoryId === category.id).length,
      }))
      .filter(item => item.count > 0);
  }, [notes, categories]);

  const todayAddedCategoryDistribution = useMemo((): { category: Category; count: number }[] => {
    return categories
      .map(category => ({
        category,
        count: todayAddedNotes.filter(note => note.categoryId === category.id).length,
      }))
      .filter(item => item.count > 0);
  }, [categories, todayAddedNotes]);

  const dailyLearningTrend = useMemo((): { date: string; added: number; reviews: number; remembered: number; forgot: number }[] => {
    const last7Days = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayReviews = notes.flatMap(note =>
        note.reviewHistory.filter(review => {
          const reviewDate = new Date(review.date);
          return reviewDate >= date && reviewDate < nextDate;
        })
      );

      last7Days.push({
        date: date.toISOString().split('T')[0],
        added: notes.filter(note => {
          const noteDate = new Date(note.createdAt);
          return noteDate >= date && noteDate < nextDate;
        }).length,
        reviews: dayReviews.length,
        remembered: dayReviews.filter(r => r.action === 'remembered').length,
        forgot: dayReviews.filter(r => r.action === 'forgot').length,
      });
    }

    return last7Days;
  }, [notes]);

  const categoryCompletionRates = useMemo((): { category: Category; rate: number; count: number }[] => {
    return categories.map(category => {
      const categoryNotes = notes.filter(note => note.categoryId === category.id);
      if (categoryNotes.length === 0) return { category, rate: 0, count: 0 };

      const totalReviews = categoryNotes.reduce((sum, note) => sum + note.reviewHistory.length, 0);
      const rememberedReviews = categoryNotes.reduce((sum, note) =>
        sum + note.reviewHistory.filter(r => r.action === 'remembered').length, 0
      );

      return {
        category,
        rate: totalReviews > 0 ? (rememberedReviews / totalReviews) * 100 : 0,
        count: totalReviews,
      };
    });
  }, [notes, categories]);

  return {
    getTodayAddedNotes: () => todayAddedNotes,
    getTodayCompletedReviews: () => todayCompletedReviews,
    getMemoryAccuracy: () => memoryAccuracy,
    dueNotes: () => dueNotes,
    getCategoryDistribution: () => categoryDistribution,
    getTodayAddedCategoryDistribution: () => todayAddedCategoryDistribution,
    getDailyLearningTrend: () => dailyLearningTrend,
    getCategoryCompletionRates: () => categoryCompletionRates,
  };
};