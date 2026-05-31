"use client";

import { useEffect, useRef, useState } from 'react';
import { Streamdown } from 'streamdown';
import { useMarkdownFontSize } from '@/hooks/useMarkdownFontSize';
import { createMarkdownRenderers } from '@/lib/markdown/renderers';

interface StreamingMarkdownProps {
  content: string;
  isStreaming: boolean;
  className?: string;
}

const CHARS_PER_SECOND = 40;

/**
 * 流式 Markdown 渲染组件。
 * 用 requestAnimationFrame 按固定速率逐字释放，实现打字机效果。
 * 即使外部 isStreaming 已变为 false，动画仍会继续直到全部字符释放完毕。
 */
export function StreamingMarkdown({ content, isStreaming, className }: StreamingMarkdownProps) {
  const { size } = useMarkdownFontSize();
  const themeStyles = { headings: { h1: '', h2: '', h3: '', h4: '', h5: '', h6: '' }, paragraph: '', list: { ul: '', ol: '', li: '' }, blockquote: '', code: { inline: '', block: '' }, link: '', hr: '', table: { table: '', th: '', td: '' }, strong: '' };
  const { renderers, containerClass } = createMarkdownRenderers(size, themeStyles);

  const [displayLen, setDisplayLen] = useState(() => content.length);
  const targetRef = useRef(content.length);
  targetRef.current = content.length;
  const startTimeRef = useRef(0);
  const wasStreamingRef = useRef(false);

  // 历史消息（从未流式过）：直接显示全部
  useEffect(() => {
    if (!isStreaming && !wasStreamingRef.current) {
      setDisplayLen(content.length);
    }
  }, [isStreaming, content.length]);

  // 流式开始时记下起始时间并重置计数器
  useEffect(() => {
    if (isStreaming) {
      wasStreamingRef.current = true;
      if (content.length === 0) {
        setDisplayLen(0);
        startTimeRef.current = 0;
      }
    }
  }, [isStreaming, content.length]);

  // 动画循环：流式进行中或流式结束但未播完时持续运行
  useEffect(() => {
    const needsAnimation = isStreaming || (wasStreamingRef.current && displayLen < targetRef.current);
    if (!needsAnimation) return;
    if (!startTimeRef.current) startTimeRef.current = Date.now();

    let rafId: number;
    const tick = () => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const target = Math.min(Math.floor(elapsed * CHARS_PER_SECOND), targetRef.current);
      setDisplayLen(prev => Math.max(prev, target));
      if (target < targetRef.current) {
        rafId = requestAnimationFrame(tick);
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isStreaming, displayLen]);

  const animating = isStreaming || (wasStreamingRef.current && displayLen < content.length);
  const displayContent = animating ? content.slice(0, displayLen) : content;

  return (
    <div className={`${containerClass} ${className || ''}`}>
      <Streamdown isAnimating={animating} components={renderers}>
        {displayContent}
      </Streamdown>
    </div>
  );
}
