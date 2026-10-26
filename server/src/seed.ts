import fs from "fs";
import path from "path";
import { makeTitle } from "./titles";

export const DIR = path.join(__dirname, "../data");

const A = [
  "Silent",
  "Hidden",
  "Golden",
  "Broken",
  "Eternal",
  "Crimson",
  "Lost",
  "Ancient",
  "Midnight",
  "Forgotten",
  "Burning",
  "Distant",
  "Hollow",
  "Iron",
  "Silver",
  "Wild",
  "Frozen",
  "Secret",
  "Rising",
  "Fallen",
  "Bright",
  "Dark",
  "Quiet",
  "Endless",
  "Sacred",
  "Stormy",
  "Gentle",
  "Royal",
  "Lonely",
  "Shattered",
];
const N = [
  "River",
  "Mountain",
  "Kingdom",
  "Garden",
  "Mirror",
  "Empire",
  "Shadow",
  "Ocean",
  "Journey",
  "Whisper",
  "Harvest",
  "Bridge",
  "Legacy",
  "Desert",
  "Compass",
  "Library",
  "Fortress",
  "Voyage",
  "Horizon",
  "Song",
  "Throne",
  "Valley",
  "Lantern",
  "Promise",
  "Tower",
  "Storm",
  "Memory",
  "Road",
  "Flame",
  "Dream",
];
const P = [
  "Lahore",
  "the North",
  "Tomorrow",
  "the Sea",
  "Our Time",
  "the Stars",
  "Dawn",
  "the Past",
  "Silence",
  "the Wind",
  "Home",
  "Strangers",
];
const F = [
  "Ahmed",
  "Sara",
  "Bilal",
  "Ayesha",
  "Omar",
  "Hina",
  "Zain",
  "Fatima",
  "Hamza",
  "Noor",
  "Usman",
  "Maryam",
  "Ali",
  "Iqra",
  "Daniel",
  "Emma",
  "Liam",
  "Sofia",
  "Hassan",
  "Laila",
];
const L = [
  "Khan",
  "Malik",
  "Raza",
  "Sheikh",
  "Qureshi",
  "Butt",
  "Siddiqui",
  "Chaudhry",
  "Hussain",
  "Baig",
  "Smith",
  "Taylor",
  "Brown",
  "Walker",
  "Hall",
  "Young",
];
const PUB = [
  "Oxford Press",
  "Sang-e-Meel",
  "Penguin House",
  "Ferozsons",
  "Vintage Books",
  "Lahore Academic",
  "Harper Lane",
  "Orbit Publishing",
];
const CAT = [
  "Fiction",
  "History",
  "Science",
  "Poetry",
  "Biography",
  "Technology",
  "Religion",
  "Philosophy",
  "Children",
  "Business",
];

export function run() {
  let s = 42;
  const r = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  const pick = <T>(a: T[]) => a[Math.floor(r() * a.length)];
  const books: object[] = [];
  const used = new Set<string>();
  let i = 0;
  while (books.length < 10000) {
    const category = pick(CAT);
    const title = makeTitle(category, pick, used);
    const base = {
      title,
      author: `${pick(F)} ${pick(L)}`,
      publisher: pick(PUB),
      category,
      year: 1950 + Math.floor(r() * 75),
      price: 300 + Math.floor(r() * 54) * 50,
      ...(i % 5 < 3 ? { isbn: `978${1000000000 + i * 7919}` } : {}),
    };
    const copies = i < 300 ? 5 : i < 1000 ? 2 : 1; // famous titles have 5 copies
    for (let c = 0; c < copies && books.length < 10000; c++)
      books.push({
        id: books.length + 1,
        ...base,
        status: "available",
        slot: books.length,
      });
    i++;
  }
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, "books.json"), JSON.stringify(books));
  console.log(`Seeded ${books.length} book copies (${i} titles).`);
}

if (require.main === module) run();
