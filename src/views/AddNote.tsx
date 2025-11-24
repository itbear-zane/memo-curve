import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, TrendingUp, X, RotateCw, Plus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { compressImage } from '../utils/helper_functions';

const AddNote = () => {
  const { categories, settings, handleAddNote, setView, setPreviewImage, showToast } = useApp();
  
  const savedFormState = sessionStorage.getItem('addNoteFormState');
  const initialFormState = savedFormState ? JSON.parse(savedFormState) : {
    title: '', content: '', selectedCat: categories[0]?.id || '', selectedCurve: settings.curveProfiles[0]?.id || '', images: []
  };

  const [title, setTitle] = useState(initialFormState.title);
  const [content, setContent] = useState(initialFormState.content);
  const [selectedCat, setSelectedCat] = useState(initialFormState.selectedCat);
  const [selectedCurve, setSelectedCurve] = useState(initialFormState.selectedCurve);
  const [images, setImages] = useState<string[]>(initialFormState.images);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessingImg, setIsProcessingImg] = useState(false);

  useEffect(() => {
    const formState = { title, content, selectedCat, selectedCurve, images };
    sessionStorage.setItem('addNoteFormState', JSON.stringify(formState));
  }, [title, content, selectedCat, selectedCurve, images]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsProcessingImg(true);
      try {
        const files = Array.from(e.target.files);
        for (const file of files) {
          const compressedBase64 = await compressImage(file);
          setImages(prev => [...prev, compressedBase64]);
        }
      } catch { showToast('图片处理失败', 'error'); } 
      finally { setIsProcessingImg(false); }
    }
  };

  const submit = () => {
    if (!title.trim()) { showToast('请输入标题', 'error'); return; }
    handleAddNote({ title, content, categoryId: selectedCat, curveId: selectedCurve, images });
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
            <select value={selectedCat} onChange={e => setSelectedCat(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-indigo-500">
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> 复习策略</label>
            <select value={selectedCurve} onChange={e => setSelectedCurve(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-indigo-500">
              {settings.curveProfiles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-1">标题</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="核心概念 / 单词" className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-indigo-500 font-bold" />
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-1">内容详情</label>
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="详细解释、例句或备注..." className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-indigo-500 h-40 resize-none" />
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-2">图片笔记</label>
          <div className="flex flex-wrap gap-2">
            {images.map((img, idx) => (
              <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border">
                <img src={img} className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition" onClick={() => setPreviewImage(img)} alt={`图片 ${idx + 1}`} />
                <button onClick={() => setImages(images.filter((_, i) => i !== idx))} className="absolute top-0 right-0 bg-black/50 text-white p-0.5 hover:bg-black/70 transition"><X className="w-3 h-3" /></button>
              </div>
            ))}
            <button onClick={() => fileInputRef.current?.click()} disabled={isProcessingImg} className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:text-indigo-500 hover:border-indigo-500 transition disabled:opacity-50">
              {isProcessingImg ? <RotateCw className="w-5 h-5 animate-spin" /> : <Plus className="w-6 h-6" />}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
          </div>
        </div>
      </div>
      <div className="p-4 border-t">
        <button onClick={submit} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition">保存笔记</button>
      </div>
    </div>
  );
};

export default AddNote;