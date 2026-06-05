import { invoke } from '@tauri-apps/api/core';
import { EmbeddingStrategy, EmbeddingError } from '../types';
import { modelConfigService } from '../ModelConfigService';

/**
 * Tauri ORT 策略
 * - 优先使用资源目录中捆绑的 ONNX 模型进行真实推理。
 * - 捆绑模型不可用时自动回退到模拟嵌入（crc32 哈希）。
 * - 使用ModelConfigService统一管理模型配置，避免硬编码。
 */
export class TauriOrtStrategy implements EmbeddingStrategy {
  private isInitialized = false;
  private modelId: string;
  private dimension: number = 384; // 默认维度，初始化时会更新

  constructor(modelName?: string) {
    this.modelId = modelName || 'all-minilm-l6-v2'; // 默认模型（修正后的正确ID）
    console.log(`[TauriOrtStrategy] 初始化，模型ID: ${this.modelId}`);
  }

  getName(): string {
    return 'TauriOrtStrategy';
  }

  getDimension(): number {
    return this.dimension;
  }

  async initialize(): Promise<void> {
    try {
      this.dimension = await modelConfigService.getModelDimensions(this.modelId);
      console.log(`[TauriOrtStrategy] 模型 ${this.modelId} 维度已确定: ${this.dimension}`);

      // 检查捆绑模型是否可用
      try {
        const bundled = await invoke('check_bundled_model_exists');
        if (bundled) {
          console.log('[TauriOrtStrategy] 捆绑模型可用，将使用真实 ONNX 推理');
        } else {
          console.warn('[TauriOrtStrategy] 捆绑模型未找到，将使用回退方案');
        }
      } catch {
        console.warn('[TauriOrtStrategy] 无法检查捆绑模型状态，将尝试使用');
      }

      this.isInitialized = true;
      console.log('[TauriOrtStrategy] 初始化完成');
    } catch (error) {
      console.error('[TauriOrtStrategy] 初始化失败:', error);
      this.isInitialized = true;
      console.warn(`[TauriOrtStrategy] 使用默认维度 ${this.dimension} 继续初始化`);
    }
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.isInitialized) {
      throw new EmbeddingError('TauriOrtStrategy not initialized');
    }

    if (texts.length === 0) {
      return [];
    }

    // 优先使用捆绑 ONNX 模型生成真实嵌入向量
    try {
      const embeddings: number[][] = await invoke('generate_bundled_embedding', { texts });
      return embeddings;
    } catch (error) {
      console.warn('[TauriOrtStrategy] 真实 ONNX 推理失败，回退到模拟嵌入:', error);

      // 回退：使用模拟嵌入向量（crc32 哈希）
      try {
        const embeddings: number[][] = await invoke('generate_embedding_command', { texts });
        return embeddings;
      } catch (fallbackError) {
        throw new EmbeddingError(
          `Tauri command failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`
        );
      }
    }
  }

  async cleanup(): Promise<void> {
    // Rust后端会话的生命周期由其自身管理，前端无需干预。
    this.isInitialized = false;
  }
} 