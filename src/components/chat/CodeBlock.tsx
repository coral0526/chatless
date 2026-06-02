"use client";

import { useState, memo, useCallback, useRef } from 'react';
import { Copy, Check, Download, Loader2, FolderOpen, ExternalLink } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { downloadService } from '@/lib/utils/downloadService';
import StorageUtil from '@/lib/storage';

interface CodeBlockProps {
  language: string | null;
  code: string;
}

const CodeBlock = memo(({ language, code }: CodeBlockProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  const copyToClipboard = async () => {
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const handleDownload = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    try {
      const downloadDir = await StorageUtil.getItem<string>('download_directory');
      const result = await downloadService.saveCodeBlock(code, language || 'text', downloadDir);
      if (result.success && result.savedPath) {
        console.log('[CodeBlock] 文件已保存:', result.savedPath);
      }
    } catch {
      // 用户取消或失败
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }, [code, language]);

  const handleOpenAutoSaveDir = useCallback(async () => {
    const dir = await StorageUtil.getItem<string>("download_directory", "");
    if (dir) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('open_file_manager', { path: dir });
      } catch {
        const { toast } = await import('@/components/ui/sonner');
        toast.info(`自动保存目录: ${dir}`, { duration: 5000 });
      }
    } else {
      try {
        const { toast } = await import('@/components/ui/sonner');
        toast.info('尚未设置下载目录，请在设置中配置');
      } catch { /* ignore */ }
    }
  }, []);

  const detectedLanguage = language || 'bash';

  return (
    <div className="relative group my-4 rounded-md bg-[#282c34] text-slate-100 w-full max-w-full min-w-0 overflow-x-auto">
      {/* 查看自动保存目录 */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => { void handleOpenAutoSaveDir(); }}
        className={cn(
          "absolute top-2 right-[4.5rem] h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity",
          "text-amber-500 hover:bg-[#ECEBE8]"
        )}
        title="查看自动保存目录"
      >
        <FolderOpen className="w-3.5 h-3.5" />
      </Button>

      {/* 下载按钮 */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => { void handleDownload(); }}
        disabled={isSaving}
        className={cn(
          "absolute top-2 right-10 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity",
          "text-[#7D7C78] hover:bg-[#ECEBE8]"
        )}
        title="下载代码"
      >
        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      </Button>

      {/* 复制按钮 */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => { void copyToClipboard(); }}
        className={cn(
          "absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity",
          isCopied
            ? "text-emerald-500"
            : "text-[#7D7C78] hover:bg-[#ECEBE8]"
        )}
        title={isCopied ? "已复制" : "复制代码"}
      >
        {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      </Button>

      <div className="w-full max-w-full min-w-0">
        <SyntaxHighlighter
          language={detectedLanguage}
          style={oneDark}
          customStyle={{
            margin: 0,
            padding: '1rem',
            backgroundColor: '#282c34',
            borderRadius: '0.375rem',
            fontSize: '0.875rem',
            width: '100%',
            maxWidth: '100%',
          }}
          codeTagProps={{
            style: {
              fontFamily: '"Fira Code", "Courier New", monospace',
              whiteSpace: 'pre',
              display: 'block',
              minWidth: 0,
              maxWidth: '100%',
            },
          }}
          wrapLongLines={false}
          showLineNumbers={false}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
});

CodeBlock.displayName = 'CodeBlock';

export { CodeBlock }; 