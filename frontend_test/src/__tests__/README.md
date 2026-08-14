# Frontend Test Suite (`frontend/src/__tests__`)

This directory is designated for testing Next.js 14 React components, services, and hooks for the **MechRAG** Web UI.

## Structure
- `components/` - Unit tests for React components (`Sidebar`, `MathMarkdown`, `CitationDrawer`, `UploadModal`, `ModelSelector`).
- `services/` - Integration tests for API client interactions (`api.ts`).

## Running Tests
Tests can be executed using Jest / Vitest / Playwright once configured:
```bash
cd frontend
npm test
```
