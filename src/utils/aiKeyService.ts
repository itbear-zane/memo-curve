import { fetchAIApiKeyByProvider } from './supabase';
import type { AppSettings } from '../types';

/**
 * 从 Supabase 加载所有 AI 提供商的密钥配置
 * 并合并到现有的 settings 中
 */
export async function loadAIKeysFromSupabase(
  currentSettings: AppSettings
): Promise<AppSettings> {
  try {
    console.log('正在从 Supabase 加载 AI 密钥配置...');

    // 获取各个提供商的密钥配置
    const [deepseekConfig, openaiConfig, openrouterConfig, dashscopeConfig] = await Promise.all([
      fetchAIApiKeyByProvider('deepseek'),
      fetchAIApiKeyByProvider('openai'),
      fetchAIApiKeyByProvider('openrouter'),
      fetchAIApiKeyByProvider('dashscope'),
    ]);

    // 创建新的 AI 配置对象,合并从 Supabase 获取的数据
    const updatedAiConfig = { ...currentSettings.aiConfig };

    // 确保所有提供商的配置对象都存在（兼容旧数据）
    if (!updatedAiConfig.deepseek) {
      updatedAiConfig.deepseek = {
        baseURL: 'https://api.deepseek.com',
        apiKey: '',
        model: 'deepseek-chat',
      };
    }
    if (!updatedAiConfig.openai) {
      updatedAiConfig.openai = {
        baseURL: 'https://api.openai.com',
        apiKey: '',
        model: 'gpt-4o-mini',
      };
    }
    if (!updatedAiConfig.openrouter) {
      updatedAiConfig.openrouter = {
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: '',
        model: 'qwen/qwen3-vl-235b-a22b-instruct',
        siteUrl: '',
        siteName: '',
      };
    }
    if (!updatedAiConfig.dashscope) {
      updatedAiConfig.dashscope = {
        baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        apiKey: '',
        model: 'qwen3-vl-plus',
      };
    }

    // 更新 DeepSeek 配置
    // 注意：只从 Supabase 同步 API Key 和 baseURL，保留用户在本地选择的 model
    if (deepseekConfig) {
      updatedAiConfig.deepseek = {
        baseURL: deepseekConfig.base_url || updatedAiConfig.deepseek.baseURL,
        apiKey: deepseekConfig.api_key || updatedAiConfig.deepseek.apiKey,
        model: updatedAiConfig.deepseek.model, // 保留本地配置的模型
      };
      console.log('✓ DeepSeek 密钥已加载');
    }

    // 更新 OpenAI 配置
    if (openaiConfig) {
      updatedAiConfig.openai = {
        baseURL: openaiConfig.base_url || updatedAiConfig.openai.baseURL,
        apiKey: openaiConfig.api_key || updatedAiConfig.openai.apiKey,
        model: updatedAiConfig.openai.model, // 保留本地配置的模型
      };
      console.log('✓ OpenAI 密钥已加载');
    }

    // 更新 OpenRouter 配置
    if (openrouterConfig) {
      updatedAiConfig.openrouter = {
        baseURL: openrouterConfig.base_url || updatedAiConfig.openrouter.baseURL,
        apiKey: openrouterConfig.api_key || updatedAiConfig.openrouter.apiKey,
        model: updatedAiConfig.openrouter.model, // 保留本地配置的模型
        siteUrl: openrouterConfig.site_url || updatedAiConfig.openrouter.siteUrl,
        siteName: openrouterConfig.site_name || updatedAiConfig.openrouter.siteName,
      };
      console.log('✓ OpenRouter 密钥已加载');
    }

    // 更新 DashScope 配置
    if (dashscopeConfig) {
      updatedAiConfig.dashscope = {
        baseURL: dashscopeConfig.base_url || updatedAiConfig.dashscope.baseURL,
        apiKey: dashscopeConfig.api_key || updatedAiConfig.dashscope.apiKey,
        model: updatedAiConfig.dashscope.model, // 保留本地配置的模型
      };
      console.log('✓ DashScope 密钥已加载');
    }

    console.log('AI 密钥配置加载完成');

    return {
      ...currentSettings,
      aiConfig: updatedAiConfig,
    };
  } catch (error) {
    console.error('从 Supabase 加载 AI 密钥时出错:', error);
    // 出错时返回原有配置
    return currentSettings;
  }
}

/**
 * 刷新单个提供商的密钥配置
 */
export async function refreshProviderKey(
  currentSettings: AppSettings,
  provider: 'deepseek' | 'openai' | 'openrouter' | 'dashscope'
): Promise<AppSettings> {
  try {
    console.log(`正在刷新 ${provider} 密钥配置...`);

    const config = await fetchAIApiKeyByProvider(provider);
    
    if (!config) {
      console.warn(`未找到 ${provider} 的密钥配置`);
      return currentSettings;
    }

    const updatedAiConfig = { ...currentSettings.aiConfig };

    // 确保所有提供商的配置对象都存在（兼容旧数据）
    if (!updatedAiConfig.deepseek) {
      updatedAiConfig.deepseek = {
        baseURL: 'https://api.deepseek.com',
        apiKey: '',
        model: 'deepseek-chat',
      };
    }
    if (!updatedAiConfig.openai) {
      updatedAiConfig.openai = {
        baseURL: 'https://api.openai.com',
        apiKey: '',
        model: 'gpt-4o-mini',
      };
    }
    if (!updatedAiConfig.openrouter) {
      updatedAiConfig.openrouter = {
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: '',
        model: 'qwen/qwen3-vl-235b-a22b-instruct',
        siteUrl: '',
        siteName: '',
      };
    }
    if (!updatedAiConfig.dashscope) {
      updatedAiConfig.dashscope = {
        baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        apiKey: '',
        model: 'qwen3-vl-plus',
      };
    }

    // 根据提供商更新对应配置
    // 注意：只从 Supabase 同步 API Key 和 baseURL，保留用户在本地选择的 model
    switch (provider) {
      case 'deepseek':
        updatedAiConfig.deepseek = {
          baseURL: config.base_url || updatedAiConfig.deepseek.baseURL,
          apiKey: config.api_key || updatedAiConfig.deepseek.apiKey,
          model: updatedAiConfig.deepseek.model, // 保留本地配置的模型
        };
        break;
      case 'openai':
        updatedAiConfig.openai = {
          baseURL: config.base_url || updatedAiConfig.openai.baseURL,
          apiKey: config.api_key || updatedAiConfig.openai.apiKey,
          model: updatedAiConfig.openai.model, // 保留本地配置的模型
        };
        break;
      case 'openrouter':
        updatedAiConfig.openrouter = {
          baseURL: config.base_url || updatedAiConfig.openrouter.baseURL,
          apiKey: config.api_key || updatedAiConfig.openrouter.apiKey,
          model: updatedAiConfig.openrouter.model, // 保留本地配置的模型
          siteUrl: config.site_url || updatedAiConfig.openrouter.siteUrl,
          siteName: config.site_name || updatedAiConfig.openrouter.siteName,
        };
        break;
      case 'dashscope':
        updatedAiConfig.dashscope = {
          baseURL: config.base_url || updatedAiConfig.dashscope.baseURL,
          apiKey: config.api_key || updatedAiConfig.dashscope.apiKey,
          model: updatedAiConfig.dashscope.model, // 保留本地配置的模型
        };
        break;
    }

    console.log(`✓ ${provider} 密钥已刷新`);

    return {
      ...currentSettings,
      aiConfig: updatedAiConfig,
    };
  } catch (error) {
    console.error(`刷新 ${provider} 密钥时出错:`, error);
    return currentSettings;
  }
}

/**
 * 检查密钥是否来自 Supabase(通过检查是否为空来判断是否需要从 Supabase 加载)
 */
export function isKeyFromSupabase(apiKey: string): boolean {
  // 如果密钥不为空且不是默认的空字符串,则认为已从 Supabase 加载
  return apiKey !== '' && apiKey.length > 0;
}
