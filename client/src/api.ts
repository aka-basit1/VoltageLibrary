export interface Loc {
  section: number;
  shelf: number;
  row: number;
  column: number;
  position: number;
}
export interface Copy {
  id: number;
  status: "available" | "borrowed" | "lost";
  loc: Loc;
  loan?: { dueAt: string; reader: string; overdue: boolean };
}
export interface Group {
  title: string;
  author: string;
  publisher: string;
  category: string;
  year: number;
  isbn?: string;
  price: number;
  available: number;
  copies: Copy[];
}
export interface Reader {
  id: number;
  name: string;
  phone: string;
  cnic: string;
}
export interface LoanV {
  id: number;
  bookId: number;
  title: string;
  readerId: number;
  reader: string;
  phone: string;
  outcome: "on_time" | "late" | "lost" | "overdue" | "active";
  issuedAt: string;
  dueAt: string;
  returnedAt?: string;
  status: "active" | "returned" | "lost";
  fee: number;
  lateDays: number;
  fine: number;
  lostCharge: number;
  total: number;
}
export interface Stats {
  total: number;
  available: number;
  borrowed: number;
  lost: number;
  overdue: number;
  readers: number;
  revenue: number;
}

export async function api<T>(
  url: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(data.error || "Something went wrong. Try again.");
  return data as T;
}
export interface HistoryData {
  total: number;
  summary: {
    borrowings: number;
    onTime: number;
    late: number;
    lost: number;
    fees: number;
    fines: number;
  };
  loans: LoanV[];
}
