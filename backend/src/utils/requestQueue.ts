// NCBI E-utilities로 나가는 요청 자체의 속도를 제한하는 큐.
// API key가 있으면 초당 10회, 없으면 초당 3회로 제한합니다.
// (프론트엔드 -> 백엔드 요청 제한이 아니라, 백엔드 -> NCBI 요청 제한입니다.)

type QueuedTask<T> = {
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

class RequestQueue {
  private queue: QueuedTask<any>[] = [];
  private timer: NodeJS.Timeout | null = null;
  private intervalMs: number;

  constructor(requestsPerSecond: number) {
    this.intervalMs = Math.ceil(1000 / requestsPerSecond);
  }

  setRate(requestsPerSecond: number) {
    this.intervalMs = Math.ceil(1000 / requestsPerSecond);
  }

  enqueue<T>(run: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ run, resolve, reject });
      this.ensureTimer();
    });
  }

  private ensureTimer() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      const task = this.queue.shift();
      if (!task) {
        if (this.timer) {
          clearInterval(this.timer);
          this.timer = null;
        }
        return;
      }
      task
        .run()
        .then(task.resolve)
        .catch(task.reject);
    }, this.intervalMs);
  }
}

const requestsPerSecond = process.env.NCBI_API_KEY ? 10 : 3;
export const ncbiRequestQueue = new RequestQueue(requestsPerSecond);
