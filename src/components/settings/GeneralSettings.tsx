"use client";

import { useState, useEffect, useCallback } from "react";
import { SelectField } from "./SelectField";
import { SlidersHorizontal, FolderOpen, RotateCcw, Folder } from "lucide-react";
import StorageUtil from "@/lib/storage";
import { useMarkdownFontSize } from "@/hooks/useMarkdownFontSize";
import { useGlobalFontSize } from "@/hooks/useGlobalFontSize";
// Markdown主题系统已禁用
// import { useMarkdownTheme, MARKDOWN_THEMES } from "@/hooks/useMarkdownTheme";
import { PersonalizationSettings } from "./PersonalizationSettings";
import { useUiPreferences } from '@/store/uiPreferences';
import { ToggleSwitch } from './ToggleSwitch';
import { ThemeInitializer } from "@/lib/utils/themeInitializer";

// 主题设置键名
const THEME_KEY = "app_theme"; // system / light / dark
const LANG_KEY = "app_lang"; // zh / en

export function GeneralSettings() {
  const [theme, setTheme] = useState<string>("system");
  const [lang, setLang] = useState<string>("zh");
  const [initialized, setInitialized] = useState(false);
  const [downloadDir, setDownloadDir] = useState<string>("");
  const [autoSaveCodeBlocks, setAutoSaveCodeBlocks] = useState(false);
  const { size: chatFontSize, setSize: setChatFontSize } = useMarkdownFontSize();
  const { size: globalFontSize, setSize: setGlobalFontSize } = useGlobalFontSize();
  // Markdown主题系统已禁用
  // const { theme: markdownTheme, setTheme: setMarkdownTheme } = useMarkdownTheme();
  const ui = useUiPreferences();

  // 加载初始设置
  useEffect(() => {
    const loadSettings = async () => {
      const savedTheme = await StorageUtil.getItem<string>(THEME_KEY, "system");
      const savedLang = await StorageUtil.getItem<string>(LANG_KEY, "zh");
      const savedDir = await StorageUtil.getItem<string>("download_directory", "");
      const savedAuto = await StorageUtil.getItem<boolean>("auto_save_code_blocks", true);
      setTheme(savedTheme || "system");
      setLang(savedLang || "zh");
      setDownloadDir(savedDir || "");
      setAutoSaveCodeBlocks(savedAuto || false);
      setInitialized(true);
    };
    loadSettings();
  }, []);

  const [manualInput, setManualInput] = useState(false);
  const [manualPath, setManualPath] = useState("");

  const handlePickDirectory = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const path = await open({ directory: true, multiple: false, title: '选择下载保存目录' });
      if (path && typeof path === 'string') {
        setDownloadDir(path);
        StorageUtil.setItem("download_directory", path);
        window.dispatchEvent(new CustomEvent('download-dir-changed', { detail: path }));
        return;
      }
    } catch {
      // dialog 不可用（Docker X11 等环境），降级为手动输入
    }
    setManualInput(true);
    setManualPath(downloadDir || '/home/unnet/Desktop/ChatClient/AppData');
  }, [downloadDir]);

  const handleManualSave = useCallback(() => {
    const p = manualPath.trim();
    if (p) {
      setDownloadDir(p);
      StorageUtil.setItem("download_directory", p);
      window.dispatchEvent(new CustomEvent('download-dir-changed', { detail: p }));
    }
    setManualInput(false);
  }, [manualPath]);

  const handleResetDirectory = useCallback(() => {
    setDownloadDir("");
    StorageUtil.setItem("download_directory", "");
  }, []);

  // 应用主题 & 保存
  useEffect(() => {
    // 未加载完成不处理，避免默认值导致闪烁
    if (!initialized || typeof document === "undefined") return;
    
    // 使用主题初始化服务同步主题设置
    ThemeInitializer.syncThemeToStorage(theme);
    
    // 立即应用主题设置
    ThemeInitializer.applyTheme(theme);
  }, [theme, initialized]);

  // 保存语言
  useEffect(() => {
    if (typeof window === "undefined") return;
    StorageUtil.setItem(LANG_KEY, lang);
    //toast.info("语言已切换（仅演示，需刷新后生效）");
  }, [lang]);

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">常规设置</h2>
        <div className="rounded-xl border border-slate-200/70 bg-gradient-to-br from-slate-50/50 to-blue-50/30 dark:from-slate-800/30 dark:to-blue-900/10 p-4 dark:border-slate-700/60 shadow-sm">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            在此设置常规选项，包括界面语言、主题模式、字体大小等。
          </p>
        </div>
        </div>

             {/* 主要设置卡片 */}
       <div className="border border-slate-200/70 dark:border-slate-700/60 rounded-xl p-6 space-y-6 bg-white/70 dark:bg-slate-900/40 shadow-sm backdrop-blur-sm">
         {/* 头部 */}
         <div className="flex items-center gap-3 pb-4 border-b border-slate-100/80 dark:border-slate-800/60">
           {/* 主图标使用品牌色以提升层级 */}
           <SlidersHorizontal className="w-5 h-5 text-blue-600 dark:text-blue-400" />
           <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">常用选项</h3>
         </div>

                 {/* 设置内容 */}
         <div className="space-y-6">
                 <SelectField
           label="界面语言"
           options={[
             { value: "zh", label: "简体中文" },
             { value: "en", label: "English" },
           ]}
           value={lang}
           onChange={setLang}
         />

         <SelectField
           label="主题模式"
           options={[
             { value: "system", label: "跟随系统" },
             { value: "light", label: "亮色" },
             { value: "dark", label: "暗色" },
           ]}
           value={theme}
           onChange={setTheme}
         />

        {/* 聊天显示 */}
        <div className="pt-4 border-t border-slate-100/80 dark:border-slate-800/60">
          <div className=" text-xs font-medium text-slate-500 dark:text-slate-400 mb-3">聊天显示</div>

           <div className="space-y-6">
           <ToggleSwitch
           label="默认折叠聊天侧边栏"
           checked={ui.collapseChatSidebar}
           onChange={ui.setCollapseChatSidebar}
         />

          <SelectField
            label="聊天内容字体大小"
            options={[
              { value: "small", label: "小" },
              { value: "medium", label: "中" },
              { value: "large", label: "大" },
            ]}
            value={chatFontSize}
            onChange={(v) => setChatFontSize(v as any)}
          />

          {/* Markdown主题选择已移除 - 使用Streamdown原生渲染 */}

          <SelectField
            label="逐字淡入强度"
            options={[
              { value: 'off', label: '关闭' },
              { value: 'light', label: '轻' },
              { value: 'normal', label: '中（默认）' },
              { value: 'strong', label: '重' },
            ]}
            value={ui.charFadeIntensity as any}
            onChange={(v) => ui.setCharFadeIntensity(v as any)}
          />
           </div>
         
        </div>

        {/* 界面显示 */}
        <div className="pt-4 border-t border-slate-100/80 dark:border-slate-800/60">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3">界面显示</div>
          <SelectField
            label="界面文本大小"
            options={[
              { value: "small", label: "小" },
              { value: "medium", label: "中" },
              { value: "large", label: "大" },
            ]}
            value={globalFontSize}
            onChange={(v) => setGlobalFontSize(v as any)}
          />
        </div>

        {/* 下载设置 */}
        <div className="pt-4 border-t border-slate-100/80 dark:border-slate-800/60">
          <div className="flex items-center gap-2 mb-3">
            <Folder className="w-4 h-4 text-amber-500" />
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">下载设置</div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0 mr-3">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-300">下载保存目录</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  {downloadDir || "未设置（每次弹出保存对话框）"}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {downloadDir && (
                  <button
                    onClick={handleResetDirectory}
                    className="px-2.5 py-1.5 text-xs rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="重置目录"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => { void handlePickDirectory(); }}
                  className="px-3 py-1.5 text-xs rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors flex items-center gap-1.5"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  选择目录
                </button>
              </div>
            </div>
            {manualInput && (
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="text"
                  value={manualPath}
                  onChange={(e) => setManualPath(e.target.value)}
                  placeholder="输入下载目录的完整路径"
                  className="flex-1 px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleManualSave(); if (e.key === 'Escape') setManualInput(false); }}
                />
                <button
                  onClick={handleManualSave}
                  className="px-3 py-1.5 text-xs rounded-md bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                >
                  确定
                </button>
                <button
                  onClick={() => setManualInput(false)}
                  className="px-3 py-1.5 text-xs rounded-md text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                >
                  取消
                </button>
              </div>
            )}

            <ToggleSwitch
              label="自动保存 AI 生成的文件"
              checked={autoSaveCodeBlocks}
              onChange={(v) => {
                setAutoSaveCodeBlocks(v);
                StorageUtil.setItem("auto_save_code_blocks", v);
              }}
            />
          </div>
        </div>

                 {/* 应用行为设置 */}
         {(() => {
           const ui = useUiPreferences();
           return (
             <>
               <div className="pt-4 border-t border-gray-50 dark:border-gray-800">
                 <div className="space-y-6">
                   <ToggleSwitch
                     label="关闭时显示确认对话框"
                     checked={ui.showCloseConfirmation}
                     onChange={(v) => ui.setShowCloseConfirmation(v)}
                   />
                 </div>
               </div>
             </>
           );
         })()}

              </div>
      </div>

      {/* 个性化设置 */}
      <PersonalizationSettings />
    </div>
  );
} 