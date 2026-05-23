export interface TestCase {
  id: number;
  patientId: string;
  patientName: string;
  question: string;
  expectedAnswer: string;
  generatedAnswer: string;
}

export const testCases: TestCase[] = [
  {
    id: 1,
    patientId: "5923ff7d-a9ed-4b11-8a3b-577a43cc78e3",
    patientName: "Ahmad",
    question: "Pasien datang mengeluh demam tinggi dan sakit kepala. Tolong cek datanya dan beri diagnosis.",
    expectedAnswer: "Berdasarkan data, pasien bernama Ahmad memiliki alergi Parasetamol dan riwayat Asma. Gejala demam dan sakit kepala mengarah ke Demam Tifoid atau infeksi lainnya (Triase: MODERATE/HIGH). Hindari memberikan Parasetamol karena adanya riwayat alergi yang bersangkutan.",
    generatedAnswer: ""
  },
  {
    id: 2,
    patientId: "5b507535-6ba8-4e9e-a879-88feddcc0dca",
    patientName: "mikel",
    question: "Pasien mengeluh gatal-gatal, ruam merah, dan sesak napas setelah makan seafood malam ini.",
    expectedAnswer: "Data pasien Mikel menunjukkan adanya alergi Udang. Gejala gatal, ruam merah dan sesak napas mengindikasikan Syok Anafilaksis atau Alergi (Triase: URGENT). Segera tangani masalah pernapasan mengingat pasien juga memiliki riwayat Asma.",
    generatedAnswer: ""
  },
  {
    id: 3,
    patientId: "18c81a0e-5c67-4953-bd2e-f7f4e2ae5fcb",
    patientName: "Test Simpan",
    question: "Pasien batuk ringan dan pilek, tidak ada keluhan sesak atau nyeri hebat.",
    expectedAnswer: "Pasien atas nama Test Simpan memiliki keluhan batuk ringan dan pilek (ISPA/Selesma). Triase level LOW. Tidak ada riwayat alergi atau penyakit khusus yang perlu diperhatikan berat dalam database.",
    generatedAnswer: ""
  }
];
