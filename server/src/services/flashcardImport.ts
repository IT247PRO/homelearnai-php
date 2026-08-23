export interface ParsedCard {
  question: string;
  answer: string;
  hint?: string;
}

/**
 * Parses CSV/TSV/plain-text flashcard exports (the common denominator format for Quizlet,
 * spreadsheet exports, and hand-written card lists): one card per line, front/back
 * separated by a delimiter, optional third column as a hint. Quoted fields (RFC 4180-ish)
 * are supported for CSV so commas inside an answer don't split incorrectly.
 */
export function parseDelimitedCards(content: string, delimiter: ',' | '\t'): ParsedCard[] {
  const cards: ParsedCard[] = [];
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);

  for (const line of lines) {
    const fields = splitDelimitedLine(line, delimiter);
    if (fields.length < 2) continue;
    const [question, answer, hint] = fields;
    if (!question.trim() || !answer.trim()) continue;
    cards.push({ question: question.trim(), answer: answer.trim(), hint: hint?.trim() || undefined });
  }

  return cards;
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

export function cardsToCsv(cards: Array<{ question: string; answer: string; hint: string | null; cardType: string; difficultyLevel: string }>): string {
  const escape = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const header = 'question,answer,hint,cardType,difficultyLevel';
  const rows = cards.map((c) =>
    [c.question, c.answer, c.hint ?? '', c.cardType, c.difficultyLevel].map(escape).join(',')
  );
  return [header, ...rows].join('\n');
}
