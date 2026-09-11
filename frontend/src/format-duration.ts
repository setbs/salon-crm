export function formatDuration(minutes: number, language: "uk" | "en" = "uk") {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  const parts: string[] = [];
  if (hours) parts.push(`${hours} ${language === "uk" ? "год" : "h"}`);
  if (remainder || !hours) parts.push(`${remainder} ${language === "uk" ? "хв" : "min"}`);
  return parts.join(" ");
}
