import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from '../../components/Sidebar';
import { DocumentRecord } from '../../types';

describe('Sidebar Component', () => {
  const mockDocuments: DocumentRecord[] = [
    {
      id: 'doc-1',
      file_name: 'Fluid_Mechanics.pdf',
      book_title: 'Fluid Mechanics 8th Ed',
      subject: 'Fluid Mechanics',
      sha256: 'abc123hash',
      status: 'done',
      total_pages: 50,
      total_chunks: 120,
      error_message: null,
      created_at: '2026-08-14 10:00:00'
    },
    {
      id: 'doc-2',
      file_name: 'Thermodynamics.pdf',
      book_title: 'Thermodynamics Engineering',
      subject: 'Thermodynamics',
      sha256: 'def456hash',
      status: 'done',
      total_pages: 80,
      total_chunks: 200,
      error_message: null,
      created_at: '2026-08-14 10:30:00'
    }
  ];

  const mockChats = [
    { id: 'c_1', title: 'Carnot cycle efficiency', messages: [] }
  ];

  it('renders textbook titles and source pdfs count correctly', () => {
    render(
      <Sidebar
        isOpen={true}
        onToggle={jest.fn()}
        documents={mockDocuments}
        activeBookFilter={null}
        onSelectBookFilter={jest.fn()}
        onDeleteDocument={jest.fn()}
        onOpenUploadModal={jest.fn()}
        chats={mockChats}
        activeChatId="c_1"
        onSelectChat={jest.fn()}
        onNewChat={jest.fn()}
      />
    );

    expect(screen.getByText('source pdfs')).toBeInTheDocument();
    expect(screen.getByText('Fluid Mechanics 8th Ed')).toBeInTheDocument();
    expect(screen.getByText('Thermodynamics Engineering')).toBeInTheDocument();
    expect(screen.getByText('Carnot cycle efficiency')).toBeInTheDocument();
  });

  it('triggers new chat callback when new chat button is clicked', () => {
    const handleNewChat = jest.fn();
    render(
      <Sidebar
        isOpen={true}
        onToggle={jest.fn()}
        documents={mockDocuments}
        activeBookFilter={null}
        onSelectBookFilter={jest.fn()}
        onDeleteDocument={jest.fn()}
        onOpenUploadModal={jest.fn()}
        chats={mockChats}
        activeChatId="c_1"
        onSelectChat={jest.fn()}
        onNewChat={handleNewChat}
      />
    );

    const newChatBtn = screen.getByRole('button', { name: /new chat/i });
    fireEvent.click(newChatBtn);
    expect(handleNewChat).toHaveBeenCalledTimes(1);
  });
});
