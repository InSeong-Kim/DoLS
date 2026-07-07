-- =====================================================================
-- DoLS — Supabase schema
-- Supabase 대시보드 > SQL Editor 에서 전체를 그대로 실행하세요.
-- 인증은 auth.users(Supabase Auth)를 그대로 사용하며, 별도 users 테이블은
-- 만들지 않습니다.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- profiles: 사용자당 1개. "연구 관심사" 한 줄만 저장하는 최소 프로필.
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  research_interest text,
  updated_date timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id);
create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- search_results: PubMed 검색 결과의 전역 캐시 (사용자 구분 없음)
-- ---------------------------------------------------------------------
create table if not exists public.search_results (
  id uuid primary key default gen_random_uuid(),
  keyword text not null,
  pmid text not null,
  title text not null,
  authors jsonb not null default '[]',
  journal text,
  pub_year integer,
  abstract text,
  search_date timestamptz not null default now()
);

create index if not exists idx_search_results_keyword on public.search_results (keyword);
create index if not exists idx_search_results_pmid on public.search_results (pmid);

alter table public.search_results enable row level security;

create policy "search_results_public_read" on public.search_results
  for select using (true);

-- 백엔드는 service role key로 접속하므로 RLS를 우회해 insert/update 합니다.
-- (일반 anon/authenticated 역할에는 insert/update/delete 정책을 부여하지 않습니다.)

-- ---------------------------------------------------------------------
-- summaries: 키워드 단위 AI 요약의 전역 캐시
-- ---------------------------------------------------------------------
create table if not exists public.summaries (
  id uuid primary key default gen_random_uuid(),
  keyword text not null,
  trend_summary text,
  key_technologies jsonb not null default '[]',
  frequent_genes jsonb not null default '[]',
  keywords jsonb not null default '[]',
  future_directions text,
  created_date timestamptz not null default now()
);

create index if not exists idx_summaries_keyword on public.summaries (keyword);

alter table public.summaries enable row level security;

create policy "summaries_public_read" on public.summaries
  for select using (true);

-- ---------------------------------------------------------------------
-- uploaded_papers: 사용자별 PDF 업로드 메타데이터
-- ---------------------------------------------------------------------
create table if not exists public.uploaded_papers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  storage_path text not null,
  upload_date timestamptz not null default now(),
  related_keyword text,
  memo text
);

create index if not exists idx_uploaded_papers_user on public.uploaded_papers (user_id);

alter table public.uploaded_papers enable row level security;

create policy "uploaded_papers_select_own" on public.uploaded_papers
  for select using (auth.uid() = user_id);
create policy "uploaded_papers_insert_own" on public.uploaded_papers
  for insert with check (auth.uid() = user_id);
create policy "uploaded_papers_update_own" on public.uploaded_papers
  for update using (auth.uid() = user_id);
create policy "uploaded_papers_delete_own" on public.uploaded_papers
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- saved_papers: 사용자별 "라이브러리에 저장"한 PubMed 논문 목록.
-- uploaded_papers 와는 별개이며, 공유(library_shares) 기능의 대상이 아님.
-- ---------------------------------------------------------------------
create table if not exists public.saved_papers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pmid text not null,
  title text not null,
  authors jsonb not null default '[]',
  journal text,
  pub_year integer,
  abstract text,
  saved_date timestamptz not null default now(),
  memo text,
  tags jsonb not null default '[]',
  is_read boolean not null default false,
  unique (user_id, pmid)
);

create index if not exists idx_saved_papers_user on public.saved_papers (user_id);

alter table public.saved_papers enable row level security;

create policy "saved_papers_select_own" on public.saved_papers
  for select using (auth.uid() = user_id);
create policy "saved_papers_insert_own" on public.saved_papers
  for insert with check (auth.uid() = user_id);
create policy "saved_papers_update_own" on public.saved_papers
  for update using (auth.uid() = user_id);
create policy "saved_papers_delete_own" on public.saved_papers
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- library_shares: 사용자별 PDF 공유 링크 상태.
-- uploaded_papers 에 대한 공개 접근 스위치 역할만 하며 saved_papers 와는 무관.
-- ---------------------------------------------------------------------
create table if not exists public.library_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  share_token text not null unique,
  is_enabled boolean not null default false,
  created_date timestamptz not null default now()
);

create index if not exists idx_library_shares_token on public.library_shares (share_token);

alter table public.library_shares enable row level security;

create policy "library_shares_select_own" on public.library_shares
  for select using (auth.uid() = user_id);
create policy "library_shares_insert_own" on public.library_shares
  for insert with check (auth.uid() = user_id);
create policy "library_shares_update_own" on public.library_shares
  for update using (auth.uid() = user_id);

-- 주의: GET /api/library/shared/:token 공개 조회는 프론트엔드에서 anon key로
-- 직접 조회하지 않고, 반드시 백엔드가 Service Role Key로 조회합니다.
-- 그래서 anon/authenticated 역할에 대한 공개 select 정책은 의도적으로 추가하지 않습니다.

-- ---------------------------------------------------------------------
-- keyword_subscriptions: 사용자별 구독 키워드 ("나만의 PubMed 레이더")
-- ---------------------------------------------------------------------
create table if not exists public.keyword_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  keyword text not null,
  last_checked_date timestamptz not null default now(),
  created_date timestamptz not null default now(),
  unique (user_id, keyword)
);

create index if not exists idx_keyword_subscriptions_user on public.keyword_subscriptions (user_id);

alter table public.keyword_subscriptions enable row level security;

create policy "keyword_subscriptions_select_own" on public.keyword_subscriptions
  for select using (auth.uid() = user_id);
create policy "keyword_subscriptions_insert_own" on public.keyword_subscriptions
  for insert with check (auth.uid() = user_id);
create policy "keyword_subscriptions_update_own" on public.keyword_subscriptions
  for update using (auth.uid() = user_id);
create policy "keyword_subscriptions_delete_own" on public.keyword_subscriptions
  for delete using (auth.uid() = user_id);

-- =====================================================================
-- Storage: "papers" 버킷 (비공개, PDF 저장용)
-- 객체 경로(object key) 규칙: {user_id}/{timestamp}_{filename}
-- (버킷 자체가 "papers" 이므로 경로에 "papers/"를 중복해서 넣지 않습니다.)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('papers', 'papers', false)
on conflict (id) do nothing;

create policy "papers_select_own" on storage.objects
  for select using (
    bucket_id = 'papers' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "papers_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'papers' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "papers_delete_own" on storage.objects
  for delete using (
    bucket_id = 'papers' and auth.uid()::text = (storage.foldername(name))[1]
  );

-- 백엔드는 Service Role Key로 Storage에 접근하므로 위 정책과 무관하게
-- 업로드/삭제/서명URL 발급이 가능합니다. 위 정책은 향후 프론트엔드에서
-- anon/authenticated 클라이언트로 직접 Storage에 접근할 경우를 위한 안전망입니다.
