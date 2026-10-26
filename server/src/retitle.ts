// Gives the 10,000 seeded books new unique names. Keeps ids, shelves, borrowed status and loans.
// Stop the server before running:  npm run retitle
import fs from "fs";
import path from "path";
import { DIR } from "./seed";
import { makeTitle } from "./titles";

const read = (f: string) =>
  JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
const books: any[] = read("books.json");
const loansFile = path.join(DIR, "loans.json");
const loans: any[] = fs.existsSync(loansFile) ? read("loans.json") : [];

let s = 7;
const r = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
const pick = <X>(a: X[]) => a[Math.floor(r() * a.length)];
const used = new Set<string>(
  books.filter((b) => b.id > 10000).map((b) => b.title),
); // keep books added by hand
const map = new Map<string, string>();

for (const b of books) {
  // pass 1: one new title per old title
  if (b.id > 10000) continue;
  const k = `${b.title}|${b.author}`;
  if (!map.has(k)) map.set(k, makeTitle(b.category, pick, used));
}
const byId = new Map<number, string>();
for (const b of books) {
  // pass 2: apply
  if (b.id > 10000) continue;
  b.title = map.get(`${b.title}|${b.author}`)!;
  byId.set(b.id, b.title);
}
for (const l of loans) {
  const t = byId.get(l.bookId);
  if (t) l.title = t;
}

fs.writeFileSync(path.join(DIR, "books.json"), JSON.stringify(books));
if (loans.length) fs.writeFileSync(loansFile, JSON.stringify(loans));
console.log(
  `Renamed ${map.size} titles. Start the server again with npm run dev.`,
);
