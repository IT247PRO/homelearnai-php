import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import 'katex/dist/contrib/mhchem.mjs';

/**
 * Preprocesses mathematical markdown to normalize common LaTeX delimiter formats
 * (such as \[ ... \], \( ... \), or unescaped blocks) into remark-math compatible $...$ and $$...$$.
 */
export function normalizeMathMarkdown(text: string): string {
  if (!text) return '';
  let processed = text;

  // Convert \[ ... \] to $$ ... $$ (display math)
  processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (_match, math) => `\n$$\n${math.trim()}\n$$\n`);

  // Convert \( ... \) to $ ... $ (inline math)
  processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (_match, math) => `$${math.trim()}$`);

  return processed;
}

/**
 * The one place educational/AI-generated markdown gets rendered, app-wide (topic content,
 * flashcards, lessons, assessments, worksheets, study guides, tutor replies, insights).
 */
export function RichContent({ content, className }: { content: string; className?: string }) {
  const normalized = normalizeMathMarkdown(content ?? '');

  return (
    <div dir="auto" className={`prose prose-sm max-w-none math-rich-content ${className ?? ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { output: 'htmlAndMathml', strict: false, throwOnError: false }]]}
        components={{
          table: ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full text-left text-xs border border-slate-200">{children}</table>
            </div>
          ),
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
}

