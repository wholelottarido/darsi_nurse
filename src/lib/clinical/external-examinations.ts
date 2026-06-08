export function buildExternalExaminationPriorityOrder(alias: string) {
  return `
    CASE
      WHEN COALESCE(
        NULLIF(BTRIM(${alias}.soap_subjective), ''),
        NULLIF(BTRIM(${alias}.soap_objective), ''),
        NULLIF(BTRIM(${alias}.soap_assessment), ''),
        NULLIF(BTRIM(${alias}.soap_plan), ''),
        NULLIF(BTRIM(${alias}.examination_notes), '')
      ) IS NOT NULL THEN 0
      WHEN LOWER(COALESCE(${alias}.status, '')) = 'examined' THEN 1
      ELSE 2
    END,
    COALESCE(${alias}.updated_at, ${alias}.created_at) DESC,
    ${alias}.id DESC
  `;
}

export function hasMeaningfulDoctorSoap(exam: {
  soap_subjective?: string | null;
  soap_objective?: string | null;
  soap_assessment?: string | null;
  soap_plan?: string | null;
  examination_notes?: string | null;
} | null | undefined) {
  return [
    exam?.soap_subjective,
    exam?.soap_objective,
    exam?.soap_assessment,
    exam?.soap_plan,
    exam?.examination_notes,
  ].some((value) => typeof value === "string" && value.trim().length > 0);
}
