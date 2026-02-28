export class Semaphore {
  private readonly maxPermits: number;
  private availablePermits: number;
  private readonly waiters: Array<(release: () => void) => void> = [];

  /**
   * 创建一个简单信号量，用于限制并发数
   * @param {number} maxPermits - 允许的最大并发数（必须 >= 1）
   * @returns {void} 无返回值
   */
  constructor(maxPermits: number) {
    if (!Number.isFinite(maxPermits) || maxPermits < 1) {
      throw new Error('maxPermits must be a number >= 1');
    }
    this.maxPermits = maxPermits;
    this.availablePermits = maxPermits;
  }

  /**
   * 获取一个并发令牌；调用方需在完成后执行 release
   * @returns {Promise<() => void>} 释放函数；执行后归还令牌
   */
  public acquire(): Promise<() => void> {
    if (this.availablePermits > 0) {
      this.availablePermits -= 1;
      return Promise.resolve(() => this.release());
    }

    return new Promise((resolve) => {
      this.waiters.push(resolve);
    });
  }

  /**
   * 获取信号量的最大并发配置
   * @returns {number} 最大并发数
   */
  public getMaxPermits(): number {
    return this.maxPermits;
  }

  /**
   * 归还一个并发令牌
   * @returns {void} 无返回值
   */
  private release(): void {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter(() => this.release());
      return;
    }
    this.availablePermits = Math.min(this.availablePermits + 1, this.maxPermits);
  }
}

