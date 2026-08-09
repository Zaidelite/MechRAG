import axios from 'axios';
import {
  QueryRequest,
  QueryResponse,
  DocumentStatusResponse,
  DocumentRecord
} from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const sendQuery = async (query: string, bookFilter?: string): Promise<QueryResponse> => {
  const payload: QueryRequest = {
    query,
    book_filter: bookFilter || undefined,
  };
  const response = await apiClient.post<QueryResponse>('/query', payload);
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
