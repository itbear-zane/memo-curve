import { useState } from 'react';
import { X, Eye } from 'lucide-react';
import type { CurveProfile } from '../types';

export const CurveVisualization = ({ curve, onClose }: { curve: CurveProfile; onClose: () => void; }) => {
  const [showDetails, setShowDetails] = useState(false);

  // Generate data points for the review curve visualization
  // This shows the actual review schedule (when reviews happen)
  const generateReviewCurveData = () => {
    const data = [];

    // Add initial point (day 0, first review)
    data.push({
      reviewNumber: 0,
      cumulativeDays: 0,
      interval: 0
    });

    // Generate points for each review interval
    for (let i = 0; i < curve.intervals.length; i++) {
      const cumulativeDays = curve.intervals[i];
      const interval = i === 0 ? cumulativeDays : cumulativeDays - curve.intervals[i - 1];

      data.push({
        reviewNumber: i + 1,
        cumulativeDays,
        interval
      });
    }

    return data;
  };

  const curveData = generateReviewCurveData();
  const maxCumulativeDays = Math.max(...curveData.map(d => d.cumulativeDays));
  const maxReviewNumber = curveData.length - 1;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-bold text-lg">{curve.name} - 复习曲线</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Chart Area */}
        <div className="flex-1 p-4 overflow-y-auto">
          {/* Chart Container */}
          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <div className="text-center text-sm text-gray-500 mb-2">
              复习时间点分布
            </div>

            {/* Chart */}
            <div className="relative h-48 bg-white rounded-lg border border-gray-200 p-2">
              {/* Y-axis labels (Review Numbers) */}
              <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col justify-between text-xs text-gray-400">
                <span>第{maxReviewNumber}次</span>
                <span>第{Math.floor(maxReviewNumber * 3 / 4)}次</span>
                <span>第{Math.floor(maxReviewNumber / 2)}次</span>
                <span>第{Math.floor(maxReviewNumber / 4)}次</span>
                <span>第0次</span>
              </div>

              {/* X-axis labels (Days) */}
              <div className="absolute left-8 right-0 bottom-0 h-6 flex justify-between text-xs text-gray-400 px-2">
                <span>0天</span>
                <span>{Math.floor(maxCumulativeDays / 4)}天</span>
                <span>{Math.floor(maxCumulativeDays / 2)}天</span>
                <span>{Math.floor(maxCumulativeDays * 3 / 4)}天</span>
                <span>{maxCumulativeDays}天</span>
              </div>

              {/* Chart content */}
              <div className="absolute left-8 right-2 top-2 bottom-6">
                {/* Grid lines */}
                <div className="absolute inset-0 grid grid-cols-4 grid-rows-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="border-r border-gray-100 last:border-r-0" />
                  ))}
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="border-b border-gray-100 last:border-b-0" />
                  ))}
                </div>

                {/* Review points */}
                <svg className="w-full h-full" viewBox={`0 0 100 100`} preserveAspectRatio="none">
                  {/* Vertical lines for each review point */}
                  {curveData.map((point, index) => (
                    <line
                      key={index}
                      x1={(point.cumulativeDays / maxCumulativeDays) * 100}
                      y1="0"
                      x2={(point.cumulativeDays / maxCumulativeDays) * 100}
                      y2="100"
                      stroke="#e5e7eb"
                      strokeWidth="1"
                      strokeDasharray="2,2"
                    />
                  ))}

                  {/* Review points */}
                  {curveData.map((point, index) => (
                    <circle
                      key={index}
                      cx={(point.cumulativeDays / maxCumulativeDays) * 100}
                      cy={100 - ((point.reviewNumber / maxReviewNumber) * 100)}
                      r="3"
                      fill="#4f46e5"
                      className="cursor-pointer hover:r-4 transition-all"
                    />
                  ))}

                  {/* Connecting lines between review points */}
                  <path
                    d={`M 0,100 ${curveData.map((point) =>
                      `L ${(point.cumulativeDays / maxCumulativeDays) * 100},${100 - ((point.reviewNumber / maxReviewNumber) * 100)}`
                    ).join(' ')}`}
                    fill="none"
                    stroke="#4f46e5"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            <div className="text-center text-xs text-gray-500 mt-2">
              从第一天开始的天数 (X轴) vs 复习次数 (Y轴)
            </div>
          </div>

          {/* Interval Details */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-sm text-gray-700">复习间隔详情</h4>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs text-indigo-600 flex items-center gap-1"
              >
                <Eye className="w-3 h-3" />
                {showDetails ? '隐藏详情' : '显示详情'}
              </button>
            </div>

            {showDetails && (
              <div className="bg-gray-50 rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
                {curveData.slice(1).map((point, index) => (
                  <div key={index} className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">
                      第{point.reviewNumber}次复习
                    </span>
                    <div className="flex gap-4">
                      <span className="text-gray-500">
                        第{point.cumulativeDays}天
                      </span>
                      <span className="text-indigo-600 font-medium">
                        间隔: {point.interval}天
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t">
          <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
            <div className="text-center">
              <div className="font-bold text-gray-800">{curve.intervals.length}</div>
              <div>复习次数</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-gray-800">{maxCumulativeDays}</div>
              <div>总周期</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const CurveEditor = ({ curve, isNew, onSave, onCancel }: { curve: CurveProfile; isNew: boolean; onSave: (curve: CurveProfile) => void; onCancel: () => void; }) => {
  const [name, setName] = useState(curve.name);
  const [intervals, setIntervals] = useState(curve.intervals.join(', '));
  const [errors, setErrors] = useState<string[]>([]);

  const validate = () => {
    const newErrors: string[] = [];

    if (!name.trim()) {
      newErrors.push('曲线名称不能为空');
    }

    const parsedIntervals = intervals
      .split(',')
      .map(n => parseFloat(n.trim()))
      .filter(n => !isNaN(n) && n > 0);

    if (parsedIntervals.length === 0) {
      newErrors.push('请输入有效的间隔天数');
    }

    if (parsedIntervals.some(n => n <= 0)) {
      newErrors.push('间隔天数必须大于0');
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;

    const parsedIntervals = intervals
      .split(',')
      .map(n => parseFloat(n.trim()))
      .filter(n => !isNaN(n) && n > 0);

    const updatedCurve: CurveProfile = {
      ...curve,
      name: name.trim(),
      intervals: parsedIntervals
    };

    onSave(updatedCurve);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-lg">
            {isNew ? '新建遗忘曲线' : '编辑遗忘曲线'}
          </h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            {errors.map((error, idx) => (
              <div key={idx} className="text-red-600 text-sm flex items-center gap-1">
                • {error}
              </div>
            ))}
          </div>
        )}

        <div>
          <label className="block text-sm text-gray-500 mb-1">曲线名称</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="例如：英语单词专项"
            className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-500 mb-1">
            复习间隔 (天)
            <span className="text-xs text-gray-400 ml-1">用逗号分隔</span>
          </label>
          <textarea
            value={intervals}
            onChange={e => setIntervals(e.target.value)}
            placeholder="例如：1, 2, 3, 5, 8, 13, 21, 34"
            className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none font-mono text-sm"
          />
          <p className="text-xs text-gray-400 mt-1">
            输入复习间隔天数，用逗号分隔。例如：第1天、第2天、第3天、第5天...
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 py-3 border border-gray-300 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
};