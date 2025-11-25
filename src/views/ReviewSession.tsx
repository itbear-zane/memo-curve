import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAnalytics } from '../hooks/useAnalytics';

const ReviewSession = () => {
  const { categories, settings, currentReviewIndex, setCurrentReviewIndex, handleReview, setView, setPreviewImage } = useApp();
  const { dueNotes } = useAnalytics();

  const [showAnswer, setShowAnswer] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const availableDueNotes = dueNotes();
  const note = availableDueNotes[currentReviewIndex];

  if (!note) {
    if (availableDueNotes.length === 0) {
      return (
        <div className="h-full flex flex-col bg-gray-50">
          <div className="p-4 flex justify-between items-center text-gray-500">
            <button onClick={() => setView('dashboard')}><X className="w-6 h-6" /></button>
            <span className="font-mono">0 / 0</span>
            <div className="w-6"></div>
          </div>
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center text-gray-500">
              <p className="text-lg mb-2">没有待复习的笔记</p>
              <p className="text-sm">所有笔记都已复习完成！</p>
            </div>
          </div>
        </div>
      );
    }
    return <div className="p-10 text-center">加载中...</div>;
  }

  const categoryName = categories.find(c => c.id === note.categoryId)?.name;
  const curve = settings.curveProfiles.find(c => c.id === note.curveId) || settings.curveProfiles[0];
  
  const currentCumulativeDays = note.stage < curve.intervals.length ? curve.intervals[note.stage] : curve.intervals[curve.intervals.length - 1];
  const nextCumulativeDays = note.stage + 1 < curve.intervals.length ? curve.intervals[note.stage + 1] : (curve.intervals[curve.intervals.length - 1] * 2);
  const nextInterval = nextCumulativeDays - currentCumulativeDays;

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    if (isAnimating) return;
    setTouchEnd(null);
    setTouchStart({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (isAnimating) return;
    setTouchEnd({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
  };

  const getSwipeProgress = () => {
    if (!touchStart || !touchEnd || isAnimating) return 0;
    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    if (Math.abs(distanceX) <= Math.abs(distanceY)) return 0;
    const progress = Math.min(Math.abs(distanceX) / minSwipeDistance, 1);
    return progress * (distanceX > 0 ? -1 : 1);
  };

  const swipeProgress = getSwipeProgress();

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd || isAnimating) return;
    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    if (Math.abs(distanceX) > Math.abs(distanceY) && Math.abs(distanceX) > minSwipeDistance) {
      setIsAnimating(true);
      if (distanceX > 0) { // Swipe Left
        if (currentReviewIndex < availableDueNotes.length - 1) {
          setSlideDirection('left');
          setTimeout(() => { setCurrentReviewIndex(prev => prev + 1); setShowAnswer(false); setSlideDirection(null); setIsAnimating(false); }, 300);
        } else setIsAnimating(false);
      } else { // Swipe Right
        if (currentReviewIndex > 0) {
          setSlideDirection('right');
          setTimeout(() => { setCurrentReviewIndex(prev => prev - 1); setShowAnswer(false); setSlideDirection(null); setIsAnimating(false); }, 300);
        } else setIsAnimating(false);
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
        {swipeProgress !== 0 && (
          <div className="absolute top-4 left-0 right-0 flex justify-center z-10">
            <div className="bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
               <span>{swipeProgress > 0 ? '← 滑动返回' : '滑动继续 →'}</span>
            </div>
          </div>
        )}

        <div
          className={`bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col min-h-[400px] relative cursor-pointer transition-all duration-300 ease-out ${slideDirection === 'left' ? 'translate-x-full opacity-0 scale-95' : slideDirection === 'right' ? '-translate-x-full opacity-0 scale-95' : 'translate-x-0 opacity-100 scale-100'}`}
          style={{ transform: swipeProgress !== 0 ? `translateX(${swipeProgress * 20}px) scale(${1 - Math.abs(swipeProgress) * 0.05})` : undefined, opacity: swipeProgress !== 0 ? 1 - Math.abs(swipeProgress) * 0.3 : undefined }}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
          onClick={() => { if (!showAnswer && !isAnimating) setShowAnswer(true); }}
        >
          <div className="p-8 flex-1 flex flex-col items-center justify-center text-center">
            <div className="flex gap-2 mb-4">
              <span className="inline-block px-3 py-1 rounded-full bg-gray-100 text-xs text-gray-500">{categoryName}</span>
              <span className="inline-block px-3 py-1 rounded-full bg-indigo-50 text-xs text-indigo-600">{curve.name} {`第${note.stage}次复习`}</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">{note.title}</h2>
            {!showAnswer && (
              <div className="space-y-4"><p className="text-gray-400 text-sm animate-pulse">点击卡片显示答案</p></div>
            )}
            {showAnswer && (
              <div className="w-full mt-6 pt-6 border-t border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <p className="text-gray-600 text-left whitespace-pre-wrap">{note.content || "（无文字内容）"}</p>
                {note.images.length > 0 && (
                  <div className="mt-4 grid gap-2">
                    {note.images.map((img: string, i: number) => <img key={i} src={img} className="rounded-lg w-full object-cover cursor-pointer hover:opacity-80 transition" alt="note attachment" onClick={() => setPreviewImage(img)} />)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 pb-10">
        {!showAnswer ? (
          <button onClick={() => setShowAnswer(true)} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-indigo-700 transition">显示答案</button>
        ) : (
          <div className="flex gap-4">
            <button onClick={() => { handleReview(note, 'forgot'); setShowAnswer(false); }} className="flex-1 bg-red-100 text-red-600 py-4 rounded-2xl font-bold hover:bg-red-200 transition flex flex-col items-center"><span className="text-lg">忘记了</span><span className="text-xs font-normal opacity-70">重置进度</span></button>
            <button onClick={() => { handleReview(note, 'remembered'); setShowAnswer(false); }} className="flex-1 bg-green-100 text-green-600 py-4 rounded-2xl font-bold hover:bg-green-200 transition flex flex-col items-center"><span className="text-lg">记得</span><span className="text-xs font-normal opacity-70">下次复习时间: {nextInterval}天后</span></button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewSession;