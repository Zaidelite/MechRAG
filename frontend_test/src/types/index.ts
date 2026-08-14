export type IngestionStatus = 'pending' | 'parsing' | 'embedding' | 'done' | 'failed';

export interface Citation {
  book_title: string;
  chapter: string;
  page_number: number;
  text_snippet: string;
  diagram_url?: string | null;
  similarity_score: number;
}

export interface QueryRequest {
  query: string;
  subject_filter?: string;
  book_filter?: string;
  model_name?: string;
}

export interface QueryResponse {
  query: string;
  answer: string;
  citations: Citation[];
}

export interface DocumentRecord {
  document_id: string;
  filename: string;
  filepath: string;
  sha256: string;
  book_title?: string;
  author?: string;
  total_pages?: number;
  status: IngestionStatus;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentStatusResponse {
  document_id: string;
  filename: string;
  status: IngestionStatus;
  total_pages?: number;
  error_message?: string;
  is_duplicate?: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  citations?: Citation[];
  timestamp: string;
  isError?: boolean;
}
