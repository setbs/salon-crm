import type { MeasurementUnit } from "../api";

export const adminMoney = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "UAH",
  maximumFractionDigits: 0
});

export const plainHryvnia = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0
});

const plainNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export function formatPlainNumber(value: number) {
  return plainNumber.format(value);
}

export function formatUnit(unit: MeasurementUnit | null | undefined) {
  return unit === "gram" ? "g" : "ml";
}
