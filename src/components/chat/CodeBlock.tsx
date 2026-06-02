"use client";

import { useState, memo, useCallback, useRef } from 'react';
import { Copy, Check, Download, Loader2, Folder, ExternalLink } from 'lucide-react';
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

  const handleSetDefaultDir = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const path = await open({ directory: true, multiple: false, title: '选择默认下载目录' });
      if (path && typeof path === 'string') {
        await StorageUtil.setItem('download_directory', path);
        await StorageUtil.setItem('auto_save_code_blocks', true);
        window.dispatchEvent(new CustomEvent('download-dir-changed', { detail: path }));
        return;
      }
    } catch {
      // dialog 不可用（Docker X11 等环境）
    }
  }, []);

  const detectedLanguage = language || 'bash';

  return (
    <div className="relative group my-4 rounded-md bg-[#282c34] text-slate-100 w-full max-w-full min-w-0 overflow-x-auto">
      {/* 设置默认下载目录 */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => { void handleSetDefaultDir(); }}
        className={cn(
          "absolute top-2 right-[4.5rem] h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity",
          "text-amber-500 hover:bg-[#ECEBE8]"
        )}
        title="设为默认下载目录并开启自动保存"
      >
        <Folder className="w-3.5 h-3.5" />
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