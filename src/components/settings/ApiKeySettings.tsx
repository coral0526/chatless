"use client";

import { useState } from "react";
import { Key, Eye, EyeOff, Pencil, Check, X } from "lucide-react";
import { useProviderStore } from "@/store/providerStore";
import { cn } from "@/lib/utils";

function maskToken(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}

export function ApiKeySettings() {
  const providers = useProviderStore((s) => s.providers);
  const updateConfig = useProviderStore((s) => s.updateConfig);
  const isLoading = useProviderStore((s) => s.isLoading);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showTokens, setShowTokens] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const toggleShow = (name: string) => {
    setShowTokens((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const startEdit = (name: string, currentKey: string | null | undefined) => {
    setEditingProvider(name);
    setEditValue(currentKey || "");
  };

  const cancelEdit = () => {
    setEditingProvider(null);
    setEditValue("");
  };

  const saveEdit = async (name: string) => {
    setSaving(true);
    try {
      await updateConfig(name, { apiKey: editValue.trim() || null });
      setEditingProvider(null);
      setEditValue("");
    } catch (e) {
      console.error("Failed to save token:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">API 密钥</h2>
        <div className="rounded-xl border border-slate-200/70 bg-gradient-to-br from-slate-50/50 to-blue-50/30 dark:from-slate-800/30 dark:to-blue-900/10 p-4 dark:border-slate-700/60 shadow-sm">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            管理各 AI 提供商的 API 密钥。密钥以加密方式存储，显示时脱敏处理。
          </p>
        </div>
      </div>

      <div className="border border-slate-200/70 dark:border-slate-700/60 rounded-xl p-6 space-y-6 bg-white/70 dark:bg-slate-900/40 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100/80 dark:border-slate-800/60">
          <Key className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">提供商密钥</h3>
        </div>

        <div className="space-y-3">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
              <span className="ml-2 text-sm text-slate-500">加载提供商配置...</span>
            </div>
          )}
          {!isLoading && providers.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-8">暂无提供商配置</p>
          )}
          {providers.map((provider) => {
            const isEditing = editingProvider === provider.name;
            const hasKey = provider.apiKey && provider.apiKey.trim().length > 0;
            const isShown = showTokens.has(provider.name);

            return (
              <div
                key={provider.name}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-lg border transition-colors",
                  "border-slate-200/60 dark:border-slate-700/50",
                  "bg-slate-50/50 dark:bg-slate-800/20"
                )}
              >
                {/* Provider info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-slate-900 dark:text-slate-100">
                      {provider.displayName || provider.name}
                    </span>
                    {provider.isUserAdded && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                        自定义
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {provider.url || "无 URL"}
                  </div>
                </div>

                {/* Token display / edit */}
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder={provider.requiresKey ? "输入 API Key..." : "可选"}
                        className={cn(
                          "w-56 px-3 py-1.5 text-sm rounded-md border",
                          "border-slate-300 dark:border-slate-600",
                          "bg-white dark:bg-slate-800",
                          "text-slate-900 dark:text-slate-100",
                          "focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                        )}
                        autoFocus
                      />
                      <button
                        onClick={() => saveEdit(provider.name)}
                        disabled={saving}
                        className="p-1.5 rounded-md text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                        title="保存"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="取消"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <code className="text-xs px-2 py-1 rounded bg-slate-200/50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 font-mono select-none">
                        {hasKey ? (isShown ? provider.apiKey : maskToken(provider.apiKey!)) : "未设置"}
                      </code>
                      {hasKey && (
                        <button
                          onClick={() => toggleShow(provider.name)}
                          className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                          title={isShown ? "隐藏" : "显示"}
                        >
                          {isShown ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      <button
                        onClick={() => startEdit(provider.name, provider.apiKey)}
                        className="p-1 rounded-md text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        title="编辑"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
