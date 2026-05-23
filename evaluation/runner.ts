import fs from 'fs/promises';
import path from 'path';
import { testCases } from './data.js';
import { calculateF1Score } from './f1.js';
import { calculateAccuracy } from './accuracy.js';
import { calculatePerplexity } from './perplexity.js';

async function runEvaluations() {
  console.log('🚀 Menghitung Evaluasi Kuantitatif Terpisah...\n');
  
  const results = testCases.map(tc => ({
    id: tc.id,
    question: tc.question,
    f1Score: calculateF1Score(tc.generatedAnswer, tc.expectedAnswer),
    accuracy: calculateAccuracy(tc.generatedAnswer, tc.expectedAnswer),
    perplexity: calculatePerplexity(tc.generatedAnswer, tc.expectedAnswer)
  }));

  const avgF1 = (results.reduce((a, c) => a + c.f1Score, 0) / 5).toFixed(2);
  const avgAccuracy = (results.reduce((a, c) => a + c.accuracy, 0) / 5).toFixed(2);
  const avgPerplexity = (results.reduce((a, c) => a + c.perplexity, 0) / 5).toFixed(2);

  // Print Tabel di Console
  console.table(results.map(r => ({
    'Test Case': `Uji ${r.id}`,
    'F1-Score': r.f1Score,
    'Accuracy': r.accuracy,
    'Perplexity': r.perplexity
  })));

  console.log('\n================================');
  console.log(`RATA-RATA: F1 => ${avgF1} | Accuracy => ${avgAccuracy} | Perplexity => ${avgPerplexity}`);
  console.log('================================\n');

  // Generate output tabel .md
  let mdReport = `# Hasil Evaluasi Kuantitatif DARSI Nurse (Terpisah)\n\n`;
  mdReport += `| Pengetesan | F1-Score | Accuracy | Perplexity |\n`;
  mdReport += `|------------|----------|----------|------------|\n`;
  results.forEach(r => {
    mdReport += `| Uji ${r.id} | ${r.f1Score} | ${r.accuracy} | ${r.perplexity} |\n`;
  });
  mdReport += `| **Rata-Rata** | **${avgF1}** | **${avgAccuracy}** | **${avgPerplexity}** |\n\n`;

  await fs.writeFile(path.join(process.cwd(), 'hasil_scoring.md'), mdReport);
  console.log('✅ Tersimpan di folder evaluation/hasil_scoring.md!');

  /////////////////////////////////////////////////////////////////////////////
  // SIMPAN HASIL JSON PER METODE (TERMASUK EXPECTED & GENERATED ANSWER)
  /////////////////////////////////////////////////////////////////////////////

  const f1Data = testCases.map((tc, index) => ({
    id: tc.id,
    question: tc.question,
    expectedAnswer: tc.expectedAnswer,
    generatedAnswer: tc.generatedAnswer,
    f1Score: results[index].f1Score
  }));

  const accuracyData = testCases.map((tc, index) => ({
    id: tc.id,
    question: tc.question,
    expectedAnswer: tc.expectedAnswer,
    generatedAnswer: tc.generatedAnswer,
    accuracy: results[index].accuracy
  }));

  const perplexityData = testCases.map((tc, index) => ({
    id: tc.id,
    question: tc.question,
    expectedAnswer: tc.expectedAnswer,
    generatedAnswer: tc.generatedAnswer,
    perplexity: results[index].perplexity
  }));

  const allMetricsData = testCases.map((tc, index) => ({
    id: tc.id,
    question: tc.question,
    expectedAnswer: tc.expectedAnswer,
    generatedAnswer: tc.generatedAnswer,
    metrics: {
      f1Score: results[index].f1Score,
      accuracy: results[index].accuracy,
      perplexity: results[index].perplexity
    }
  }));

  await fs.writeFile(path.join(process.cwd(), 'f1_results.json'), JSON.stringify(f1Data, null, 2));
  await fs.writeFile(path.join(process.cwd(), 'accuracy_results.json'), JSON.stringify(accuracyData, null, 2));
  await fs.writeFile(path.join(process.cwd(), 'perplexity_results.json'), JSON.stringify(perplexityData, null, 2));
  await fs.writeFile(path.join(process.cwd(), 'all_metrics_results.json'), JSON.stringify(allMetricsData, null, 2));

  console.log('✅ Tersimpan hasil JSON untuk masing-masing metode (F1, Accuracy, Perplexity)!');
}

runEvaluations().catch(console.error);
