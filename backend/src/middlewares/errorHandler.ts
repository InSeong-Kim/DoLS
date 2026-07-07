import { Request, Response, NextFunction } from "express";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Express 에러 핸들러는 반드시 인자 4개(err, req, res, next)를 받아야
// Express가 이를 에러 핸들러로 인식합니다.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }

  // OpenAI SDK(및 호환 provider) 클라이언트 에러는 .status를 들고 있습니다.
  // 재시도까지 소진하고도 429(rate limit)나 503(일시 과부하)이 올라오면
  // 원인을 명확히 알려줍니다.
  const upstreamStatus = (err as { status?: number })?.status;
  if (upstreamStatus === 429 || upstreamStatus === 503) {
    return res.status(upstreamStatus).json({
      error: "AI 서비스 요청이 많아 일시적으로 제한되었습니다 (무료 티어 사용량 제한). 잠시 후 다시 시도해주세요.",
    });
  }

  console.error("[errorHandler]", err);
  const message = err instanceof Error ? err.message : "알 수 없는 서버 오류입니다.";
  return res.status(500).json({ error: message });
}
