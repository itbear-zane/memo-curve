import { createClient } from '@supabase/supabase-js';

// Supabase 配置 - 从环境变量读取
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Supabase 配置缺失: 请检查环境变量 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY');
}

// 创建 Supabase 客户端,启用认证功能
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true, // 启用会话持久化
    autoRefreshToken: true, // 启用自动刷新令牌
    detectSessionInUrl: true, // 检测 URL 中的会话信息(用于邮箱确认等)
    storage: localStorage, // 使用 localStorage 存储会话
  },
});

// AI API 密钥配置接口
export interface AIApiKeyConfig {
  id?: string;
  provider: 'deepseek' | 'openai' | 'openrouter' | 'dashscope';
  api_key: string;
  base_url: string;
  model: string;
  site_url?: string;
  site_name?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * 从 Supabase 获取所有激活的 AI API 密钥配置
 * 需要用户认证才能访问
 */
export async function fetchAIApiKeys(): Promise<AIApiKeyConfig[]> {
  try {
    // 检查用户是否已认证
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.warn('用户未登录,无法获取 AI API 密钥');
      return [];
    }

    const { data, error } = await supabase
      .from('ai_api_keys')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('获取 AI API 密钥失败:', error);
      throw error;
    }

    return data || [];
  } catch (err) {
    console.error('从 Supabase 获取密钥时出错:', err);
    return [];
  }
}

/**
 * 根据提供商获取对应的 API 密钥配置
 * 需要用户认证才能访问
 */
export async function fetchAIApiKeyByProvider(
  provider: 'deepseek' | 'openai' | 'openrouter' | 'dashscope'
): Promise<AIApiKeyConfig | null> {
  try {
    // 检查用户是否已认证
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.warn('用户未登录,无法获取 AI API 密钥');
      return null;
    }

    const { data, error } = await supabase
      .from('ai_api_keys')
      .select('*')
      .eq('provider', provider)
      .eq('is_active', true)
      .single();

    if (error) {
      // 如果没有找到记录,返回 null 而不是抛出错误
      if (error.code === 'PGRST116') {
        console.warn(`未找到 ${provider} 的 API 密钥配置`);
        return null;
      }
      console.error(`获取 ${provider} API 密钥失败:`, error);
      throw error;
    }

    return data;
  } catch (err) {
    console.error(`从 Supabase 获取 ${provider} 密钥时出错:`, err);
    return null;
  }
}
