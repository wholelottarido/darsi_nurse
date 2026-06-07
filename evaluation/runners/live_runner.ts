import fs from 'fs/promises';
import path from 'path';
import { testCases } from './data.js';
import { calculateF1Score } from '../metrics/f1.js';
import { calculateAccuracy } from '../metrics/accuracy.js';
import { calculatePerplexity } from '../metrics/perplexity.js';
import { chat } from '../../src/lib/agents/triage-agent.js'; 

async function runLiveEvaluations() {
  console.log('🚀 Memulai Evaluasi LIVE terintegrasi DATABASE DB-Nurse...\n');
  
  const results = [];

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    console.log(`\n⏳ Menguji Kasus ${tc.id}: [Pasien: ${tc.patientName}] "${tc.question}"...`);
    
    try {
      // Prompt guidance tambahan agar Llama 3.2 function calling bekerja sebagaimana mestinya
      const promptWithGuidance = tc.question + `
      
[INSTRUKSI WAJIB]:
1. Anda HARUS memanggil tool getPatientHealthSummary dengan parameter patientId: "${tc.patientId}" .
2. Anda HARUS memanggil tool searchDiagnosaWithTriage dengan parameter symptoms dari masalah di atas (tanpa limit).
Jangan merespon apapun sampai kedua eksekusi tool di atas selesai!`;

      // Pass ID asli dari postgres!
      const agentResponse = await chat(promptWithGuidance, tc.patientId); 
      
      const generatedAnswer = agentResponse.success 
        ? agentResponse.message 
        : (agentResponse.error || "Gagal mendapatkan respon");
        
      const toolsUsed = agentResponse.toolsUsed || [];
      
      console.log(`🛠️ Tools yang dipanggil: [${toolsUsed.join(', ')}]`);
      if (agentResponse.success) {
         console.log(`🤖 Jawaban Agen: ${generatedAnswer.substring(0, 150)}...`);
      } else {
         console.log(`❌ Agen Error: ${generatedAnswer}`);
      }

      const f1Score = calculateF1Score(generatedAnswer, tc.expectedAnswer);
      const accuracy = calculateAccuracy(generatedAnswer, tc.expectedAnswer);
      const perplexity = calculatePerplexity(generatedAnswer, tc.expectedAnswer);

      results.push({
        id: tc.id,
        question: tc.question,
        patientName: tc.patientName,
        expectedAnswer: tc.expectedAnswer,
        generatedAnswer,
        toolsUsed,
        f1Score,
        accuracy,
        perplexity
      });
    } catch (error: any) {
      console.error(`❌ Fatal Error pada Test Case ${tc.id}:`, error.message);
    }
  }

  if (results.length === 0) {
      console.log("⚠️ Tidak ada hasil.");
      return;
  }

  // Hitung Rata-rata
  const avgF1 = (results.reduce((a, c) => a + c.f1Score, 0) / results.length).toFixed(2);
  const avgAccuracy = (results.reduce((a, c) => a + c.accuracy, 0) / results.length).toFixed(2);
  const avgPerplexity = (results.reduce((a, c) => a + c.perplexity, 0) / results.length).toFixed(2);

  // Print Tabel di Console
  console.table(results.map(r => ({
    'ID': `Uji ${r.id}`,
    'Pasien': r.patientName,
    'Tools': r.toolsUsed.length,
    'F1': r.f1Score,
    'Acc': r.accuracy,
    'Pplx': r.perplexity
  })));

  console.log('\n================================');
  console.log(`RATA-RATA: F1 => ${avgF1} | Accuracy => ${avgAccuracy} | Perplexity => ${avgPerplexity}`);
  console.log('================================\n');

  // Generate output tabel .md
  let mdReport = `# Hasil Evaluasi Real-Database PostgreSQL (LIVE)\n\n`;
  mdReport += `**Tanggal**: ${new Date().toISOString().split('T')[0]}\n\n`;
  mdReport += `| Pengetesan | Pasien | Tools Dipanggil | F1 | Acc | Pplx |\n`;
  mdReport += `|------------|--------|-----------------|----|-----|------|\n`;
  results.forEach(r => {
    mdReport += `| Uji ${r.id} | ${r.patientName} | ${r.toolsUsed.join(', ') || 'None'} | ${r.f1Score} | ${r.accuracy} | ${r.perplexity} |\n`;
  });
  mdReport += `| **Rata-Rata** | - | - | **${avgF1}** | **${avgAccuracy}** | **${avgPerplexity}** |\n\n`;

  await fs.writeFile(path.join(process.cwd(), 'hasil_scoring_db.md'), mdReport);
  console.log('✅ Tersimpan di folder evaluation/hasil_scoring_db.md!');

  const allMetricsData = results.map(r => ({
    id: r.id,
    patientName: r.patientName,
    question: r.question,
    expectedAnswer: r.expectedAnswer,
    generatedAnswer: r.generatedAnswer,
    toolsUsed: r.toolsUsed,
    metrics: { f1Score: r.f1Score, accuracy: r.accuracy, perplexity: r.perplexity }
  }));

  await fs.writeFile(path.join(process.cwd(), 'live_db_metrics_results.json'), JSON.stringify(allMetricsData, null, 2));
}

runLiveEvaluations().catch(console.error);
