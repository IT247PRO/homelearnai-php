/** Strips HTML tags and common markdown emphasis/heading/code markers so Speech Synthesis reads
 * plain words instead of literal symbols. Consolidates what was previously duplicated verbatim
 * across KidsHomePage, KidsAssessmentPage, and FlashcardReviewCard. */
export function toSpeechText(markdown: string): string {
  return (markdown ?? '').replace(/<[^>]*>?/gm, '').replace(/[*_#`]/g, '');
}
