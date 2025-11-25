import React, { useState, useRef } from 'react';
import { ArrowLeft, Edit3, Trash2, GripVertical, TrendingUp, Plus, RotateCw, X } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { useApp } from '../context/AppContext';
import dbHelper, { STORE_CATS } from '../utils/database';
import { generateId, getRelativeTime, compressImage } from '../utils/helper_functions';
import type { Note, Category } from '../types';

const CategoryManager = () => {
  const { notes, categories, activeCategory, setActiveCategory, setView, setPreviewImage, handleUpdateNote, handleDeleteNote, setCategories, showToast, settings } = useApp();
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [newCatName, setNewCatName] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; category: Category | null }>({ show: false, category: null });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [notesPerPage, setNotesPerPage] = useState(5); // Dynamic page size
  const pageSizeOptions = [1, 2, 3, 4, 5, 10, 15, 20, 30, 50]; // Page size options

  // Reset to first page when category changes or page size changes
  React.useEffect(() => {
    if (activeCategory) {
      setCurrentPage(1);
    }
  }, [activeCategory, notesPerPage]);

  // NoteEditor Sub-component
  const NoteEditor = ({ note, onClose }: { note: Note, onClose: () => void }) => {
    const [title, setTitle] = useState(note.title);
    const [content, setContent] = useState(note.content);
    const [curveId, setCurveId] = useState(note.curveId);
    const [reschedule, setReschedule] = useState(false);
    const [images, setImages] = useState<string[]>(note.images);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isProcessingImg, setIsProcessingImg] = useState(false);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        setIsProcessingImg(true);
        try {
          const files = Array.from(e.target.files);
          for (const file of files) {
            const compressedBase64 = await compressImage(file);
            setImages(prev => [...prev, compressedBase64]);
          }
        } catch { showToast('图片处理失败', 'error'); } finally { setIsProcessingImg(false); }
      }
    };

    const save = async () => {
      const updatedNote: Note = { ...note, title, content, curveId, images };
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
          <div className="flex items-center gap-3"><button onClick={onClose}><ArrowLeft className="w-6 h-6 text-gray-600" /></button><h2 className="font-bold text-lg">编辑笔记</h2></div>
          <button onClick={save} className="text-indigo-600 font-bold">保存</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
          <div className="bg-indigo-50 p-4 rounded-xl">
            <label className="block text-sm text-indigo-800 mb-2 font-bold flex items-center gap-2"><TrendingUp className="w-4 h-4" /> 复习策略</label>
            <select value={curveId} onChange={e => setCurveId(e.target.value)} className="w-full p-2 bg-white rounded-lg border border-indigo-100 mb-2">{settings.curveProfiles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            {curveId !== note.curveId && (<div className="flex items-center gap-2 text-xs text-indigo-600 mt-2"><input type="checkbox" id="reschedule" checked={reschedule} onChange={e => setReschedule(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" /><label htmlFor="reschedule">立即重新安排复习</label></div>)}
          </div>
          <div><label className="block text-sm text-gray-500 mb-1">标题</label><input value={title} onChange={e => setTitle(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl font-bold" /></div>
          <div><label className="block text-sm text-gray-500 mb-1">内容</label><textarea value={content} onChange={e => setContent(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl h-40 resize-none" /></div>
          <div>
            <label className="block text-sm text-gray-500 mb-2">图片笔记</label>
            <div className="flex flex-wrap gap-2">
              {images.map((img, idx) => (
                <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border"><img src={img} className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition" alt="note" onClick={() => setPreviewImage(img)} /><button onClick={() => setImages(images.filter((_, i) => i !== idx))} className="absolute top-0 right-0 bg-black/50 text-white p-0.5"><X className="w-3 h-3" /></button></div>
              ))}
              <button onClick={() => fileInputRef.current?.click()} disabled={isProcessingImg} className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:text-indigo-500 hover:border-indigo-500 transition disabled:opacity-50">{isProcessingImg ? <RotateCw className="w-5 h-5 animate-spin" /> : <Plus className="w-6 h-6" />}</button>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (editingNote) return <NoteEditor note={editingNote} onClose={() => setEditingNote(null)} />;

  const addCat = async () => {
    if (!newCatName.trim()) return;
    if (categories.find(cat => cat.name.toLowerCase().trim() === newCatName.toLowerCase().trim())) { showToast('分类名称已存在', 'error'); return; }
    const colors = ['bg-red-100 text-red-800', 'bg-blue-100 text-blue-800', 'bg-green-100 text-green-800', 'bg-yellow-100 text-yellow-800', 'bg-purple-100 text-purple-800', 'bg-indigo-100 text-indigo-800'];
    const newCat = { id: generateId(), name: newCatName, color: selectedColor || colors[Math.floor(Math.random() * colors.length)], sortOrder: categories.length };
    await dbHelper.put(STORE_CATS, newCat);
    setCategories([...categories, newCat]);
    setNewCatName('');
    setSelectedColor('');
  };

  const deleteCat = async (id: string) => {
    const category = categories.find(c => c.id === id);
    if (!category) return;
    if (notes.some(n => n.categoryId === id)) { showToast('无法删除：该分类下还有笔记', 'error'); return; }
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

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination } = result;
    if (source.index === destination.index) return;
    const sortedList = [...categories].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const [removed] = sortedList.splice(source.index, 1);
    sortedList.splice(destination.index, 0, removed);
    const updatedList = sortedList.map((cat, index) => ({ ...cat, sortOrder: index }));
    Promise.all(updatedList.map(cat => dbHelper.put(STORE_CATS, cat))).then(() => { setCategories(updatedList); showToast('分类排序已更新'); });
  };

  const sortedCategories = [...categories].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  if (activeCategory) {
    const cat = categories.find(c => c.id === activeCategory);
    const catNotes = notes
      .filter(n => n.categoryId === activeCategory)
      .sort((a, b) => a.nextReviewDate - b.nextReviewDate);

    // Pagination logic
    const totalPages = Math.ceil(catNotes.length / notesPerPage);
    const startIndex = (currentPage - 1) * notesPerPage;
    const endIndex = startIndex + notesPerPage;
    const currentNotes = catNotes.slice(startIndex, endIndex);

    // Pagination component
    const Pagination = () => {
      if (totalPages <= 1) return null;

      return (
        <div className="flex justify-center items-center gap-2 mt-6">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
          >
            上一页
          </button>

          <div className="flex gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-2 text-sm rounded-lg transition ${
                  currentPage === page
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            ))}
          </div>

          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
          >
            下一页
          </button>
        </div>
      );
    };

    return (
      <div className="bg-gray-50 min-h-screen pb-20">
        <div className="p-4 bg-white shadow-sm flex items-center gap-3 sticky top-0 z-10">
          <button onClick={() => { setActiveCategory(null); setView('dashboard'); }}>
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <h2 className="font-bold text-lg">{cat?.name || '分类详情'}</h2>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">每页显示:</span>
              <select
                value={notesPerPage}
                onChange={(e) => setNotesPerPage(Number(e.target.value))}
                className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              >
                {pageSizeOptions.map(option => (
                  <option key={option} value={option}>{option} 条</option>
                ))}
              </select>
            </div>
            <div className="text-sm text-gray-500">
              {catNotes.length} 条笔记 · 第 {currentPage}/{totalPages} 页
            </div>
          </div>
        </div>
        <div className="p-4 space-y-3">
          {catNotes.length === 0 && <div className="text-center text-gray-400 mt-10">该分类下暂无笔记</div>}
          {currentNotes.map(n => (
            <div key={n.id} onClick={() => setEditingNote(n)} className="bg-white p-4 rounded-xl shadow-sm flex justify-between items-start cursor-pointer hover:bg-gray-50 transition active:scale-[0.98]">
              <div className="flex-1">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">{n.title}<Edit3 className="w-3 h-3 text-gray-300" /></h3>
                <p className="text-sm text-gray-500 mt-1 overflow-hidden line-clamp-2">{n.content || (n.images.length > 0 ? '图片笔记' : '')}</p>
                {n.images.length > 0 && (<div className="flex gap-1 mt-2 flex-shrink-0">{n.images.slice(0, 3).map((img, idx) => <div key={idx} className="w-8 h-8 rounded overflow-hidden border"><img src={img} className="w-full h-full object-cover" alt="thumbnail" /></div>)}</div>)}
                <div className="mt-2 flex items-center gap-2 text-xs"><span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded">{n.stage === 0 ? '今日新添加' : `第${n.stage}次复习`}</span><span className="text-gray-400">下次复习时间: {getRelativeTime(n.nextReviewDate)}</span></div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); handleDeleteNote(n.id); }} className="text-gray-300 hover:text-red-500 p-2"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          <Pagination />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen pb-20">
      <div className="p-4 bg-white shadow-sm flex items-center gap-3 mb-4"><button onClick={() => setView('dashboard')}><ArrowLeft className="w-6 h-6 text-gray-600" /></button><h2 className="font-bold text-lg">分类管理</h2></div>
      <div className="px-4">
        <div className="mb-6">
          <div className="flex gap-2 mb-3"><input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="新分类名称" className="flex-1 p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" /><button onClick={addCat} className="bg-indigo-600 text-white px-4 rounded-xl font-bold">添加</button></div>
          <div className="mb-3"><p className="text-sm text-gray-600 mb-2">选择颜色</p><div className="grid grid-cols-8 gap-2">{['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500'].map((color, index) => (<button key={index} onClick={() => setSelectedColor(color.replace('500', '100') + ' ' + color.replace('500', '800'))} className={`w-8 h-8 rounded-full ${color} ${selectedColor.includes(color.replace('500', '100')) ? 'ring-2 ring-gray-400 ring-offset-2' : ''}`} />))}</div></div>
        </div>
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="categories">
            {(provided, snapshot) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className={`space-y-3 ${snapshot.isDraggingOver ? 'bg-gray-50 rounded-xl p-2' : ''}`}>
                {sortedCategories.map((c, index) => (
                  <Draggable key={c.id} draggableId={c.id} index={index}>
                    {(provided, snapshot) => (
                      <div ref={provided.innerRef} {...provided.draggableProps} className={`bg-white p-4 rounded-xl shadow-sm flex justify-between items-center ${snapshot.isDragging ? 'shadow-lg scale-105' : ''}`}>
                        <div className="flex items-center gap-3 flex-1">
                          <div {...provided.dragHandleProps} className="cursor-grab text-gray-400"><GripVertical className="w-5 h-5" /></div>
                          <div className={`w-3 h-3 rounded-full ${c.color.split(' ')[0]}`}></div><span className="font-medium">{c.name}</span>
                        </div>
                        <button onClick={() => deleteCat(c.id)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-5 h-5" /></button>
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
      {deleteConfirm.show && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-2xl p-6"><h3 className="font-bold text-lg text-center mb-4">确认删除?</h3><div className="flex gap-3"><button onClick={() => setDeleteConfirm({ show: false, category: null })} className="flex-1 border rounded-lg py-2">取消</button><button onClick={confirmDelete} className="flex-1 bg-red-600 text-white rounded-lg py-2">删除</button></div></div></div>}
    </div>
  );
};

export default CategoryManager;