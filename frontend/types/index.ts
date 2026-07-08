export interface PubmedArticle {
  pmid: string;
  title: string;
  authors: string[];
  journal: string;
  pubYear: number | null;
  abstract: string;
  pubDate?: string | null;
}

export interface PaperRelevance {
  pmid: string;
  score: "high" | "medium" | "low";
  comment: string;
}

export interface SummaryResult {
  trend_summary: string;
  key_technologies: string[];
  frequent_genes: string[];
  keywords: string[];
  future_directions: string;
  paper_relevance?: PaperRelevance[];
  raw?: string;
}

export interface PaperAnalysisResult {
  key_technologies: string[];
  frequent_genes: string[];
  keywords: string[];
  future_directions: string;
  raw?: string;
}

export interface SavedPaper {
  id: string;
  user_id: string;
  pmid: string;
  title: string;
  authors: string[];
  journal: string | null;
  pub_year: number | null;
  abstract: string | null;
  saved_date: string;
  memo: string | null;
  tags: string[];
  is_read: boolean;
}

export interface UploadedPaper {
  id: string;
  user_id: string;
  filename: string;
  storage_path: string;
  upload_date: string;
  related_keyword: string | null;
  memo: string | null;
}

export interface KeywordSubscription {
  id: string;
  user_id: string;
  keyword: string;
  last_checked_date: string;
  created_date: string;
}

export interface SubscriptionCheckResult {
  subscription: KeywordSubscription;
  newArticles: PubmedArticle[];
}

export interface Profile {
  research_interest: string | null;
  updated_date: string | null;
}

export interface CalendarEvent {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_datetime: string;
  end_datetime: string | null;
  is_all_day: boolean;
  uploaded_paper_id: string | null;
  uploaded_papers?: { id: string; filename: string } | null;
  created_date: string;
}
