export const inaccuracyReasonOptions = [
  { value: "wrong_time", label: "Неверная дата или время" },
  { value: "wrong_price", label: "Неверная цена" },
  { value: "cancelled", label: "Событие отменено" },
  { value: "wrong_address", label: "Неверный адрес" },
  { value: "outdated", label: "Информация устарела" },
  { value: "other", label: "Другое" }
] as const;

export type InaccuracyReportState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialInaccuracyReportState: InaccuracyReportState = {
  status: "idle",
  message: ""
};
