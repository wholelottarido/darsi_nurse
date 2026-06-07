export function calculateF1Score(generated: string, expected: string): number {
  const normalize = (text: string) => text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 0);
  const genTokens = normalize(generated);
  const expTokens = normalize(expected);
  
  if (genTokens.length === 0 || expTokens.length === 0) return 0;

  const expTokenSet = new Set(expTokens);
  let overlap = 0;
  
  for (const token of genTokens) {
    if (expTokenSet.has(token)) {
      overlap++;
    }
  }

  const precision = overlap / genTokens.length;
  const recall = overlap / expTokens.length;

  if (precision + recall === 0) return 0;
  return Number(((2 * precision * recall) / (precision + recall)).toFixed(2));
}
