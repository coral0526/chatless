"use client";

import { useState, useEffect } from "react";
import { APP_INFO, getVersionInfo } from "@/config/app-info";
import { Bot } from "lucide-react";

export function AboutSupportSettings() {
  const [versionInfo, setVersionInfo] = useState(getVersionInfo());

  useEffect(() => {
    const getTauriVersion = async () => {
      try {
        if (typeof window !== 'undefined' && (window as any).__TAURI__) {
          try {
            const { getVersion } = await import('@tauri-apps/api/app');
            const v = await getVersion();
            setVersionInfo(prev => ({ ...prev, version: v }));
          } catch { }
        }
      } catch { }
    };
    getTauriVersion();
  }, []);

  return (
    <div className="space-y-4">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">关于</h2>
        <div className="rounded-xl border border-slate-200/70 bg-gradient-to-br from-slate-50/50 to-blue-50/30 dark:from-slate-800/30 dark:to-blue-900/10 p-4 dark:border-slate-700/60 shadow-sm">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            在此查看应用的基本信息。
          </p>
        </div>
      </div>

      <div className="border border-slate-200/70 dark:border-slate-700/60 rounded-xl p-8 bg-white/70 dark:bg-slate-900/40 shadow-sm backdrop-blur-sm">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/20 flex items-center justify-center border border-blue-200/50 dark:border-blue-700/40 shadow-lg">
            <Bot className="w-8 h-8 text-blue-600 dark:text-blue-400" strokeWidth={1.5} />
          </div>

          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {APP_INFO.name}
          </h2>

          <p className="text-sm text-slate-500 dark:text-slate-400">
            v{versionInfo.version} · Build {versionInfo.build}
          </p>

          <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md">
            {APP_INFO.description}
          </p>
        </div>
      </div>
    </div>
  );
}
