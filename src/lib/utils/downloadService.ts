import { detectTauriEnvironment } from './environment';

/**
 * 统一下载服务
 * 提供跨平台的文件下载功能，优先使用浏览器下载，失败时回退到Tauri保存对话框
 */
export class DownloadService {
  private static instance: DownloadService;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): DownloadService {
    if (!DownloadService.instance) {
      DownloadService.instance = new DownloadService();
    }
    return DownloadService.instance;
  }

  /**
   * 下载文件
   * @param fileName 文件名
   * @param content 文件内容（字符串或Blob）
   * @param mimeType MIME类型（可选）
   * @returns 是否下载成功
   */
  async downloadFile(
    fileName: string,
    content: string | Blob,
    mimeType?: string
  ): Promise<boolean> {
    console.log('[DownloadService] 开始下载文件:', fileName);
    
    try {
      // 检测是否在Tauri环境中
      const isTauri = await this.isTauriEnvironment();
      console.log('[DownloadService] 环境检测:', { isTauri });
      
      if (isTauri) {
        // 在Tauri环境中，直接使用保存对话框
        console.log('[DownloadService] 检测到Tauri环境，直接使用保存对话框');
        return await this.tauriSaveDialog(fileName, content, mimeType);
      }
      
      // 在浏览器环境中，尝试浏览器下载
      console.log('[DownloadService] 检测到浏览器环境，尝试浏览器下载');
      const browserSuccess = await this.browserDownload(fileName, content, mimeType);
      if (browserSuccess) {
        console.log('[DownloadService] 浏览器下载成功');
        return true;
      }

      // 浏览器下载失败，尝试Tauri保存对话框
      console.log('[DownloadService] 浏览器下载失败，尝试使用Tauri保存对话框');
      return await this.tauriSaveDialog(fileName, content, mimeType);
    } catch (error) {
      console.error('[DownloadService] 下载文件失败:', error);
      return false;
    }
  }

  /**
   * 检测是否在Tauri环境中
   */
  private async isTauriEnvironment(): Promise<boolean> {
    return await detectTauriEnvironment();
  }

  /**
   * 浏览器下载方法
   */
  private async browserDownload(
    fileName: string,
    content: string | Blob,
    mimeType?: string
  ): Promise<boolean> {
    console.log('[DownloadService] 开始浏览器下载:', fileName);
    
    try {
      // 处理文件名，移除非法字符
      const safeFileName = this.sanitizeFileName(fileName);
      console.log('[DownloadService] 处理后的文件名:', safeFileName);
      
      // 创建Blob
      const blob = content instanceof Blob ? content : new Blob([content], {
        type: mimeType || 'text/plain;charset=utf-8'
      });
      console.log('[DownloadService] Blob创建成功，大小:', blob.size);

      // 创建下载链接
      const url = URL.createObjectURL(blob);
      console.log('[DownloadService] 创建临时URL:', url);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = safeFileName;
      link.style.display = 'none';

      // 添加到DOM并触发下载
      console.log('[DownloadService] 触发下载...');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // 清理URL
      setTimeout(() => {
        URL.revokeObjectURL(url);
        console.log('[DownloadService] 清理临时URL');
      }, 100);

      console.log('[DownloadService] 浏览器下载流程完成');
      return true;
    } catch (error) {
      console.warn('[DownloadService] 浏览器下载失败:', error);
      return false;
    }
  }

  /**
   * Tauri保存对话框方法
   */
  private async tauriSaveDialog(
    fileName: string,
    content: string | Blob,
    mimeType?: string
  ): Promise<boolean> {
    console.log('[DownloadService] 开始Tauri保存对话框:', fileName);
    
    try {
      // 动态导入Tauri API
      console.log('[DownloadService] 导入Tauri API...');
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeFile } = await import('@tauri-apps/plugin-fs');
      console.log('[DownloadService] Tauri API导入成功');

      // 处理文件名
      const safeFileName = this.sanitizeFileName(fileName);
      console.log('[DownloadService] 处理后的文件名:', safeFileName);

      // 打开保存对话框
      console.log('[DownloadService] 打开保存对话框...');
      const filePath = await save({
        filters: [{
          name: this.getFileExtension(safeFileName),
          extensions: [this.getFileExtension(safeFileName).replace('.', '')]
        }],
        defaultPath: safeFileName
      });

      if (!filePath) {
        console.log('[DownloadService] 用户取消了保存对话框');
        return false;
      }

      console.log('[DownloadService] 用户选择保存路径:', filePath);

      // 写入文件
      if (content instanceof Blob) {
        // 二进制文件
        console.log('[DownloadService] 写入二进制文件...');
        const arrayBuffer = await content.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        await writeFile(filePath, uint8Array);
      } else {
        // 文本文件
        console.log('[DownloadService] 写入文本文件...');
        const textEncoder = new TextEncoder();
        const uint8Array = textEncoder.encode(content);
        await writeFile(filePath, uint8Array);
      }

      console.log('[DownloadService] 文件已成功保存到:', filePath);
      return true;
    } catch (error) {
      console.error('[DownloadService] Tauri保存对话框失败:', error);
      return false;
    }
  }

  /**
   * 清理文件名，移除非法字符
   */
  private sanitizeFileName(fileName: string): string {
    // 移除或替换Windows和Unix系统中的非法字符
    return fileName
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_{2,}/g, '_')
      .trim();
  }

  /**
   * 获取文件扩展名
   */
  private getFileExtension(fileName: string): string {
    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex === -1) {
      return '.txt'; // 默认扩展名
    }
    return fileName.substring(lastDotIndex);
  }

  /**
   * 下载JSON文件
   */
  async downloadJson(fileName: string, data: any): Promise<boolean> {
    const jsonString = JSON.stringify(data, null, 2);
    const finalFileName = fileName.endsWith('.json') ? fileName : `${fileName}.json`;
    return this.downloadFile(finalFileName, jsonString, 'application/json');
  }

  /**
   * 下载文本文件
   */
  async downloadText(fileName: string, content: string): Promise<boolean> {
    const finalFileName = fileName.endsWith('.txt') ? fileName : `${fileName}.txt`;
    return this.downloadFile(finalFileName, content, 'text/plain;charset=utf-8');
  }

  /**
   * 下载Markdown文件
   */
  async downloadMarkdown(fileName: string, content: string): Promise<boolean> {
    const finalFileName = fileName.endsWith('.md') ? fileName : `${fileName}.md`;
    return this.downloadFile(finalFileName, content, 'text/markdown;charset=utf-8');
  }

  /**
   * 下载CSV文件
   */
  async downloadCsv(fileName: string, content: string): Promise<boolean> {
    const finalFileName = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
    return this.downloadFile(finalFileName, content, 'text/csv;charset=utf-8');
  }

  /**
   * 保存代码块到文件
   * 通过保存对话框下载，用配置目录作为默认路径
   */
  async saveCodeBlock(
    code: string,
    language: string,
    downloadDir?: string | null
  ): Promise<{ success: boolean; savedPath?: string }> {
    const ext = getLanguageExtension(language);
    const timestamp = Date.now();
    const fileName = `${language || 'code'}_${timestamp}${ext}`;

    const defaultPath = downloadDir
      ? `${downloadDir.replace(/\\/g, '/').replace(/\/$/, '')}/${fileName}`
      : fileName;

    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      const filePath = await save({
        filters: [{ name: ext, extensions: [ext.replace('.', '')] }],
        defaultPath,
      });
      if (!filePath) return { success: false };
      await writeTextFile(filePath, code);
      return { success: true, savedPath: filePath };
    } catch {
      return { success: false };
    }
  }
}

/** 语言到文件扩展名的映射 */
function getLanguageExtension(lang: string): string {
  const map: Record<string, string> = {
    javascript: '.js', js: '.js', jsx: '.jsx',
    typescript: '.ts', ts: '.ts', tsx: '.tsx',
    python: '.py', py: '.py',
    rust: '.rs', rs: '.rs',
    go: '.go', golang: '.go',
    java: '.java',
    c: '.c', cpp: '.cpp', 'c++': '.cpp', cxx: '.cpp',
    csharp: '.cs', cs: '.cs', 'c#': '.cs',
    html: '.html', htm: '.html',
    css: '.css', scss: '.scss', sass: '.sass', less: '.less',
    json: '.json', json5: '.json5',
    yaml: '.yml', yml: '.yml',
    toml: '.toml',
    xml: '.xml', svg: '.svg',
    markdown: '.md', md: '.md', mdx: '.mdx',
    sql: '.sql', pgsql: '.sql', mysql: '.sql',
    shell: '.sh', bash: '.sh', sh: '.sh', zsh: '.sh',
    powershell: '.ps1', ps1: '.ps1', pwsh: '.ps1',
    bat: '.bat', cmd: '.bat',
    dockerfile: '.dockerfile', docker: '.dockerfile',
    makefile: '.mk', make: '.mk',
    ruby: '.rb', rb: '.rb',
    php: '.php',
    swift: '.swift',
    kotlin: '.kt', kt: '.kt',
    scala: '.scala',
    dart: '.dart',
    lua: '.lua',
    perl: '.pl', pl: '.pl',
    r: '.r',
    elixir: '.ex', ex: '.ex', exs: '.exs',
    erlang: '.erl', erl: '.erl',
    haskell: '.hs', hs: '.hs',
    clojure: '.clj', clj: '.clj',
    groovy: '.groovy',
    graphql: '.graphql', gql: '.graphql',
    vue: '.vue', svelte: '.svelte',
    ini: '.ini', cfg: '.cfg', conf: '.conf',
    properties: '.properties', env: '.env',
    diff: '.diff', patch: '.patch',
    nginx: '.nginx',
    text: '.txt', txt: '.txt', plaintext: '.txt',
  };
  const key = (lang || '').toLowerCase();
  return map[key] || '.txt';
}

// 导出单例实例
export const downloadService = DownloadService.getInstance();