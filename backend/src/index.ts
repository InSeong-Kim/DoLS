import "dotenv/config";
import "./types/express"; // Express.Request의 user 필드 전역 타입 확장을 로드합니다.
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth";
import { pubmedRouter } from "./routes/pubmed";
import { summaryRouter } from "./routes/summary";
import { subscriptionsRouter } from "./routes/subscriptions";
import { libraryRouter } from "./routes/library";
import { calendarRouter } from "./routes/calendar";
import { errorHandler } from "./middlewares/errorHandler";

const app = express();

const corsOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRouter);
app.use("/api", pubmedRouter); // POST /api/search
app.use("/api", summaryRouter); // POST /api/summarize, POST /api/summary/ask
app.use("/api/subscriptions", subscriptionsRouter);
app.use("/api/library", libraryRouter);
app.use("/api/calendar", calendarRouter);

app.use(errorHandler);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`[DoLS backend] listening on http://localhost:${port}`);
});
