import { useState } from 'react';
import { X, PieChart as PieChartIcon, Calendar, TrendingUp as TrendingUpIcon, Target } from 'lucide-react';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAnalytics } from '../hooks/useAnalytics';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];

const AnalyticsModal = ({ onClose }: { onClose: () => void }) => {
  const [activeTab, setActiveTab] = useState<'category' | 'today' | 'trend' | 'completion'>('category');
  const { getCategoryDistribution, getTodayAddedCategoryDistribution, getDailyLearningTrend, getCategoryCompletionRates } = useAnalytics();

  const categoryData = getCategoryDistribution();
  const todayAddedData = getTodayAddedCategoryDistribution();
  const trendData = getDailyLearningTrend();
  const completionData = getCategoryCompletionRates();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-bold text-lg">学习数据分析</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          {[
            { id: 'category', icon: PieChartIcon, label: '分类分布' },
            { id: 'today', icon: Calendar, label: '今日新增' },
            { id: 'trend', icon: TrendingUpIcon, label: '学习趋势' },
            { id: 'completion', icon: Target, label: '完成率' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'category' | 'today' | 'trend' | 'completion')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition ${activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <tab.icon className="w-4 h-4 inline mr-1" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {activeTab === 'category' && (
            <div className="space-y-8">
              {categoryData.length > 0 ? (
                <div className="space-y-6">
                  <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                    <PieChartIcon className="w-5 h-5" /> 各分类笔记数量分布
                  </h4>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData.map(item => ({ name: item.category.name, value: item.count }))} cx="50%" cy="50%" labelLine={false}
                          label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                          outerRadius={100} fill="#8884d8" dataKey="value"
                        >
                          {categoryData.map((_, index: number) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {categoryData.map((item, index) => (
                      <div key={item.category.name} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                        <span className="font-medium">{item.category.name}</span>
                        <span className="ml-auto text-gray-600">{item.count} 条</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <div className="text-center py-12 text-gray-500">暂无分类数据</div>}
            </div>
          )}

          {activeTab === 'today' && (
            <div className="space-y-6">
              {todayAddedData.length > 0 ? (
                <>
                  <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-green-600" /> 今日新增笔记分类分布
                  </h4>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={todayAddedData.map(item => ({ name: item.category.name, value: item.count }))} cx="50%" cy="50%" labelLine={false}
                          label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                          outerRadius={100} fill="#10b981" dataKey="value"
                        >
                          {todayAddedData.map((_, index: number) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {todayAddedData.map((item, index: number) => (
                      <div key={item.category.name} className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                        <span className="font-medium">{item.category.name}</span>
                        <span className="ml-auto text-green-600 font-semibold">{item.count} 条</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p>今日暂无新增笔记</p>
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
                    <Line type="monotone" dataKey="added" stroke="#4f46e5" strokeWidth={2} name="新增笔记" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-7 gap-2 text-center">
                {trendData.map((day: { date: string; added: number; reviews: number; remembered: number; forgot: number }) => (
                  <div key={day.date} className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-xs text-gray-500">{day.date}</div>
                    <div className="text-lg font-bold text-indigo-600 mt-1">{day.added}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'completion' && (
            completionData.length > 0 ? (
              <div className="space-y-6">
                <h4 className="font-semibold text-gray-800">各分类今日复习完成率</h4>
                <div className="space-y-4">
                  {completionData.map((item) => (
                    <div key={item.category.name} className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">{item.category.name}</span>
                        <span className="text-sm text-gray-600">
                          {item.rate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-indigo-600 h-2 rounded-full transition-all duration-300" style={{ width: `${item.rate}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : <div className="text-center py-12 text-gray-500">暂无复习数据</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsModal;