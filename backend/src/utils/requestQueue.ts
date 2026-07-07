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

  static perMinute(requestsPerMinute: number): RequestQueue {
    return new RequestQueue(requestsPerMinute / 60);
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

// Gemini/Groq 무료 티어는 분당 요청 수 제한이 낮아서(예: 분당 15회 안팎), 검색 한 번에
// 요약/개별분석/용어설명이 겹쳐 나가면 금방 429에 걸립니다. LLM 호출도 NCBI처럼 큐를 통해
// 속도를 제한해 애초에 한도에 안 걸리도록 합니다. 필요하면 LLM_REQUESTS_PER_MINUTE로 조절하세요.
const llmRequestsPerMinute = Number(process.env.LLM_REQUESTS_PER_MINUTE ?? 10);
export const llmRequestQueue = RequestQueue.perMinute(llmRequestsPerMinute);
