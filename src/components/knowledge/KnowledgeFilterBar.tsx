"use client";

import { Database, Plus, Search } from "lucide-react";
import { IconButton } from '@/components/ui/icon-button';
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { SearchInput } from '@/components/ui/search-input';
import { Input } from "../ui/input";

const sortOptions = [
  { value: 'recent', label: '最近更新' },
  { value: 'name', label: '名称' },
  { value: 'docs', label: '文档数量' },
];

interface KnowledgeFilterBarProps {
  sortBy: string;
  onSortChange: (sortValue: string) => void;
  onCreateKnowledgeBase?: () => void;
}

export function KnowledgeFilterBar({
  sortBy,
  onSortChange,
  onCreateKnowledgeBase,
}: KnowledgeFilterBarProps) {
  return (
    <div className="flex justify-between items-center px-4 md:px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <div className="flex items-center gap-2">
        <Database className="w-4 h-4 text-blue-500 dark:text-blue-400" />
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">我的知识库</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden md:block max-w-xs">
        <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
              <Input
                type="text"
                placeholder="搜索知识库..."

                className="pl-10 pr-3 py-1.5 text-[13px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg w-full focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:ring-offset-0 transition-all duration-200"
              />
            </div>
        </div>

        <Select value={sortBy} onValueChange={onSortChange}>
          <SelectTrigger className="h-8 w-28 text-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800/70 hover:bg-gray-100 dark:hover:bg-gray-800 focus:ring-primary dark:text-gray-100">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((option)=>(
              <SelectItem key={option.value} value={option.value} className="text-xs">{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <IconButton icon={Plus} onClick={onCreateKnowledgeBase} title="新建知识库" />
      </div>
    </div>
  );
} 