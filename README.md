# DoLS

PubMed 기반 전공 문헌 자동 요약 및 트렌드 분석기. 키워드로 PubMed 문헌을 검색하고, AI가 연구 동향·핵심 기술·유전자·키워드·향후 방향을 요약해주며, 관심 있는 논문을 저장하고 PDF를 라이브러리에 보관할 수 있습니다.

## 폴더 구조

```
dols/
├── frontend/   # Next.js (App Router) + TypeScript + Tailwind CSS
└── backend/    # Express + TypeScript
```

- 인증: Supabase Auth (자체 JWT 서명 없음, `supabase.auth.getUser(token)`으로 서버가 매 요청 검증)
- DB/Storage: Supabase (Postgres + Storage)

## 1. 로컬 실행 방법

### 1-1. 사전 준비

- Node.js 18 이상
- Supabase 프로젝트 (아래 "2. Supabase 설정" 참고)
- OpenAI 또는 OpenAI SDK 호환 API 키 (아래 "3. LLM 키 설정" 참고)

### 1-2. 백엔드 실행

```bash
cd backend
cp .env.example .env   # 값 채우기
npm install
npm run dev            # nodemon + ts-node, http://localhost:4000
```

### 1-3. 프론트엔드 실행

```bash
cd frontend
cp .env.example .env.local   # 값 채우기
npm install
npm run dev                  # http://localhost:3000
```

브라우저에서 `http://localhost:3000/register`로 회원가입 후 `/search`에서 검색을 시작하세요.

## 2. Supabase 설정

1. [supabase.com](https://supabase.com)에서 새 프로젝트를 생성합니다. 프로젝트 이름은 `dols`로 만드는 것을 권장합니다.
2. **Authentication > Providers**에서 Email 로그인이 활성화되어 있는지 확인합니다(기본값으로 켜져 있습니다). 개발 중 이메일 인증 절차를 건너뛰고 싶다면 **Authentication > Settings**에서 "Confirm email"을 잠시 꺼둘 수 있습니다(운영 환경에서는 다시 켜는 것을 권장).
3. **SQL Editor**에서 [`backend/src/db/schema.sql`](backend/src/db/schema.sql) 파일 내용을 그대로 붙여넣고 실행합니다. 이 스크립트는 다음을 모두 생성합니다.
   - `profiles`, `search_results`, `summaries`, `uploaded_papers`, `saved_papers`, `library_shares`, `keyword_subscriptions` 테이블
   - 각 테이블의 Row Level Security(RLS) 정책
   - 비공개 Storage 버킷 `papers`와 그에 대한 정책
4. **Storage**에서 `papers` 버킷이 생성되었고 `Public` 토글이 꺼져 있는지(비공개) 확인합니다.
5. **Project Settings > API**에서 다음 값을 확인해 각각 `.env` / `.env.local`에 채웁니다.
   - `Project URL` → `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` 키 → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` 키 → `SUPABASE_SERVICE_ROLE_KEY` (백엔드에만, 절대 프론트엔드/클라이언트에 노출하지 마세요)

## 3. LLM(OpenAI 호환) 키 설정

`backend/.env`의 `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL` 세 값은 그대로 OpenAI SDK 클라이언트 생성에 쓰입니다. OpenAI 유료 크레딧이 없다면 아래 무료 대안을 그대로 꽂아 쓸 수 있습니다(둘 다 카드 등록 불필요).

| 제공사 | OPENAI_BASE_URL | OPENAI_MODEL 예시 | 키 발급 |
| --- | --- | --- | --- |
| OpenAI (기본) | (비워둠) | `gpt-4o-mini` | https://platform.openai.com |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai/` | `gemini-2.5-flash` | https://aistudio.google.com (Google AI Studio, 무료) |
| Groq | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` | https://console.groq.com (무료) |

일부 무료 모델은 `response_format: { type: "json_object" }`를 지원하지 않을 수 있습니다. `llmService.ts`는 이 경우를 대비해 재시도 후에도 JSON 파싱에 실패하면 원본 텍스트를 그대로 반환하는 fallback을 이미 포함하고 있습니다.

## 4. Vercel 배포 (프론트엔드)

1. GitHub에 저장소를 push한 뒤(아래 6번 참고) Vercel에서 "Import Project"로 이 저장소를 선택합니다.
2. **Root Directory**를 `frontend`로 지정합니다.
3. 환경 변수에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_BASE_URL`(배포한 백엔드 URL)을 등록합니다.
4. Deploy를 실행하면 Next.js 빌드가 자동으로 수행됩니다.
5. 배포 후 발급된 Vercel 도메인을 백엔드의 `CORS_ORIGINS`에 추가해야 프론트엔드에서 백엔드 API를 호출할 수 있습니다.

## 5. 백엔드 배포 (Render 등, 플랫폼 무관)

Render, Railway, Fly.io 등 Node.js를 지원하는 어떤 플랫폼이든 아래와 동일한 절차로 배포할 수 있습니다.

1. **Root Directory**를 `backend`로 지정합니다.
2. Build Command: `npm install && npm run build`
3. Start Command: `npm run start`
4. 환경 변수에 `backend/.env.example`의 모든 키(`OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`, `NCBI_API_KEY`, `ENTREZ_EMAIL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PORT`, `CORS_ORIGINS`)를 등록합니다. `CORS_ORIGINS`에는 실제 Vercel 프론트엔드 도메인을 콤마로 구분해 추가하세요.
5. **무료 티어 콜드 스타트 주의**: Render 등의 무료 플랜은 일정 시간 요청이 없으면 서버가 슬립 상태로 전환되고, 다음 요청 시 다시 깨어나는 데 수십 초가 걸릴 수 있습니다. 첫 검색 요청이 유난히 느리다면 이 때문일 가능성이 높습니다. 운영 환경에서 이 지연이 문제라면 유료 플랜이나 별도의 헬스체크 핑(ping) 설정을 고려하세요.

## 6. GitHub 원격 저장소 연결 및 push

이번 세션에서는 로컬 git 저장소 초기화와 첫 커밋까지만 진행했고, 원격 연결과 push는 진행하지 않았습니다. 아래 순서로 직접 진행하세요.

```bash
# GitHub에서 새 저장소(예: dols)를 먼저 생성한 뒤
git remote add origin https://github.com/<your-username>/dols.git
git branch -M main
git push -u origin main
```

## 7. 이번 세션 구현 범위

- 회원가입/로그인(Supabase Auth) → PubMed 검색 → AI 요약까지 전체 플로우
- 라이브러리에 저장 → 메모/태그/읽음 상태 관리, 필터링
- 키워드 구독("나만의 PubMed 레이더") → 접속 시 신규 논문 확인
- 저장 논문별 AI 질의응답(Q&A, 대화 기록은 세션 동안만 유지)
- 대시보드 홈(현황 요약 + 연구 관심사 등록) → 검색 결과 개인화 관련성 점수
- PDF 업로드/다운로드(signed URL)/삭제, 공유 링크 생성·해제 및 공개 조회 페이지(`/shared/[token]`)
- `backend/src/db/schema.sql` (RLS·인덱스·Storage 버킷 포함)

## 8. 이번 세션 제외 범위

- 실제 Vercel / Supabase / GitHub 계정 연결 및 배포 실행 (위 안내에 따라 직접 수행)
- 연도별 트렌드 시각화, TF-IDF, 임베딩, RAG 등 고급 분석 기능
- 아바타/소속 등 프로필 확장 (연구 관심사 한 줄 텍스트만 지원)
- 캘린더/스케줄러 기능(구독 키워드 자동 이메일 알림 등)은 이번 세션에서 구현하지 않았습니다. 현재 버전이 정상 동작하는 것을 확인한 뒤 별도의 세션에서 진행할 예정입니다.
