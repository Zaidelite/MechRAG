'use client';

import React, { useState, useEffect } from 'react';
import { X, Upload, CheckCircle2, AlertCircle, Loader2, FileText } from 'lucide-react';
import { uploadDocument, getIngestionStatus } from '../services/api';
import { IngestionStatus } from '../types';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose, onUploadComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [subject, setSubject] = useState<string>('Fluid Mechanics');
  const [bookTitle, setBookTitle] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [status, setStatus] = useState<IngestionStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDuplicate, setIsDuplicate] = useState<boolean>(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (documentId && status && status !== 'done' && status !== 'failed') {
      timer = setInterval(async () => {
        try {
          const res = await getIngestionStatus(documentId);
          setStatus(res.status);
          if (res.status === 'done') {
            setIsUploading(false);
            onUploadComplete();
          } else if (res.status === 'failed') {
            setIsUploading(false);
            setErrorMessage(res.error_message || 'Document processing failed.');
          }
        } catch (err: any) {
          console.error('Status polling error:', err);
        }
      }, 1500);
    }
    return () => clearInterval(timer);
  }, [documentId, status, onUploadComplete]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      if (!bookTitle) {
        setBookTitle(selected.name.replace(/\.pdf$/i, ''));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setErrorMessage(null);
    setIsDuplicate(false);

    try {
      const res = await uploadDocument(file, subject, bookTitle);
      setDocumentId(res.document_id);
      setStatus(res.status);
      setIsDuplicate(!!res.is_duplicate);

      if (res.status === 'done' || res.is_duplicate) {
        setIsUploading(false);
        onUploadComplete();
      }
    } catch (err: any) {
      setIsUploading(false);
      setErrorMessage(err.response?.data?.detail || 'Failed to upload document.');
    }
  };

  const handleReset = () => {
    setFile(null);
    setDocumentId(null);
    setStatus(null);
    setErrorMessage(null);
    setIsUploading(false);
    setIsDuplicate(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">Index PDF Textbook</h3>
              <p className="text-xs text-slate-400">Extracts text, LaTeX formulas & headings</p>
            </div>
          </div>
          <button onClick={handleReset} className="text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Textbook PDF File</label>
            <div className="border-2 border-dashed border-slate-700 hover:border-cyan-500/50 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-950/40">
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
                disabled={isUploading}
              />
              <label htmlFor="file-upload" className="cursor-pointer block">
                <FileText className="w-8 h-8 mx-auto mb-2 text-cyan-400 opacity-80" />
                {file ? (
                  <span className="text-sm font-semibold text-slate-200 block truncate">{file.name}</span>
                ) : (
                  <>
                    <span className="text-xs font-semibold text-cyan-400 block">Click to select PDF</span>
                    <span className="text-[11px] text-slate-500 block mt-1">Supports college textbooks up to 1,000+ pages</span>
                  </>
                )}
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Subject Area</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                disabled={isUploading}
              >
                <option value="Fluid Mechanics">Fluid Mechanics</option>
                <option value="Thermodynamics">Thermodynamics</option>
                <option value="Heat Transfer">Heat Transfer</option>
                <option value="Solid Mechanics">Solid Mechanics</option>
                <option value="Machine Design">Machine Design</option>
                <option value="General">General</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Book Title (Optional)</label>
              <input
                type="text"
                placeholder="Fluid Mechanics (White)"
                value={bookTitle}
                onChange={(e) => setBookTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                disabled={isUploading}
              />
            </div>
          </div>

          {/* Status Indicators */}
          {status && (
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Ingestion Pipeline State:</span>
                <span className="font-semibold text-cyan-400 uppercase tracking-wider">{status}</span>
              </div>
              {isDuplicate && (
                <p className="text-amber-400 text-[11px] flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> SHA256 match found: Textbook is already fully indexed!
                </p>
              )}
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-950/50 border border-red-800/50 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!file || isUploading}
              className="px-5 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-cyan-500/20"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload & Index</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UploadModal;
