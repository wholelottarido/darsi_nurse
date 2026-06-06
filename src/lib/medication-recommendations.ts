type IcdItem = {
  icd_code?: string | null;
  icd_name?: string | null;
};

type MedicationRecommendationArgs = {
  icd: IcdItem[];
  patientCondition?: string | null;
  summary?: string | null;
  assessment?: string | null;
  plan?: string | null;
};

function hasText(value?: string | null) {
  const normalized = String(value || '').trim();
  return normalized && normalized !== '-';
}

function normalizeCode(value?: string | null) {
  return String(value || '').trim().toUpperCase();
}

function buildLine(code: string, text: string) {
  return `${code}: ${text}`;
}

function recommendationForIcd(item: IcdItem) {
  const code = normalizeCode(item.icd_code);
  const name = String(item.icd_name || '').toLowerCase();

  if (code.startsWith('S92') || name.includes('fracture') || name.includes('fraktur')) {
    return buildLine(code || 'S92', 'analgesik non-opioid seperti parasetamol; pertimbangkan ibuprofen bila tidak ada kontraindikasi GI/ginjal/perdarahan.');
  }

  if (code.startsWith('M10') || name.includes('gout') || name.includes('asam urat')) {
    return buildLine(code || 'M10', 'NSAID atau kolkisin bila tidak ada kontraindikasi; pertimbangkan parasetamol bila nyeri ringan dan NSAID tidak sesuai.');
  }

  if (code.startsWith('R50') || name.includes('fever') || name.includes('demam')) {
    return buildLine(code || 'R50', 'parasetamol untuk demam/nyeri dan hidrasi adekuat; evaluasi penyebab demam tetap diperlukan.');
  }

  if (code.startsWith('R51') || name.includes('headache') || name.includes('nyeri kepala')) {
    return buildLine(code || 'R51', 'parasetamol sebagai analgetik awal; pertimbangkan ibuprofen bila tidak ada kontraindikasi.');
  }

  if (code.startsWith('J06') || name.includes('upper respiratory') || name.includes('batuk') || name.includes('cough')) {
    return buildLine(code || 'J06', 'parasetamol bila ada demam/nyeri serta terapi simptomatik batuk seperti ambroxol atau asetilsistein bila sesuai keluhan.');
  }

  if (code.startsWith('I10') || name.includes('hypertension') || name.includes('hipertensi')) {
    return buildLine(code || 'I10', 'lanjutkan/optimalkan antihipertensi sesuai regimen dokter, misalnya amlodipine, dengan monitoring tekanan darah.');
  }

  if (code.startsWith('E11') || name.includes('diabetes')) {
    return buildLine(code || 'E11', 'lanjutkan terapi antidiabetik sesuai regimen dokter dan monitor glukosa; jangan memulai obat baru tanpa verifikasi regimen yang sedang berjalan.');
  }

  if (code.startsWith('R05') || name.includes('cough')) {
    return buildLine(code || 'R05', 'terapi simptomatik batuk seperti ambroxol atau asetilsistein bila ada dahak, disesuaikan dengan keluhan.');
  }

  return null;
}

export function buildMedicationRecommendation(args: MedicationRecommendationArgs) {
  const recommendations = args.icd
    .map(recommendationForIcd)
    .filter((value): value is string => Boolean(value));

  if (recommendations.length > 0) {
    return `${recommendations.join(' ')} Verifikasi alergi, fungsi ginjal, risiko perdarahan/GI, kehamilan, dan regimen obat yang sudah berjalan sebelum pemberian.`;
  }

  const combined = [args.patientCondition, args.summary, args.assessment, args.plan]
    .filter(hasText)
    .join(' ')
    .toLowerCase();

  if (combined.includes('demam') || combined.includes('fever')) {
    return 'Parasetamol untuk demam/nyeri dapat dipertimbangkan sebagai terapi simptomatik, dengan verifikasi alergi dan evaluasi penyebab klinis.';
  }

  if (combined.includes('nyeri') || combined.includes('sakit')) {
    return 'Analgesik awal seperti parasetamol dapat dipertimbangkan; ibuprofen hanya bila tidak ada kontraindikasi GI/ginjal/perdarahan.';
  }

  if (combined.includes('batuk') || combined.includes('dahak')) {
    return 'Terapi simptomatik batuk seperti ambroxol atau asetilsistein dapat dipertimbangkan sesuai keluhan, dengan evaluasi klinis lanjutan.';
  }

  return 'Rekomendasi obat simptomatik disesuaikan dengan kondisi klinis terbaru dan kode ICD aktif; verifikasi alergi serta regimen obat yang sudah berjalan sebelum pemberian.';
}
