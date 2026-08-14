import { render, screen } from '@testing-library/react';
import React from 'react';
import MathMarkdown from '../../components/MathMarkdown';

jest.mock('react-markdown', () => {
  return function DummyMarkdown({ children }: { children: string }) {
    return <div data-testid="react-markdown">{children}</div>;
  };
});

jest.mock('remark-math', () => ({}));
jest.mock('rehype-katex', () => ({}));

describe('MathMarkdown Component', () => {
  it('renders standard plain text correctly', () => {
    render(<MathMarkdown content="Hello Mechanical Engineering RAG" />);
    expect(screen.getByTestId('react-markdown')).toHaveTextContent('Hello Mechanical Engineering RAG');
  });

  it('renders inline latex math content correctly', () => {
    render(<MathMarkdown content={String.raw`Stress equation is $\sigma = F / A$` } />);
    expect(screen.getByTestId('react-markdown')).toHaveTextContent(String.raw`Stress equation is $\sigma = F / A$`);
  });

  it('handles empty content gracefully', () => {
    const { container } = render(<MathMarkdown content="" />);
    expect(container).toBeDefined();
  });
});
