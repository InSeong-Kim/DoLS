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

  console.error("[errorHandler]", err);
  const message = err instanceof Error ? err.message : "알 수 없는 서버 오류입니다.";
  return res.status(500).json({ error: message });
}
