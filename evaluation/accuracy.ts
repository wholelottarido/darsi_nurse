export function calculateAccuracy(generated: string, expected: string): number {
  const normalize = (text: string) => text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 0);
  const genTokens = normalize(generated);
  const expTokens = normalize(expected);
  
  if (expTokens.length === 0) return 0;

  let matchCount = 0;
  for (const token of expTokens) {
    if (genTokens.includes(token)) matchCount++;
  }
  return Number((matchCount / expTokens.length).toFixed(2));
}
