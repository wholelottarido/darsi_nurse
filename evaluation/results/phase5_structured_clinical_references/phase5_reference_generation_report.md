# Phase 5 Structured Clinical Reference Report

This run generated 30 structured clinical references directly from the database for future NLP evaluation.

## Summary
- Complete references: 30
- Partial references: 0
- Missing required data: 0
- Usable for NLP evaluation: 30
- Not usable for NLP evaluation: 0

## Frequently Missing Fields
- No missing fields were recorded.

## Example Reference
The patient presents with Gatal pada kulit setelah memakai sabun baru. Objective findings show TD 116/74 mmHg, Nadi 78 bpm, Suhu 36.6 C, ruam ringan pada lengan. The clinical assessment is Gejala konsisten dengan reaksi iritan kontak ringan (L29.9) terkait sabun baru, dengan demam yang membaik (R50.9). Tidak ada bukti infeksi sekunder atau reaksi alergi berat. Pemulihan klinis berjalan dengan residual kelelahan (lemas) dan gejala kulit yang masih ada tetapi tidak progresif. Subyektif terbaru menunjukkan peningkatan nafsu makan dan penurunan demam, mendukung trajet pemulihan. ICD: L29.9 Pruritus, unspecified, supported by ICD-10 code L29.9, Pruritus, unspecified. The triage level is LOW. The recommended plan is Teruskan pemantauan kondisi kulit dan sistemik. Edukasi pasien untuk menghindari pemicu sabun yang diduga menyebabkan iritasi. Gunakan pelembap bila diperlukan. Jika demam kembali atau ruam menyebar/menambah, segera evaluasi ulang. Libatkan dokter jika muncul tanda infeksi atau reaksi alergi berat.

## Notes
- The reference set is built from database content only.
- ICD-10 names are resolved from the icd10_diagnoses table when needed.
- The output is ready to serve as a gold/reference baseline for later BLEU, ROUGE-L, and BERTScore evaluation if the usable count remains complete.