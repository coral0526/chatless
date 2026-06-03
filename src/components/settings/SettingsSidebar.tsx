"use client";

import { cn } from "@/lib/utils";
import {
  SlidersHorizontal,
  ShieldCheck,
  Settings,
  Database,
  Info,
  Plug,
  Globe,
  Cloud,
  Key
} from 'lucide-react';

const settingsTabs = [
  { id: 'general', name: '常规', icon: SlidersHorizontal },
  { id: 'apiKeys', name: 'API 密钥', icon: Key },
  { id: 'knowledgeBase', name: '知识库', icon: Database },
  { id: 'sync', name: '同步', icon: Cloud },
  { id: 'webSearch', name: '网络搜索', icon: Globe },
  { id: 'mcpServers', name: 'MCP 服务器', icon: Plug },
  { id: 'privacySecurity', name: '安全', icon: ShieldCheck },
  { id: 'advanced', name: '高级', icon: Settings },
  { id: 'aboutSupport', name: '关于', icon: Info },
];

interface SettingsSidebarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function SettingsSidebar({ activeTab, onTabChange }: SettingsSidebarProps) {
  return (
    <div className="w-48 border-r border-gray-200/60 dark:border-gray-800/50 overflow-y-auto custom-scrollbar bg-gradient-to-b from-white/95 to-gray-50/90 dark:from-gray-900/95 dark:to-gray-950/90 backdrop-blur-md flex flex-col h-full select-none shadow-sm">
      {/* Header */}
      <div className="px-3 py-3 flex items-center justify-between border-b border-gray-200/60 dark:border-gray-800/50 flex-shrink-0">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">设置</h3>
      </div>
      
      {/* Settings Tabs */}
      <div className="flex-1 p-2 space-y-1">
        {settingsTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-200 border",
                isActive
                  ? "bg-gradient-to-r from-blue-50 to-indigo-50/80 dark:from-blue-900/30 dark:to-indigo-900/25 text-blue-700 dark:text-blue-300 border-blue-300/60 dark:border-blue-600/50 shadow-md font-semibold"
                  : "text-gray-700 dark:text-gray-400 hover:bg-gradient-to-r hover:from-gray-100/80 hover:to-slate-100/60 dark:hover:from-gray-800/60 dark:hover:to-slate-800/50 hover:text-gray-900 dark:hover:text-gray-200 border-transparent hover:shadow-sm"
              )}
            >
              <Icon className={cn(
                "w-4 h-4 flex-shrink-0 transition-transform",
                isActive ? "text-blue-600 dark:text-blue-400 scale-110" : "text-gray-500 dark:text-gray-400"
              )} />
              <span className="truncate flex items-center gap-2 flex-1">
                {tab.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
} 
