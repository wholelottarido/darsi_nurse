import { hospitalQuery } from "@/lib/hospital-db";

export type ClinicalIcdReference = {
  icd_code: string;
  icd_name: string;
  triageLevel: "URGENT" | "HIGH" | "MODERATE" | "LOW" | "UNKNOWN";
  source: "soap_keyword_icd" | "icd10_diagnoses";
  keyword?: string | null;
  priority?: number | null;
};

type SearchTerm = {
  term: string;
  codeHint?: string;
};

function normalizeText(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function uniqueTerms(values: Array<SearchTerm | null | undefined>) {
  const seen = new Set<string>();
  const next: SearchTerm[] = [];

  values.forEach((value) => {
    if (!value?.term) return;
    const key = `${value.codeHint || ""}|${value.term.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    next.push(value);
  });

  return next;
}

function buildSearchTerms(text: string) {
  const lower = normalizeText(text);
  const terms: Array<SearchTerm | null> = [];

  const has = (...needles: string[]) => needles.some((needle) => lower.includes(needle));

  if (has("retakan tulang", "fraktur", "patah tulang")) {
    if (has("kaki", "foot", "telapak", "jari kaki")) {
      terms.push({ term: "S92", codeHint: "S92" });
      terms.push({ term: "fracture foot", codeHint: "S92" });
      terms.push({ term: "fracture" });
      terms.push({ term: "foot" });
    } else {
      terms.push({ term: "fracture" });
    }
  }

  if (has("asam urat", "gout", "podagra")) {
    terms.push({ term: "M10", codeHint: "M10" });
    terms.push({ term: "gout", codeHint: "M10" });
  }

  if (has("sakit kepala", "nyeri kepala", "headache", "pusing")) {
    terms.push({ term: "R51", codeHint: "R51" });
    terms.push({ term: "headache", codeHint: "R51" });
  }

  if (has("demam", "fever", "panas", "suhu tinggi")) {
    terms.push({ term: "R50", codeHint: "R50" });
    terms.push({ term: "fever", codeHint: "R50" });
  }

  if (has("batuk", "cough", "pilek", "flu", "ispa")) {
    terms.push({ term: "J06", codeHint: "J06" });
    terms.push({ term: "cough" });
  }

  if (has("hipertensi", "tekanan darah tinggi")) {
    terms.push({ term: "I10", codeHint: "I10" });
    terms.push({ term: "hypertension", codeHint: "I10" });
  }

  if (has("diabetes", "gula darah")) {
    terms.push({ term: "E11", codeHint: "E11" });
    terms.push({ term: "diabetes", codeHint: "E11" });
  }

  if (has("sesak", "shortness of breath", "dyspnea")) {
    terms.push({ term: "dyspnea" });
  }

  if (has("nyeri", "sakit", "pain")) {
    terms.push({ term: "pain" });
  }

  const firstToken = lower.split(/\s+/).find(Boolean);
  if (firstToken) {
    terms.push({ term: firstToken });
  }

  return uniqueTerms(terms);
}

function assignTriageLevel(reference: { icd_code: string; icd_name: string; keyword?: string | null }) {
  const combined = `${reference.icd_code} ${reference.icd_name} ${reference.keyword || ""}`.toLowerCase();

  if (
    ["sepsis", "shock", "meningitis", "stroke", "hemorrhage", "respiratory failure", "encephalitis"].some((keyword) =>
      combined.includes(keyword)
    )
  ) {
    return "URGENT" as const;
  }

  if (
    ["fracture", "pneumonia", "acute", "akut", "hypertensive", "diabetes with", "chest pain"].some((keyword) =>
      combined.includes(keyword)
    )
  ) {
    return "HIGH" as const;
  }

  if (
    ["fever", "demam", "infection", "infeksi", "cough", "batuk", "pain", "headache", "gout"].some((keyword) =>
      combined.includes(keyword)
    )
  ) {
    return "MODERATE" as const;
  }

  return "LOW" as const;
}

function rankReference(reference: ClinicalIcdReference, searchText: string, searchTerms: SearchTerm[]) {
  const name = reference.icd_name.toLowerCase();
  const code = reference.icd_code.toLowerCase();
  const lower = normalizeText(searchText);
  let score = 0;

  searchTerms.forEach((term) => {
    const normalized = term.term.toLowerCase();
    if (term.codeHint && code.startsWith(term.codeHint.toLowerCase())) score += 10;
    if (code.startsWith(normalized)) score += 7;
    if (name.includes(normalized)) score += 5;
  });

  if (reference.source === "soap_keyword_icd") score += 4;
  if (reference.keyword && lower.includes(reference.keyword.toLowerCase())) score += 3;
  if (reference.priority !== null && reference.priority !== undefined) {
    score += Math.max(0, 6 - Math.min(reference.priority, 6));
  }

  return score;
}

export async function searchClinicalIcdReferences(text: string, limit: number = 5): Promise<ClinicalIcdReference[]> {
  const searchText = normalizeText(text);
  if (!searchText) return [];

  const searchTerms = buildSearchTerms(searchText);
  const references = new Map<string, ClinicalIcdReference>();

  const keywordResult = await hospitalQuery(
    `SELECT sk.keyword, sk.icd_code, sk.prioritas, d.code, d.name
     FROM public.soap_keyword_icd sk
     JOIN public.icd10_diagnoses d
       ON d.code = sk.icd_code
      AND d.is_active = true
     WHERE LOWER($1) LIKE '%' || LOWER(sk.keyword) || '%'
     ORDER BY sk.prioritas ASC, sk.keyword ASC
     LIMIT 20`,
    [searchText]
  );

  keywordResult.rows.forEach((row) => {
    const icd_code = String(row.code || row.icd_code || "-");
    const icd_name = String(row.name || "-");
    references.set(icd_code, {
      icd_code,
      icd_name,
      source: "soap_keyword_icd",
      keyword: typeof row.keyword === "string" ? row.keyword : null,
      priority: typeof row.prioritas === "number" ? row.prioritas : Number(row.prioritas ?? null),
      triageLevel: assignTriageLevel({
        icd_code,
        icd_name,
        keyword: typeof row.keyword === "string" ? row.keyword : null,
      }),
    });
  });

  for (const term of searchTerms) {
    const result = await hospitalQuery(
      `SELECT code, name
       FROM public.icd10_diagnoses
       WHERE is_active = true
         AND (
           code ILIKE $1
           OR name ILIKE $2
         )
       ORDER BY
         CASE
           WHEN code ILIKE $1 THEN 1
           WHEN name ILIKE $2 THEN 2
           ELSE 3
         END,
         code ASC
       LIMIT 10`,
      [`${term.term}%`, `%${term.term}%`]
    );

    result.rows.forEach((row) => {
      const icd_code = String(row.code || "-");
      if (references.has(icd_code)) return;

      const icd_name = String(row.name || "-");
      references.set(icd_code, {
        icd_code,
        icd_name,
        source: "icd10_diagnoses",
        keyword: null,
        priority: null,
        triageLevel: assignTriageLevel({ icd_code, icd_name }),
      });
    });
  }

  return [...references.values()]
    .sort((a, b) => rankReference(b, searchText, searchTerms) - rankReference(a, searchText, searchTerms))
    .slice(0, limit);
}
