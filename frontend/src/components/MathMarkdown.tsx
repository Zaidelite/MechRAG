'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface MathMarkdownProps {
  content: string;
  className?: string;
}

const preprocessLaTeX = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/\\\[\s*/g, '\n$$\n')
    .replace(/\s*\\\]/g, '\n$$\n')
    .replace(/\\\(\s*/g, '$')
    .replace(/\s*\\\)/g, '$');
};

export const MathMarkdown: React.FC<MathMarkdownProps> = ({ content, className = '' }) => {
  const formattedContent = preprocessLaTeX(content);

  return (
    <div className={`prose prose-invert max-w-none text-[#f3f4f6] text-[15.5px] leading-relaxed break-words overflow-hidden ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ node, inline, className, children, ...props }: any) {
            return (
              <code
                className={`${className || ''} bg-[#070b08] px-2 py-0.5 rounded text-[#a9d98c] font-mono text-sm border border-[#1c2620] break-all`}
                {...props}
              >
                {children}
              </code>
            );
          },
          p({ children }) {
            return <p className="mb-4 leading-8 text-[#f1f5f9] text-[15.5px] tracking-wide break-words max-w-full">{children}</p>;
          },
          h1({ children }) {
            return <h1 className="text-2xl font-bold font-mono text-[#a9d98c] mt-8 mb-4 pt-2 border-b border-[#1c2620] pb-2 tracking-wide break-words">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-xl font-bold font-mono text-[#bdf09b] mt-7 mb-3.5 tracking-wide break-words">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-lg font-semibold font-mono text-[#c8f5ab] mt-6 mb-3 tracking-wide break-words">{children}</h3>;
          },
          h4({ children }) {
            return <h4 className="text-base font-semibold font-mono text-[#8fbf76] mt-5 mb-2 tracking-wide break-words">{children}</h4>;
          },
          ul({ children }) {
            return <ul className="list-disc list-outside pl-6 space-y-2.5 my-4 text-[#e5e7eb] text-[15.5px] leading-7 break-words">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal list-outside pl-6 space-y-2.5 my-4 text-[#e5e7eb] text-[15.5px] leading-7 break-words">{children}</ol>;
          },
          li({ children }) {
            return <li className="pl-1.5 leading-8 mb-1.5 tracking-wide">{children}</li>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-3 border-[#5f8a4d] pl-4 py-2 my-4 bg-[#101712]/60 rounded-r-md text-[#d1d5db] italic">
                {children}
              </blockquote>
            );
          },
          hr() {
            return <hr className="my-6 border-[#1c2620]" />;
          },
        }}
      >
        {formattedContent}
      </ReactMarkdown>
    </div>
  );
};

export default MathMarkdown;
