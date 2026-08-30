import axios from 'axios';
import {
  QueryRequest,
  QueryResponse,
  DocumentStatusResponse,
  DocumentRecord,
  ChatHistoryItem
} from '../types';

const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return '/api/v1';
  }
  if (process.env.BACKEND_INTERNAL_URL) {
    return `${process.env.BACKEND_INTERNAL_URL}/api/v1`;
  }
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  return 'http://localhost:8000/api/v1';
};

const API_BASE_URL = getApiBaseUrl();

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const sendQuery = async (
  query: string,
  history?: ChatHistoryItem[],
  bookFilter?: string,
  modelName?: string
): Promise<QueryResponse> => {
  const payload: QueryRequest = {
    query,
    history: history && history.length > 0 ? history : undefined,
    book_filter: bookFilter || undefined,
    model_name: modelName || undefined,
  };
  const response = await apiClient.post<QueryResponse>('/query', payload);
  return response.data;
};

export const sendQueryStream = async (
  query: string,
  history: ChatHistoryItem[] | undefined,
  bookFilter: string | undefined,
  modelName: string | undefined,
  onChunk: (token: string) => void,
  onCitations: (citations: any[]) => void
): Promise<void> => {
  const payload: QueryRequest = {
    query,
    history: history && history.length > 0 ? history : undefined,
    book_filter: bookFilter || undefined,
    model_name: modelName || undefined,
  };

  const url = typeof window !== 'undefined' ? '/api/v1/query/stream' : `${API_BASE_URL}/query/stream`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(errorData.detail || 'Streaming query request failed');
  }

  if (!response.body) {
    throw new Error('ReadableStream not supported by response');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const block of lines) {
        const line = block.trim();
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') return;

        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.type === 'citations' && Array.isArray(parsed.citations)) {
            onCitations(parsed.citations);
          } else if (parsed.type === 'token' && typeof parsed.content === 'string') {
            onChunk(parsed.content);
          }
        } catch (_) {
          // ignore single chunk parse errors
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch (_) {}
  }
};

export const fetchAvailableModels = async (): Promise<{ models: Array<{ id: string; name: string; description?: string }> }> => {
  const response = await apiClient.get<{ models: Array<{ id: string; name: string; description?: string }> }>('/query/models');
  return response.data;
};

export const uploadDocument = async (
  file: File,
  subject: string = 'General',
  bookTitle?: string
): Promise<DocumentStatusResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('subject', subject);
  if (bookTitle) {
    formData.append('book_title', bookTitle);
  }

  const response = await apiClient.post<DocumentStatusResponse>('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const getIngestionStatus = async (documentId: string): Promise<DocumentStatusResponse> => {
  const response = await apiClient.get<DocumentStatusResponse>(`/status/${documentId}`);
  return response.data;
};

export const listDocuments = async (): Promise<{ total_documents: number; documents: DocumentRecord[] }> => {
  const response = await apiClient.get<{ total_documents: number; documents: DocumentRecord[] }>('/documents');
  return response.data;
};

export const deleteDocument = async (documentId: string): Promise<{ document_id: string; status: string }> => {
  const response = await apiClient.delete<{ document_id: string; status: string }>(`/documents/${documentId}`);
  return response.data;
};

export default apiClient;
