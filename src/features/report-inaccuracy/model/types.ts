import type { InaccuracyReportReason } from "@/features/report-inaccuracy/model/contract";

export const inaccuracyReasonOptions = [
  { value: "wrong_datetime", label: "Неверная дата или время" },
  { value: "wrong_price", label: "Неверная цена" },
  { value: "cancelled", label: "Событие отменено" },
  { value: "wrong_address", label: "Неверный адрес" },
  { value: "outdated", label: "Информация устарела" },
  { value: "other", label: "Другое" }
] as const satisfies readonly { value: InaccuracyReportReason; label: string }[];

export type InaccuracyReportState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialInaccuracyReportState: InaccuracyReportState = {
  status: "idle",
  message: ""
};
