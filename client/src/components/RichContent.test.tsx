import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RichContent } from './RichContent';

afterEach(() => cleanup());

describe('RichContent', () => {
  it('renders headings, lists, and emphasis as real elements', () => {
    render(<RichContent content={'# Title\n\n- one\n- two\n\n**bold** text'} />);
    expect(screen.getByRole('heading', { name: 'Title' })).toBeDefined();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('bold').tagName).toBe('STRONG');
  });

  it('renders a markdown table wrapped in a scrollable container', () => {
    const { container } = render(<RichContent content={'| A | B |\n| - | - |\n| 1 | 2 |'} />);
    const table = screen.getByRole('table');
    expect(table).toBeDefined();
    expect(container.querySelector('.overflow-x-auto table')).not.toBeNull();
  });

  it('renders a math expression via KaTeX rather than raw LaTeX source', () => {
    const { container } = render(<RichContent content={'$x^2 + y^2 = z^2$'} />);
    expect(container.querySelector('.katex')).not.toBeNull();
    expect(container.textContent).not.toContain('$x^2');
  });

  it('renders embedded raw HTML as inert escaped text, not live DOM', () => {
    const { container } = render(<RichContent content={'<script>window.__pwned = true</script>'} />);
    expect(container.querySelector('script')).toBeNull();
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
  });

  it('defaults to the fixed prose-sm size with no inline font-size (unchanged for existing consumers)', () => {
    const { container } = render(<RichContent content={'text'} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('prose-sm');
    expect(root.style.fontSize).toBe('');
  });

  it('scalable renders with a CSS-variable-driven font-size and drops the fixed prose-sm class', () => {
    const { container } = render(<RichContent content={'text'} scalable />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).not.toContain('prose-sm');
    expect(root.style.fontSize).toBe('calc(1em * var(--reader-font-scale, 1))');
  });
});
