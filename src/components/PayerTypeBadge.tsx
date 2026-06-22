import { registrationTypeBadgeClass, registrationTypeLabel, registrationTypeShort, type RegistrationType } from "@/lib/registration-type";

type PayerTypeBadgeProps = {
  type: RegistrationType | string | null | undefined;
  compact?: boolean;
  className?: string;
};

export function PayerTypeBadge({ type, compact = false, className = "" }: PayerTypeBadgeProps) {
  const label = compact ? registrationTypeShort(type) : registrationTypeLabel(type);
  const base = "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]";
  return <span className={`${base} ${registrationTypeBadgeClass(type)} ${className}`.trim()}>{label}</span>;
}
