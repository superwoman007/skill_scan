import * as fs from 'fs/promises';
import * as path from 'path';

export interface CacheGetResult<T> {
  hit: boolean;
  value?: T;
}

/**
 * 轻量文件缓存：以 key.json 形式存储，避免重复调用大模型
 */
export class FileCache {
  private readonly dir: string;

  /**
   * 创建文件缓存
   * @param {string} dir - 缓存目录路径（相对或绝对）
   * @returns {void} 无返回值
   */
  constructor(dir: string) {
    this.dir = dir;
  }

  /**
   * 获取缓存值
   * @template T 缓存对象类型
   * @param {string} key - 缓存键（建议为 hash）
   * @returns {Promise<CacheGetResult<T>>} 命中结果与缓存值
   */
  public async get<T>(key: string): Promise<CacheGetResult<T>> {
    try {
      const filePath = this.getFilePath(key);
      const content = await fs.readFile(filePath, 'utf-8');
      return { hit: true, value: JSON.parse(content) as T };
    } catch {
      return { hit: false };
    }
  }

  /**
   * 写入缓存值
   * @template T 缓存对象类型
   * @param {string} key - 缓存键（建议为 hash）
   * @param {T} value - 缓存值
   * @returns {Promise<void>} 写入完成
   */
  public async set<T>(key: string, value: T): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    const filePath = this.getFilePath(key);
    await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8');
  }

  /**
   * 生成缓存文件路径
   * @param {string} key - 缓存键
   * @returns {string} 缓存文件绝对路径
   */
  private getFilePath(key: string): string {
    return path.isAbsolute(this.dir) ? path.join(this.dir, `${key}.json`) : path.join(process.cwd(), this.dir, `${key}.json`);
  }
}

