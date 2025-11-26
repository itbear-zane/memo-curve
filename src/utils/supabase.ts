import { createClient } from '@supabase/supabase-js';

// Supabase 配置
// 注意: 这些是公开的匿名密钥,可以安全地暴露在前端代码中
const SUPABASE_URL = 'https://vgudakghzlptkieqozzj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZndWRha2doemxwdGtpZXFvenpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMjU4MjMsImV4cCI6MjA3OTcwMTgyM30.2iyfiTiOYZf0Q_-sbppl0vSHYq-spZ7FD-dXCd4l1oQ';

// 创建 Supabase 客户端
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false, // 本应用不需要用户认证
    autoRefreshToken: false,
  },
});

// AI API 密钥配置接口
export interface AIApiKeyConfig {
  id?: string;
  provider: 'deepseek' | 'openai' | 'openrouter';
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
 */
export async function fetchAIApiKeys(): Promise<AIApiKeyConfig[]> {
  try {
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
 */
export async function fetchAIApiKeyByProvider(
  provider: 'deepseek' | 'openai' | 'openrouter'
): Promise<AIApiKeyConfig | null> {
  try {
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
