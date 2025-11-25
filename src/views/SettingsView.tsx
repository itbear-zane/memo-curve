import { useState, useEffect } from 'react';
import { ArrowLeft, Save, HardDrive, Download, Upload, TrendingUp, Edit3, Eye, Trash2, Clock, Brain } from 'lucide-react';
import { useApp } from '../context/AppContext';
import dbHelper, { STORE_NOTES, STORE_CATS, STORE_SETTINGS } from '../utils/database';
import { generateId } from '../utils/helper_functions';
import type { CurveProfile } from '../types';
import { CurveEditor, CurveVisualization } from '../components/CurveComponents';

const SettingsView = () => {
  const { settings, saveSettingsToDB, setView, showToast, handleExportData, handleImportData, requestNotificationPermission } = useApp();
  const [editedCurves, setEditedCurves] = useState<CurveProfile[]>(settings.curveProfiles);
  const [isDirty, setIsDirty] = useState(false);
  const [quota, setQuota] = useState<{ usage: number, quota: number } | null>(null);
  const [editingCurve, setEditingCurve] = useState<CurveProfile | null>(null);
  const [isNewCurve, setIsNewCurve] = useState(false);
  const [viewingCurve, setViewingCurve] = useState<CurveProfile | null>(null);
  const [aiConfig, setAiConfig] = useState(settings.aiConfig);

  useEffect(() => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      navigator.storage.estimate().then(({ usage, quota }) => {
        setQuota({ usage: usage || 0, quota: quota || 0 });
      });
    }
  }, []);


  const addCurve = () => {
    // 确保新曲线有唯一的ID，避免与默认曲线冲突
    let newId: string;
    do {
      newId = generateId();
    } while (editedCurves.some(curve => curve.id === newId));

    const newCurve: CurveProfile = {
      id: newId,
      name: '新曲线',
      intervals: [1, 2, 3, 5],
      isDefault: false
    };

    setEditingCurve(newCurve);
    setIsNewCurve(true);
  };

  const deleteCurve = (index: number) => {
    if (editedCurves.length <= 1) {
      showToast('至少保留一个复习曲线', 'error');
      return;
    }
    const newCurves = editedCurves.filter((_, i) => i !== index);
    setEditedCurves(newCurves);
    setIsDirty(true);
  };

  const saveSettings = async () => {
    try {
      await saveSettingsToDB({ ...settings, curveProfiles: editedCurves, aiConfig: aiConfig });
      setIsDirty(false);
      showToast('设置已保存');
    } catch (error) {
      console.error('保存设置失败:', error);
      showToast('保存失败', 'error');
    }
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-gray-50 min-h-screen pb-20">
      <div className="p-4 bg-white shadow-sm flex items-center justify-between mb-6 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('dashboard')}><ArrowLeft className="w-6 h-6 text-gray-600" /></button>
          <h2 className="font-bold text-lg">设置</h2>
        </div>
        {isDirty && (
          <button onClick={saveSettings} className="text-indigo-600 font-bold flex items-center gap-1 text-sm">
            <Save className="w-4 h-4" /> 保存
          </button>
        )}
      </div>

      <div className="px-4 space-y-6">
        {/* Storage Management */}
        <section className="bg-white p-4 rounded-xl shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-indigo-500" /> 存储空间 (IndexedDB)
          </h3>
          {quota ? (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>已用: {formatBytes(quota.usage)}</span>
                <span>总量: {formatBytes(quota.quota)}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${Math.min((quota.usage / quota.quota) * 100, 100)}%` }}></div>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                * 数据存储在本地浏览器中。为防止丢失，请定期导出备份。
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">正在计算存储空间...</p>
          )}

          <div className="grid grid-cols-2 gap-3 mt-4">
            <button onClick={handleExportData} className="flex items-center justify-center gap-2 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-semibold hover:bg-indigo-100">
              <Download className="w-4 h-4" /> 导出备份
            </button>
            <label className="flex items-center justify-center gap-2 py-2 bg-gray-50 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-100 cursor-pointer">
              <Upload className="w-4 h-4" /> 导入数据
              <input type="file" accept=".json" className="hidden" onChange={handleImportData} />
            </label>
          </div>
        </section>

        <section className="bg-white p-4 rounded-xl shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-500" /> 遗忘曲线管理
            </h3>
            <button onClick={addCurve} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded font-bold">+ 新建</button>
          </div>

          <div className="space-y-4">
            {editedCurves.map((curve, idx) => (
              <div key={curve.id} className="border-b pb-4 last:border-0 last:pb-0">
                <div className="flex justify-between items-center mb-2">
                  <div
                    className="font-bold text-sm cursor-pointer hover:text-indigo-600 flex items-center gap-1"
                    onClick={() => {
                      setEditingCurve(curve);
                      setIsNewCurve(false);
                    }}
                  >
                    {curve.name}
                    <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setViewingCurve(curve)}
                      className="text-gray-400 hover:text-indigo-500"
                      title="查看曲线可视化"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {!curve.isDefault && (
                      <button onClick={() => deleteCurve(idx)} className="text-gray-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-xs text-gray-500 mb-1">间隔 (天):</div>
                <div
                  className="w-full p-2 bg-gray-50 rounded-lg font-mono text-xs cursor-pointer hover:bg-gray-100 transition-colors max-h-16 overflow-y-auto"
                  onClick={() => {
                    setEditingCurve(curve);
                    setIsNewCurve(false);
                  }}
                  title="点击编辑间隔"
                >
                  {curve.intervals.length <= 10 ? curve.intervals.join(', ') :
                    `${curve.intervals.slice(0, 8).join(', ')}, ... 共${curve.intervals.length}个间隔`}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white p-4 rounded-xl shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-500" /> 通知设置
          </h3>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">复习提醒</span>
            <button
              onClick={requestNotificationPermission}
              className={`w-12 h-6 rounded-full transition-colors relative ${settings.enableNotifications ? 'bg-green-500' : 'bg-gray-300'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${settings.enableNotifications ? 'left-6.5' : 'left-0.5'}`}></div>
            </button>
          </div>
        </section>

        {/* AI 配置 */}
        <section className="bg-white p-4 rounded-xl shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-500" /> AI 分析配置
          </h3>

          <div className="space-y-4">
            {/* 启用开关 */}
            <div className="flex justify-between items-center">
              <div>
                <span className="text-gray-600 font-medium">启用 AI 分析</span>
                <p className="text-xs text-gray-400 mt-1">为笔记提供智能分析和学习建议</p>
              </div>
              <button
                onClick={() => {
                  const newAiConfig = { ...aiConfig, enabled: !aiConfig.enabled };
                  setAiConfig(newAiConfig);
                  setIsDirty(true);
                  // 立即保存设置
                  saveSettingsToDB({ ...settings, curveProfiles: editedCurves, aiConfig: newAiConfig });
                }}
                className={`w-12 h-6 rounded-full transition-colors relative ${aiConfig.enabled ? 'bg-indigo-500' : 'bg-gray-300'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${aiConfig.enabled ? 'left-6.5' : 'left-0.5'}`}></div>
              </button>
            </div>

            {aiConfig.enabled && (
              <div className="space-y-3 border-t pt-4">
                {/* 提供商选择 */}
                <div>
                  <label className="block text-sm text-gray-600 mb-2">AI 提供商</label>
                  <select
                    value={aiConfig.provider}
                    onChange={(e) => {
                      const provider = e.target.value as 'deepseek' | 'openai' | 'custom';
                      // 根据提供商自动设置默认配置
                      let newAiConfig = { ...aiConfig, provider };

                      if (provider === 'deepseek') {
                        newAiConfig = {
                          ...newAiConfig,
                          baseURL: 'https://api.deepseek.com',
                          model: 'deepseek-chat'
                        };
                      } else if (provider === 'openai') {
                        newAiConfig = {
                          ...newAiConfig,
                          baseURL: 'https://api.openai.com',
                          model: 'gpt-4o-mini'
                        };
                      } else if (provider === 'custom') {
                        newAiConfig = {
                          ...newAiConfig,
                          baseURL: '',
                          model: ''
                        };
                      }

                      setAiConfig(newAiConfig);
                      setIsDirty(true);
                      // 立即保存设置
                      saveSettingsToDB({ ...settings, curveProfiles: editedCurves, aiConfig: newAiConfig });
                    }}
                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  >
                    <option value="deepseek">DeepSeek</option>
                    <option value="openai">OpenAI</option>
                    <option value="custom">自定义</option>
                  </select>
                </div>

                {/* API 端点 */}
                <div>
                  <label className="block text-sm text-gray-600 mb-2">API URL</label>
                  <input
                    type="text"
                    value={aiConfig.baseURL}
                    onChange={(e) => {
                      const newAiConfig = { ...aiConfig, baseURL: e.target.value };
                      setAiConfig(newAiConfig);
                      setIsDirty(true);
                      // 立即保存设置
                      saveSettingsToDB({ ...settings, curveProfiles: editedCurves, aiConfig: newAiConfig });
                    }}
                    placeholder={aiConfig.provider === 'deepseek' ? 'https://api.deepseek.com' : aiConfig.provider === 'openai' ? 'https://api.openai.com' : '输入您的自定义 API 端点'}
                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>

                {/* API 密钥 */}
                <div>
                  <label className="block text-sm text-gray-600 mb-2">API 密钥</label>
                  <input
                    type="password"
                    value={aiConfig.apiKey}
                    onChange={(e) => {
                      const newAiConfig = { ...aiConfig, apiKey: e.target.value };
                      setAiConfig(newAiConfig);
                      setIsDirty(true);
                      // 立即保存设置
                      saveSettingsToDB({ ...settings, curveProfiles: editedCurves, aiConfig: newAiConfig });
                    }}
                    placeholder="输入您的 API 密钥"
                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {aiConfig.provider === 'deepseek' && '获取 DeepSeek API 密钥：https://platform.deepseek.com/'}
                    {aiConfig.provider === 'openai' && '获取 OpenAI API 密钥：https://platform.openai.com/'}
                    {aiConfig.provider === 'custom' && '输入您的自定义 API 端点密钥'}
                  </p>
                </div>

                {/* 模型选择 */}
                <div>
                  <label className="block text-sm text-gray-600 mb-2">模型</label>
                  <input
                    type="text"
                    value={aiConfig.model}
                    onChange={(e) => {
                      const newAiConfig = { ...aiConfig, model: e.target.value };
                      setAiConfig(newAiConfig);
                      setIsDirty(true);
                      // 立即保存设置
                      saveSettingsToDB({ ...settings, curveProfiles: editedCurves, aiConfig: newAiConfig });
                    }}
                    placeholder={aiConfig.provider === 'deepseek' ? 'deepseek-chat' : aiConfig.provider === 'openai' ? 'gpt-4o-mini' : '输入您的模型名称'}
                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {aiConfig.provider === 'deepseek' && '推荐：deepseek-chat, deepseek-reasoner'}
                    {aiConfig.provider === 'openai' && '推荐：gpt-4o, gpt-4o-mini'}
                    {aiConfig.provider === 'custom' && '输入您的模型名称'}
                  </p>
                </div>

                {/* 保存按钮 */}
                <button
                  onClick={saveSettings}
                  className="w-full py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors font-medium text-sm"
                >
                  保存
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="bg-white p-4 rounded-xl shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4 text-red-500 flex items-center gap-2">
            <Trash2 className="w-5 h-5" /> 危险区域
          </h3>
          <button
            onClick={async () => {
              if (confirm('这将清除所有数据且无法恢复！确定吗？')) {
                await dbHelper.clearStore(STORE_NOTES);
                await dbHelper.clearStore(STORE_CATS);
                // Clear settings but keep defaults maybe? or full nuke
                await dbHelper.clearStore(STORE_SETTINGS);
                window.location.reload();
              }
            }}
            className="w-full py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
          >
            清除所有数据
          </button>
        </section>
      </div>

      {/* Curve Editor Modal */}
      {editingCurve && (
        <CurveEditor
          curve={editingCurve}
          isNew={isNewCurve}
          onSave={(updatedCurve) => {
            let newCurves: CurveProfile[];

            if (isNewCurve) {
              // Add new curve
              newCurves = [...editedCurves, updatedCurve];
            } else {
              // Update existing curve
              const index = editedCurves.findIndex(c => c.id === updatedCurve.id);
              if (index !== -1) {
                newCurves = [...editedCurves];
                newCurves[index] = updatedCurve;
              } else {
                newCurves = editedCurves;
              }
            }

            // Update state and save to database immediately
            setEditedCurves(newCurves);
            saveSettingsToDB({ ...settings, curveProfiles: newCurves });
            setIsDirty(false);
            setEditingCurve(null);
            setIsNewCurve(false);
            showToast(isNewCurve ? '曲线已创建' : '曲线已更新');
          }}
          onCancel={() => {
            setEditingCurve(null);
            setIsNewCurve(false);
          }}
        />
      )}

      {/* Curve Visualization Modal */}
      {viewingCurve && (
        <CurveVisualization
          curve={viewingCurve}
          onClose={() => setViewingCurve(null)}
        />
      )}
    </div>
  );
};

export default SettingsView;