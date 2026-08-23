import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import 'katex/dist/contrib/mhchem.mjs';

/**
 * The one place educational/AI-generated markdown gets rendered, app-wide (topic content,
 * flashcards, lessons, assessments, tutor replies, insights). Deliberately does not accept
 * raw HTML — react-markdown never uses dangerouslySetInnerHTML for the markdown text
 * itself, so embedded `<script>`/`<img onerror>` etc. render as inert escaped text rather
 * than live DOM. That's the whole XSS story here: safe by construction, no sanitizer
 * trying to keep pace with model output.
 */
export function RichContent({ content, className }: { content: string; className?: string }) {
  return (
    <div dir="auto" className={`prose prose-sm max-w-none ${className ?? ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
