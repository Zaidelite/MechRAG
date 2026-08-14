'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface MathMarkdownProps {
  content: string;
  className?: string;
}

export const MathMarkdown: React.FC<MathMarkdownProps> = ({ content, className = '' }) => {
  return (
    <div className={`prose prose-invert max-w-none text-[#e9dfc4] leading-relaxed break-words overflow-hidden ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ node, inline, className, children, ...props }: any) {
            return (
              <code
                className={`${className || ''} bg-[#070b08] px-1.5 py-0.5 rounded text-[#8fbf76] font-mono text-sm border border-[#1c2620] break-all`}
                {...props}
              >
                {children}
              </code>
            );
          },
          p({ children }) {
            return <p className="mb-3 leading-7 text-[#e9dfc4] break-words max-w-full">{children}</p>;
          },
          h1({ children }) {
            return <h1 className="text-xl font-bold font-mono text-[#8fbf76] mt-4 mb-2 break-words">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-lg font-bold font-mono text-[#8fbf76] mt-3 mb-2 break-words">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-base font-semibold font-mono text-[#a9d98c] mt-2 mb-1 break-words">{children}</h3>;
          },
          ul({ children }) {
            return <ul className="list-disc list-inside space-y-1 my-2 text-[#b8ae93] break-words">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal list-inside space-y-1 my-2 text-[#b8ae93] break-words">{children}</ol>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MathMarkdown;
