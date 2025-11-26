import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogIn, UserPlus, Mail, Lock, AlertCircle, X } from 'lucide-react';

export default function AuthView({ isModal = false, onClose }: { isModal?: boolean; onClose?: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { signIn, signUp, isAuthenticated } = useAuth();

  // 注意: 登录成功后的自动跳转由 App.tsx 统一处理,这里不再自动关闭弹窗

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // 验证输入
    if (!email || !password) {
      setError('请输入邮箱和密码');
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (password.length < 6) {
      setError('密码长度至少为 6 位');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'signin') {
        const { error: signInError } = await signIn(email, password);
        if (signInError) {
          setError(signInError.message || '登录失败,请检查邮箱和密码');
        } else {
          setSuccessMessage('登录成功!');
        }
      } else {
        const { error: signUpError } = await signUp(email, password);
        if (signUpError) {
          setError(signUpError.message || '注册失败');
        } else {
          setSuccessMessage('注册成功! 请检查您的邮箱以验证账户。');
          setMode('signin');
          setPassword('');
          setConfirmPassword('');
        }
      }
    } catch (err) {
      setError('操作失败,请稍后重试');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen ${
      isModal 
        ? 'fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50' 
        : 'bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50'
    } flex items-center justify-center p-4`}>
      <div className="w-full max-w-md">
        {/* Logo 区域 */}
        {!isModal && (
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
              MemoCurve
            </h1>
            <p className="text-gray-600">基于艾宾浩斯记忆曲线的知识管理工具</p>
          </div>
        )}

        {/* 认证卡片 */}
        <div className="bg-white rounded-2xl shadow-xl p-8 relative">
          {/* 弹窗模式下显示关闭按钮 */}
          {isModal && onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          
          {/* 弹窗模式下显示提示信息 */}
          {isModal && (
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">AI 分析功能需要登录</h2>
              <p className="text-sm text-gray-600">请登录后使用 AI 分析功能</p>
            </div>
          )}
          
          {/* 切换按钮 */}
          <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-lg">
            <button
              onClick={() => {
                setMode('signin');
                setError(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-2.5 rounded-lg font-medium transition-all ${
                mode === 'signin'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <LogIn className="w-4 h-4 inline mr-2" />
              登录
            </button>
            <button
              onClick={() => {
                setMode('signup');
                setError(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-2.5 rounded-lg font-medium transition-all ${
                mode === 'signup'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <UserPlus className="w-4 h-4 inline mr-2" />
              注册
            </button>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* 成功提示 */}
          {successMessage && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700">{successMessage}</p>
            </div>
          )}

          {/* 表单 */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 邮箱输入 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                邮箱地址
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                  required
                />
              </div>
            </div>

            {/* 密码输入 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                密码
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 6 位密码"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                  required
                />
              </div>
            </div>

            {/* 确认密码(仅注册时显示) */}
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  确认密码
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="再次输入密码"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                    required
                  />
                </div>
              </div>
            )}

            {/* 提交按钮 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-lg hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  处理中...
                </span>
              ) : mode === 'signin' ? (
                '登录'
              ) : (
                '注册'
              )}
            </button>
          </form>

          {/* 提示信息 */}
          <div className="mt-6 text-center text-sm text-gray-600">
            {mode === 'signin' ? (
              <p>
                还没有账户?{' '}
                <button
                  onClick={() => {
                    setMode('signup');
                    setError(null);
                  }}
                  className="text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  立即注册
                </button>
              </p>
            ) : (
              <p>
                已有账户?{' '}
                <button
                  onClick={() => {
                    setMode('signin');
                    setError(null);
                  }}
                  className="text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  立即登录
                </button>
              </p>
            )}
          </div>
        </div>

        {/* 安全说明 */}
        {!isModal && (
          <div className="mt-6 text-center text-xs text-gray-500">
            <p>登录后您可以安全访问 AI 分析功能</p>
            <p className="mt-1">数据仅存储在您的本地浏览器中</p>
          </div>
        )}
      </div>
    </div>
  );
}
