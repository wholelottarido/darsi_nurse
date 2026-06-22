export type RegistrationType = "jkn" | "umum" | "swasta";

export function registrationTypeLabel(type: RegistrationType | string | null | undefined): string {
  if (type === "jkn") return "BPJS (JKN)";
  if (type === "swasta") return "Swasta / Asuransi";
  return "Umum";
}

export function registrationTypeShort(type: RegistrationType | string | null | undefined): string {
  if (type === "jkn") return "BPJS";
  if (type === "swasta") return "Swasta";
  return "Umum";
}

export function registrationTypeBadgeClass(type: RegistrationType | string | null | undefined): string {
  if (type === "jkn") return "bg-sky-100 text-sky-800 border-sky-200";
  if (type === "swasta") return "bg-violet-100 text-violet-800 border-violet-200";
  return "bg-amber-100 text-amber-900 border-amber-200";
}
