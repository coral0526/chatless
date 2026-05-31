import { BaseProvider, CheckResult, LlmMessage, StreamCallbacks } from './BaseProvider';
import { getStaticModels } from '../../provider/staticModels';
import { SSEClient } from '@/lib/sse-client';
import { ThinkingStrategyFactory, type ThinkingModeStrategy } from './thinking';
import { StreamEventAdapter } from '../adapters/StreamEventAdapter';
import type { StreamEvent } from '@/lib/llm/types/stream-events';
import { rewriteEventsWithToolCalls } from '../adapters/ToolChannelParser';

/**
 * OpenAI 兼容 Provider（宽松解析版）
 * - 专供各类 OpenAI 兼容聚合/代理服务
 * - 兼容两种事件负载："data: {json}" 与 直接 "{json}"，并识别 "[DONE]"
 * - ✅ 支持结构化事件输出（onEvent优先）
 */
export class OpenAICompatibleProvider extends BaseProvider {
  private sseClient: SSEClient;
  private aborted: boolean = false;
  private currentReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private thinkingStrategy: ThinkingModeStrategy;

  constructor(baseUrl: string, apiKey?: string, displayName: string = 'OpenAI-Compatible') {
    super(displayName, baseUrl, apiKey);
    this.sseClient = new SSEClient('OpenAICompatibleProvider');
    // 使用标准thinking策略（兼容<think>标签，新架构）
    this.thinkingStrategy = ThinkingStrategyFactory.createStandardStrategy();
  }

  async fetchModels(): Promise<Array<{ name: string; label?: string; aliases?: string[] }> | null> {
    // 通用兜底：按 OpenAI 兼容协议拉取 /models
    try {
      const apiKey = await this.getApiKey();
      const base = (this as any).baseUrl?.replace(/\/$/, '') || '';
      if (!base) throw new Error('no base url');
      const url = `${base}/models`;
      const { tauriFetch } = await import('@/lib/request');
      const resp: any = await tauriFetch(url, { method: 'GET', danger: { acceptInvalidCerts: true, acceptInvalidHostnames: true }, headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {}, fallbackToBrowserOnError: true, verboseDebug: true, debugTag: 'ModelList' });
      const items = Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : []);
      if (Array.isArray(items) && items.length) {
        return items.map((it: any) => {
          const id = it?.id || it?.name;
          const label = it?.label || it?.id || it?.name;
          return { name: String(id), label: String(label), aliases: [String(id)] };
        });
      }
    } catch (e) {
      // 静态兜底，避免界面空白
      console.warn('[OpenAICompatibleProvider] fetchModels fallback to static list', e);
    }
    const key = this.name || 'OpenAI-Compatible';
    const list = getStaticModels(key);
    return list?.map((m) => ({ name: m.id, label: m.label, aliases: [m.id] })) ?? null;
  }

  async checkConnection(): Promise<CheckResult> {
    // 与 OpenAI 类似，使用错误密钥做一次标准请求，判断是否可达
    const base = this.baseUrl.replace(/\/$/, '');
    const url = `${base}/chat/completions`;
    const fakeKey = 'invalid_test_key_for_healthcheck';
    const body = { model: 'gpt-3.5-turbo', messages: [{ role: 'user', content: 'ping' }], stream: false };
    try {
      const { tauriFetch } = await import('@/lib/request');
      const { judgeApiReachable } = await import('./healthcheck');
      const resp: any = await tauriFetch(url, {
        method: 'POST',
        rawResponse: true,
        browserHeaders: true,
        danger: { acceptInvalidCerts: true, acceptInvalidHostnames: true },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fakeKey}` },
        body,
        timeout: 5000,
        fallbackToBrowserOnError: true,
        debugTag: 'OpenAICompat-HealthCheck',
        verboseDebug: true,
        includeBodyInLogs: true
      });
      const status = (resp?.status ?? 0) as number;
      const text = (await resp.text?.()) || '';
      const judged = judgeApiReachable(status, text);
      if (!judged.ok) {
        console.log('[OpenAICompatibleProvider] judged unreachable', { status, text: (text||'').slice(0,200) });
      }
      if (judged.ok) return { ok: true, message: judged.message, meta: { status } };
      return { ok: false, reason: 'UNKNOWN', message: `HTTP ${status}`, meta: { status } };
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (/timeout|abort/i.test(msg)) return { ok: false, reason: 'TIMEOUT', message: '连接超时' };
      if (/network|fetch|ENOTFOUND|ECONN/i.test(msg)) return { ok: false, reason: 'NETWORK', message: '网络错误' };
      return { ok: false, reason: 'UNKNOWN', message: msg };
    }
  }

  async chatStream(
    model: string,
    messages: LlmMessage[],
    cb: StreamCallbacks,
    opts: Record<string, any> = {}
  ): Promise<void> {
    const apiKey = await this.getApiKey(model);
    const requiresKey: boolean = (typeof (this as any).requiresKey === 'boolean') ? !!(this as any).requiresKey : true;
    if (requiresKey && !apiKey) {
      const err = new Error('NO_KEY');
      (err as any).code = 'NO_KEY';
      (err as any).userMessage = '未配置 API 密钥，请前往设置为该 Provider 或模型配置密钥';
      cb.onError?.(err);
      return;
    }

    const url = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const { extensions: _extensions, mcpServers: _mcpServers, ...restOpts } = (opts as any) || {};
    const mapped: any = { ...restOpts };
    const o: any = opts as any;
    if (o.maxTokens !== undefined && mapped.max_tokens === undefined) mapped.max_tokens = o.maxTokens;
    if (o.maxOutputTokens !== undefined && mapped.max_tokens === undefined) mapped.max_tokens = o.maxOutputTokens;
    if (o.topP !== undefined && mapped.top_p === undefined) mapped.top_p = o.topP;
    if (o.topK !== undefined && mapped.top_k === undefined) mapped.top_k = o.topK;
    if (o.minP !== undefined && mapped.min_p === undefined) mapped.min_p = o.minP;
    if (o.frequencyPenalty !== undefined && mapped.frequency_penalty === undefined)
      mapped.frequency_penalty = o.frequencyPenalty;
    if (o.presencePenalty !== undefined && mapped.presence_penalty === undefined)
      mapped.presence_penalty = o.presencePenalty;
    if (o.stop !== undefined && mapped.stop === undefined) mapped.stop = o.stop;

    const body = {
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      ...mapped,
      stream: true,
    };

    this.aborted = false;
    this.thinkingStrategy.reset();

    // 走 Rust SSE 后端（支持流式输出 + 自签证书）
    await this.startSSEFallback(url, apiKey || null, body, cb);
  }

  /**
   * 统一的事件分发入口：
   * - 先通过 ToolChannelParser 剥离工具指令 → 生成 tool_call 事件
   * - 再将纯净的事件流交给上层回调（优先 onEvent，降级 onToken）
   */
  private dispatchEvents(rawEvents: StreamEvent[] | undefined, cb: StreamCallbacks, isDone: boolean = false) {
    if (!rawEvents || rawEvents.length === 0) return;
    const events = rewriteEventsWithToolCalls(rawEvents);
    if (!events.length) return;

    if (cb.onEvent) {
      for (const ev of events) cb.onEvent(ev);
    } else if (cb.onToken) {
      const text = StreamEventAdapter.eventsToText(events);
      if (text.length > 0) cb.onToken(text);
    }
  }

  private async startSSEFallback(
    url: string,
    apiKey: string | null,
    body: unknown,
    cb: StreamCallbacks
  ) {
    // 重置策略状态
    this.thinkingStrategy.reset();
    console.log('[OpenAICompat] SSE fallback starting, url:', url);

    try {
      console.log('[OpenAICompat] calling sseClient.startConnection...');
      await this.sseClient.startConnection(
        {
          url,
          method: 'POST',
          headers: {
            'Accept-Encoding': 'identity',
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body,
          debugTag: 'OpenAICompat',
        },
        {
          onStart: () => {
            console.log('[OpenAICompat] onStart callback');
            cb.onStart?.();
          },
          onError: (err) => {
            console.log('[OpenAICompat] onError callback:', err?.message || err);
            cb.onError?.(err);
          },
          onData: (rawData: string) => {
            console.log('[OpenAICompat] onData:', rawData?.substring?.(0, 200) ?? rawData);
            // —— 诊断：统计 ——
            // 注意：SSE 由后端拆"行"，这里统计的是每个 data 行
            const payload = rawData.startsWith('data:') ? rawData.substring(5).trim() : rawData.trim();
            if (!payload) return;
            if (payload === '[DONE]') {
              const result = this.thinkingStrategy.processToken({ done: true });
              this.dispatchEvents(result.events || [], cb, true);
              cb.onComplete?.();
              this.sseClient.stopConnection();
              return;
            }
            try {
              const json = JSON.parse(payload);
              const delta = json?.choices?.[0]?.delta ?? {};
              const reasoningPiece = typeof delta.reasoning_content === 'string' ? delta.reasoning_content : undefined;
              const contentPiece: string | undefined =
                (typeof delta.content === 'string' ? delta.content : undefined) ||
                (typeof json?.choices?.[0]?.message?.content === 'string' ? json.choices[0].message.content : undefined);
              
              // 构造完整的token内容（reasoning + content）
              let fullContent = '';
              if (reasoningPiece) {
                fullContent = `<think>${reasoningPiece}</think>`;
              }
              if (contentPiece) {
                fullContent += contentPiece;
              }
              
              if (fullContent) {
                const result = this.thinkingStrategy.processToken({
                  content: fullContent,
                  done: false
                });
                this.dispatchEvents(result.events || [], cb);
              }
            } catch (err) {
              console.warn('[OpenAICompatibleProvider] JSON parse error', err);
            }
          },
          onClose: () => {
            console.log('[OpenAICompat] SSE closed');
          }
        }
      );
      console.log('[OpenAICompat] sseClient.startConnection completed');
    } catch (error) {
      console.log('[OpenAICompat] SSE fallback exception:', error);
      cb.onError?.(error as any);
    }
  }

  async destroy(): Promise<void> {
    await this.sseClient.destroy();
  }

  cancelStream(): void {
    this.aborted = true;
    try { this.currentReader?.cancel(); } catch { /* noop */ }
    this.currentReader = null;
    this.sseClient.stopConnection();
  }
}


