import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { DIR, run } from "./seed";

interface Book {
  id: number;
  title: string;
  author: string;
  publisher: string;
  category: string;
  year: number;
  isbn?: string;
  price: number;
  status: "available" | "borrowed" | "lost";
  slot: number;
}
interface Reader {
  id: number;
  name: string;
  phone: string;
  cnic: string;
  createdAt: string;
}
interface Loan {
  id: number;
  bookId: number;
  title: string;
  readerId: number;
  readerName?: string;
  readerPhone?: string;
  issuedAt: string;
  dueAt: string;
  returnedAt?: string;
  status: "active" | "returned" | "lost";
  fee: number;
  fine: number;
  lostCharge: number;
}

const FEE = 100,
  DAYS = 15,
  LATE = 5,
  MAX_BOOKS = 3,
  DAY = 864e5,
  CAPACITY = 10000;

// ---------- storage: JSON files loaded into memory with indexes ----------
if (!fs.existsSync(path.join(DIR, "books.json"))) run();
const rd = <T>(f: string, d: T): T =>
  fs.existsSync(path.join(DIR, f))
    ? JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"))
    : d;
let books = rd<Book[]>("books.json", []);
let readers = rd<Reader[]>("readers.json", []);
let loans = rd<Loan[]>("loans.json", []);

const bookById = new Map(books.map((b) => [b.id, b]));
const readerById = new Map(readers.map((r) => [r.id, r]));
const activeByBook = new Map(
  loans.filter((l) => l.status === "active").map((l) => [l.bookId, l]),
);
const hayOf = (b: Book) =>
  `${b.title} ${b.author} ${b.isbn ?? ""}`.toLowerCase();
const hay = new Map(books.map((b) => [b.id, hayOf(b)]));
let nextBook = books.reduce((m, b) => Math.max(m, b.id), 0) + 1;
let nextReader = readers.reduce((m, r) => Math.max(m, r.id), 0) + 1;
let nextLoan = loans.reduce((m, l) => Math.max(m, l.id), 0) + 1;

let timer: NodeJS.Timeout | undefined;
const save = () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const files: [string, unknown][] = [
      ["books.json", books],
      ["readers.json", readers],
      ["loans.json", loans],
    ];
    for (const [f, d] of files)
      fs.writeFileSync(path.join(DIR, f), JSON.stringify(d));
  }, 200);
};

// ---------- helpers ----------
const loc = (slot: number) => {
  const r = slot % 500;
  return {
    section: Math.floor(slot / 5000) + 1,
    shelf: Math.floor((slot % 5000) / 500) + 1,
    row: Math.floor(r / 50) + 1,
    column: Math.floor((r % 50) / 10) + 1,
    position: (r % 10) + 1,
  };
};
const lateDays = (l: Loan) =>
  Math.max(0, Math.ceil((Date.now() - Date.parse(l.dueAt)) / DAY));
const loanView = (l: Loan) => {
  const late = l.status === "active" ? lateDays(l) : Math.round(l.fine / LATE);
  const fine = l.status === "active" ? late * LATE : l.fine;
  const rd = readerById.get(l.readerId);
  const outcome =
    l.status === "lost"
      ? "lost"
      : l.status === "active"
        ? late > 0
          ? "overdue"
          : "active"
        : late > 0
          ? "late"
          : "on_time";
  return {
    ...l,
    reader: rd?.name ?? l.readerName ?? "Deleted reader",
    phone: rd?.phone ?? l.readerPhone ?? "",
    lateDays: late,
    fine,
    outcome,
    total: l.fee + fine + l.lostCharge,
  };
};
const copyView = (b: Book) => {
  const l = activeByBook.get(b.id);
  return {
    id: b.id,
    status: b.status,
    loc: loc(b.slot),
    loan: l
      ? {
          dueAt: l.dueAt,
          reader: readerById.get(l.readerId)?.name ?? "",
          overdue: lateDays(l) > 0,
        }
      : undefined,
  };
};
const groupView = (list: Book[]) => {
  const f = list[0];
  return {
    title: f.title,
    author: f.author,
    publisher: f.publisher,
    category: f.category,
    year: f.year,
    isbn: f.isbn,
    price: f.price,
    available: list.filter((b) => b.status === "available").length,
    copies: list.map(copyView),
  };
};
const digits = (s: unknown) => String(s ?? "").replace(/[\s-]/g, "");
const bad = (res: express.Response, m: string, c = 400) =>
  res.status(c).json({ error: m });

function readerInput(
  b: any,
  selfId?: number,
): { e?: string; v?: { name: string; phone: string; cnic: string } } {
  const name = String(b.name || "").trim(),
    phone = digits(b.phone),
    cnic = digits(b.cnic);
  if (name.length < 2) return { e: "Enter the reader's full name." };
  if (!/^\d{11}$/.test(phone))
    return { e: "Phone number must be exactly 11 digits." };
  if (!/^\d{13}$/.test(cnic)) return { e: "CNIC must be exactly 13 digits." };
  if (readers.some((r) => r.cnic === cnic && r.id !== selfId))
    return { e: "A reader with this CNIC already exists." };
  return { v: { name, phone, cnic } };
}
function bookInput(b: any): {
  e?: string;
  v?: Omit<Book, "id" | "status" | "slot">;
} {
  const f = (k: string) => String(b[k] ?? "").trim();
  const year = Number(b.year),
    price = Number(b.price),
    isbn = digits(b.isbn);
  for (const k of ["title", "author", "publisher", "category"])
    if (!f(k)) return { e: `${k[0].toUpperCase() + k.slice(1)} is required.` };
  if (!Number.isInteger(year) || year < 1000 || year > new Date().getFullYear())
    return { e: "Enter a valid publication year." };
  if (!(price > 0)) return { e: "Price must be greater than 0." };
  if (isbn && !/^(\d{10}|\d{13})$/.test(isbn))
    return { e: "ISBN must be 10 or 13 digits, or left empty." };
  return {
    v: {
      title: f("title"),
      author: f("author"),
      publisher: f("publisher"),
      category: f("category"),
      year,
      price,
      isbn: isbn || undefined,
    },
  };
}

// ---------- routes ----------
const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/stats", (_q, res) => {
  const overdue = [...activeByBook.values()].filter(
    (l) => lateDays(l) > 0,
  ).length;
  res.json({
    total: books.length,
    available: books.filter((b) => b.status === "available").length,
    borrowed: activeByBook.size,
    lost: books.filter((b) => b.status === "lost").length,
    overdue,
    readers: readers.length,
    revenue: loans.reduce((s, l) => {
      const v = loanView(l);
      return s + l.fee + (l.status === "active" ? 0 : v.fine) + l.lostCharge;
    }, 0),
  });
});

// Books: search by title / author / ISBN (every word must match)
app.get("/api/books/search", (q, res) => {
  const terms = String(q.query.q || "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const cat = String(q.query.category || ""),
    onlyAvail = q.query.available === "1";
  const groups = new Map<string, Book[]>();
  for (const b of books) {
    const h = hay.get(b.id)!;
    if (cat && b.category !== cat) continue;
    if (!terms.every((t) => h.includes(t))) continue;
    const k = `${b.title}|${b.author}`;
    const g = groups.get(k);
    g ? g.push(b) : groups.set(k, [b]);
  }
  const all = [...groups.values()].filter(
    (g) => !onlyAvail || g.some((b) => b.status === "available"),
  );
  res.json({ total: all.length, results: all.slice(0, 40).map(groupView) });
});

app.post("/api/books", (req, res) => {
  const { e, v } = bookInput(req.body);
  if (!v) return bad(res, e!);
  const n = Number(req.body.copies ?? 1);
  if (!Number.isInteger(n) || n < 1 || n > 5)
    return bad(res, "Copies must be between 1 and 5.");
  const used = new Set(books.map((b) => b.slot));
  const free: number[] = [];
  for (let s = 0; s < CAPACITY && free.length < n; s++)
    if (!used.has(s)) free.push(s);
  if (free.length < n)
    return bad(res, "The shelves do not have enough free slots.", 409);
  for (const slot of free) {
    const b: Book = { id: nextBook++, ...v, status: "available", slot };
    books.push(b);
    bookById.set(b.id, b);
    hay.set(b.id, hayOf(b));
  }
  save();
  res.status(201).json({ added: n });
});

app.put("/api/books/:id", (req, res) => {
  const b = bookById.get(Number(req.params.id));
  if (!b) return bad(res, "Book not found.", 404);
  const { e, v } = bookInput(req.body);
  if (!v) return bad(res, e!);
  for (const c of books)
    if (c.title === b.title && c.author === b.author) {
      Object.assign(c, v);
      hay.set(c.id, hayOf(c));
    }
  save();
  res.json({ ok: true });
});

app.delete("/api/books/:id", (req, res) => {
  const b = bookById.get(Number(req.params.id));
  if (!b) return bad(res, "Book not found.", 404);
  if (b.status === "borrowed")
    return bad(res, "This copy is borrowed. Return it before deleting.", 409);
  books = books.filter((x) => x.id !== b.id);
  bookById.delete(b.id);
  hay.delete(b.id);
  save();
  res.json({ ok: true });
});

// Readers
app.get("/api/readers", (q, res) => {
  const s = String(q.query.q || "")
    .toLowerCase()
    .trim();
  const list = readers.filter(
    (r) =>
      !s ||
      r.name.toLowerCase().includes(s) ||
      r.phone.includes(s) ||
      r.cnic.includes(s),
  );
  res.json(list.slice(0, 100));
});
app.get("/api/readers/:id", (req, res) => {
  const reader = readerById.get(Number(req.params.id));
  if (!reader) return bad(res, "Reader not found.", 404);
  const history = loans
    .filter((l) => l.readerId === reader.id)
    .map(loanView)
    .reverse();
  res.json({
    reader,
    loans: history,
    totalSpent: history.reduce((s, l) => s + l.total, 0),
    active: history.filter((l) => l.status === "active").length,
  });
});
app.post("/api/readers", (req, res) => {
  const { e, v } = readerInput(req.body);
  if (!v) return bad(res, e!);
  const r: Reader = {
    id: nextReader++,
    ...v,
    createdAt: new Date().toISOString(),
  };
  readers.push(r);
  readerById.set(r.id, r);
  save();
  res.status(201).json(r);
});
app.put("/api/readers/:id", (req, res) => {
  const r = readerById.get(Number(req.params.id));
  if (!r) return bad(res, "Reader not found.", 404);
  const { e, v } = readerInput(req.body, r.id);
  if (!v) return bad(res, e!);
  Object.assign(r, v);
  save();
  res.json(r);
});
app.delete("/api/readers/:id", (req, res) => {
  const r = readerById.get(Number(req.params.id));
  if (!r) return bad(res, "Reader not found.", 404);
  if (loans.some((l) => l.readerId === r.id && l.status === "active"))
    return bad(res, "This reader still holds borrowed books.", 409);
  readers = readers.filter((x) => x.id !== r.id);
  readerById.delete(r.id);
  save();
  res.json({ ok: true });
});

// Loans
app.get("/api/loans", (q, res) => {
  const status = String(q.query.status || "active");
  let list = loans.map(loanView);
  if (status === "active") list = list.filter((l) => l.status === "active");
  else if (status === "overdue")
    list = list
      .filter((l) => l.status === "active" && l.lateDays > 0)
      .sort((a, b) => b.lateDays - a.lateDays);
  else list.reverse();
  res.json(list.slice(0, 200));
});

app.post("/api/loans/issue", (req, res) => {
  const reader = readerById.get(Number(req.body.readerId));
  const book = bookById.get(Number(req.body.bookId));
  if (!reader) return bad(res, "Choose a reader first.");
  if (!book) return bad(res, "Book not found.", 404);
  if (book.status !== "available")
    return bad(res, "This copy is not available.", 409);
  const mine = loans.filter(
    (l) => l.readerId === reader.id && l.status === "active",
  );
  if (mine.length >= MAX_BOOKS)
    return bad(
      res,
      `${reader.name} already holds ${MAX_BOOKS} books. A book must be returned first.`,
      409,
    );
  if (
    mine.some((l) => {
      const o = bookById.get(l.bookId);
      return o && o.title === book.title && o.author === book.author;
    })
  )
    return bad(res, "This reader already holds a copy of this title.", 409);
  const issued = new Date();
  const loan: Loan = {
    id: nextLoan++,
    bookId: book.id,
    title: book.title,
    readerId: reader.id,
    readerName: reader.name,
    readerPhone: reader.phone,
    issuedAt: issued.toISOString(),
    dueAt: new Date(issued.getTime() + DAYS * DAY).toISOString(),
    status: "active",
    fee: FEE,
    fine: 0,
    lostCharge: 0,
  };
  loans.push(loan);
  activeByBook.set(book.id, loan);
  book.status = "borrowed";
  save();
  res.status(201).json(loanView(loan));
});

app.post("/api/loans/:id/return", (req, res) => {
  const loan = loans.find((l) => l.id === Number(req.params.id));
  if (!loan || loan.status !== "active")
    return bad(res, "Active loan not found.", 404);
  loan.fine = lateDays(loan) * LATE;
  loan.status = "returned";
  loan.returnedAt = new Date().toISOString();
  activeByBook.delete(loan.bookId);
  const b = bookById.get(loan.bookId);
  if (b) b.status = "available";
  save();
  res.json(loanView(loan));
});

app.post("/api/loans/:id/lost", (req, res) => {
  const loan = loans.find((l) => l.id === Number(req.params.id));
  if (!loan || loan.status !== "active")
    return bad(res, "Active loan not found.", 404);
  const b = bookById.get(loan.bookId);
  loan.lostCharge = b?.price ?? 0;
  loan.status = "lost";
  loan.returnedAt = new Date().toISOString();
  activeByBook.delete(loan.bookId);
  if (b) b.status = "lost";
  save();
  res.json(loanView(loan));
});

app.get("/api/categories", (_q, res) => {
  const m = new Map<string, number>();
  for (const b of books) m.set(b.category, (m.get(b.category) || 0) + 1);
  res.json(
    [...m.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count })),
  );
});

// Full borrowing history of every reader (kept forever in loans.json)
app.get("/api/history", (q, res) => {
  const s = String(q.query.q || "")
      .toLowerCase()
      .trim(),
    f = String(q.query.filter || "all");
  const all = loans.map(loanView).reverse();
  const done = all.filter((l) => l.status !== "active");
  const summary = {
    borrowings: all.length,
    onTime: all.filter((l) => l.outcome === "on_time").length,
    late: all.filter((l) => l.outcome === "late").length,
    lost: all.filter((l) => l.outcome === "lost").length,
    fees: all.reduce((n, l) => n + l.fee, 0),
    fines: done.reduce((n, l) => n + l.fine + l.lostCharge, 0),
  };
  let list = all;
  if (f === "active") list = list.filter((l) => l.status === "active");
  else if (f !== "all") list = list.filter((l) => l.outcome === f);
  if (s)
    list = list.filter((l) =>
      `${l.reader} ${l.phone} ${l.title}`.toLowerCase().includes(s),
    );
  res.json({ total: list.length, summary, loans: list.slice(0, 200) });
});

app.listen(4000, () =>
  console.log("Library API running on http://localhost:4000"),
);
