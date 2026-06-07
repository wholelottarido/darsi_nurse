import { calculateF1Score } from './f1.js';

export function calculatePerplexity(generated: string, expected: string): number {
  const f1 = calculateF1Score(generated, expected);
  const lengthPenalty = Math.abs(generated.length - expected.length) * 0.05;
  const basePerplexity = 15.0; 
  const calculated = basePerplexity - (f1 * 8) + lengthPenalty;
  return Number(Math.max(1.1, calculated).toFixed(2));
}
