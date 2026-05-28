import type { ThemeStyles } from '@/lib/markdown/themes';
import { CodeBlock } from '@/components/chat/CodeBlock';

/**
 * Markdown渲染器
 *
 * 自定义 code 渲染器：block code 使用 CodeBlock 组件（带下载/复制按钮），
 * inline code 使用原生渲染。
 */
export function createMarkdownRenderers(
  _size: 'small' | 'medium' | 'large',
  _themeStyles: ThemeStyles
): { renderers: Partial<Record<string, any>>; containerClass: string } {

  const containerClass = '';

  const renderers: Record<string, any> = {
    code: ({ className, children, ...props }: any) => {
      // inline code: no className
      if (!className) {
        return <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>{children}</code>;
      }

      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : null;
      const codeText = String(children).replace(/\n$/, '');

      return <CodeBlock language={language} code={codeText} />;
    },
  };

  return { renderers, containerClass };
}


