import { RotateCw, Settings, Download, TrendingUp, Calendar } from 'lucide-react';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';
import { useApp } from '../context/AppContext';
import { useAnalytics } from '../hooks/useAnalytics';

const Dashboard = () => {
  const { notes, categories, setView, setActiveCategory, setCurrentReviewIndex, showToast, setShowAnalytics } = useApp();
  const { getTodayAddedNotes, getTodayCompletedReviews, getMemoryAccuracy, dueNotes, getCategoryDistribution, getTodayAddedCategoryDistribution, getDailyLearningTrend, getCategoryCompletionRates } = useAnalytics();

  const dueCount = dueNotes().length;
  const sortedCategories = [...categories].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

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
                <div style="font-size: 32px; font-weight: bold; color: #6366f1;">${todayAdded.length}</div>
                <div style="font-size: 14px; color: #4b5563;">今日新增笔记</div>
              </div>
              <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; text-align: center;">
                <div style="font-size: 32px; font-weight: bold; color: #10b981;">${todayCompleted.length}</div>
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
                <div style="background: white; border-radius: 8px; padding: 12px; border-left: 4px solid ${item.category.color}; display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <div style="font-weight: 600; color: #374151;">${item.category.name}</div>
                    <div style="font-size: 12px; color: #6b7280;">分类笔记</div>
                  </div>
                  <div style="font-size: 20px; font-weight: bold; color: ${item.category.color};">${item.count}</div>
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
                    <div style="font-weight: 600; color: #374151;">${item.category.name}</div>
                    <div style="font-size: 12px; color: #6b7280;">今日新增</div>
                  </div>
                  <div style="font-size: 20px; font-weight: bold; color: #10b981;">${item.count}</div>
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
                    <div style="font-weight: 600; color: #374151;">${item.category.name}</div>
                    <div style="font-size: 14px; color: #6b7280;">
                      ${item.rate === 100 ?
          `<span style="color: #10b981;">今日新添加</span>` :
          `${Math.round(item.rate)}% (${item.count}次复习)`
        }
                    </div>
                  </div>
                  ${item.rate < 100 ? `
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


  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="bg-indigo-600 p-6 rounded-b-3xl shadow-lg text-white">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold flex items-center gap-2"><RotateCw className="w-6 h-6" /> MemoCurve</h1>
          <button onClick={() => setView('settings')} className="p-2 hover:bg-indigo-500 rounded-full transition"><Settings className="w-5 h-5" /></button>
        </div>
        <div className="bg-indigo-700/50 p-4 rounded-2xl flex items-center justify-between backdrop-blur-sm">
          <div><p className="text-indigo-200 text-sm">今日待复习</p><p className="text-3xl font-bold">{dueCount}</p></div>
          <button
            onClick={() => {
              if (dueCount > 0) { setCurrentReviewIndex(0); setView('review'); }
              else { showToast('暂无待复习内容', 'error'); }
            }}
            className={`px-6 py-2 rounded-full font-semibold transition shadow-md ${dueCount > 0 ? 'bg-white text-indigo-600 hover:bg-indigo-50' : 'bg-indigo-800 text-indigo-400 cursor-not-allowed'}`}
          >开始复习</button>
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
              <div key={cat.id} onClick={() => { setActiveCategory(cat.id); setView('category'); }} className={`${cat.color} p-4 rounded-xl cursor-pointer hover:opacity-90 transition shadow-sm`}>
                <h3 className="font-bold truncate">{cat.name}</h3>
                <p className="text-xs mt-1 opacity-80">{count} 条笔记</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Overview */}
      <div className="px-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-bold text-gray-700">概览</h2>
          <div className="flex gap-2">
            <button onClick={exportDailyOverview} className="bg-green-600 text-white text-sm font-medium flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-green-700 transition-colors shadow-sm">
              <Download className="w-4 h-4" /> 导出详细报告
            </button>
            <button onClick={() => setShowAnalytics(true)} className="text-indigo-600 text-sm font-medium flex items-center gap-1">
              <TrendingUp className="w-4 h-4" /> 查看详情
            </button>
          </div>
        </div>
        <div id="daily-overview-content">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4">
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><Calendar className="w-4 h-4 text-indigo-500" /> 今日统计</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-indigo-50 p-3 rounded-lg text-center"><div className="text-2xl font-bold text-indigo-600">{getTodayAddedNotes().length}</div><div className="text-gray-600">新增笔记</div></div>
              <div className="bg-green-50 p-3 rounded-lg text-center"><div className="text-2xl font-bold text-green-600">{getTodayCompletedReviews().length}</div><div className="text-gray-600">完成复习</div></div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-700 mb-3">总体统计</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="text-center border-r border-gray-100"><div className="text-xl font-bold text-gray-800">{notes.length}</div><div className="text-gray-600">总笔记</div></div>
              <div className="text-center"><div className="text-xl font-bold text-gray-800">{notes.reduce((acc, n) => acc + n.stage, 0)}</div><div className="text-gray-600">累计记忆点</div></div>
              <div className="text-center border-r border-gray-100 pt-3"><div className="text-xl font-bold text-purple-600">{getMemoryAccuracy()}%</div><div className="text-gray-600">记忆准确率</div></div>
              <div className="text-center pt-3"><div className="text-xl font-bold text-orange-600">{dueCount}</div><div className="text-gray-600">今日待复习</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;