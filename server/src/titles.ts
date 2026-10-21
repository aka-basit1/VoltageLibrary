export type Pick = <X>(a: X[]) => X;
type Tpl = (p: Pick) => string;

const adj = ['Silent','Hidden','Golden','Broken','Eternal','Crimson','Lost','Ancient','Midnight','Forgotten','Burning','Distant','Hollow','Iron','Silver','Wild','Frozen','Secret','Rising','Fallen','Bright','Quiet','Endless','Sacred','Gentle','Lonely','Shattered','Scarlet','Wandering','Emerald'];
const noun = ['River','Mountain','Kingdom','Garden','Mirror','Empire','Shadow','Ocean','Journey','Whisper','Harvest','Bridge','Legacy','Desert','Compass','Fortress','Voyage','Horizon','Song','Throne','Valley','Lantern','Promise','Tower','Storm','Memory','Road','Flame','Dream','Letter'];
const place = ['Lahore','Multan','Bahawalpur','Karakoram','Samarkand','Cordoba','Istanbul','Kashgar','Venice','Delhi','Baghdad','Kyoto','Cairo','Lisbon','Prague','Damascus','Peshawar','Isfahan','Granada','Vienna','Tashkent','Zanzibar','Edinburgh','Moscow','Athens','Kabul','Karachi','Quetta','Sialkot','Hunza'];
const first = ['Ahmed','Sara','Bilal','Ayesha','Omar','Hina','Zain','Fatima','Hamza','Noor','Usman','Maryam','Ali','Iqra','Daniel','Emma','Liam','Sofia','Hassan','Laila'];
const last = ['Khan','Malik','Raza','Sheikh','Qureshi','Butt','Siddiqui','Chaudhry','Hussain','Baig','Smith','Taylor','Brown','Walker','Hall','Young'];
const animal = ['Fox','Owl','Bear','Rabbit','Turtle','Sparrow','Lion','Camel','Peacock','Hedgehog','Elephant','Dolphin','Squirrel','Crow','Deer','Parrot','Tiger','Falcon','Mouse','Duck'];
const thing = ['Magic Key','Red Balloon','Secret Door','Lost Kite','Little Boat','Golden Apple','Silver Bell','Hidden Cave','Tiny Star','Old Clock','Paper Moon','Wooden Horse','Rainy Day','Moonlit Garden','Candy Mountain','Singing Tree','Giant Pumpkin','Missing Map','Winter Picnic','Bouncing Drum'];
const science = ['Quantum Physics','Organic Chemistry','Marine Biology','Astronomy','Genetics','Ecology','Geology','Thermodynamics','Neuroscience','Climate Science','Botany','Zoology','Optics','Mechanics','Microbiology','Astrophysics','Biochemistry','Oceanography','Meteorology','Anatomy','Nutrition','Robotics','Evolution','Electromagnetism','Cell Biology','Materials Science','Particle Physics','Immunology','Soil Science','Hydrology'];
const tech = ['JavaScript','Python','React','TypeScript','Databases','Cloud Computing','Networking','Cybersecurity','Machine Learning','Data Structures','Algorithms','Operating Systems','Web Design','Mobile Apps','DevOps','Embedded Systems','Compilers','Computer Graphics','Linux','SQL','Node.js','Git','APIs','Software Testing','Blockchain','Big Data','Game Development','Computer Vision','Microservices','Digital Logic'];
const biz = ['Leadership','Marketing','Strategy','Negotiation','Startups','Accounting','Finance','Management','Branding','Sales','Innovation','Economics','Entrepreneurship','Investing','Productivity','Teamwork','Supply Chains','Customer Service','Pricing','Operations','Trade','Banking','Retail','Logistics'];
const concept = ['Freedom','Justice','Virtue','Truth','Beauty','Time','Mind','Reason','Happiness','Power','Duty','Knowledge','Memory','Faith','Doubt','Love','Fear','Wisdom','Change','Identity','Language','Nature','Silence','Hope','Fate','Desire','Honor','Courage','Solitude','Meaning'];
const aud = ['Beginners','Students','Engineers','Everyone','Curious Minds','Teachers','Professionals','Managers','Self-Learners','Researchers','Families','Entrepreneurs','Young Readers','Practitioners'];
const suf = ['A Hands-On Guide','From Basics to Advanced','Patterns and Pitfalls','In Depth','Step by Step','Projects and Exercises','The Complete Reference','A Practical Approach','Core Concepts','Lessons from the Field','Questions and Answers','A Visual Guide'];

const study = (xs: string[]): Tpl[] => [
  p => `Introduction to ${p(xs)}`,
  p => `Principles of ${p(xs)}`,
  p => `Mastering ${p(xs)}`,
  p => `${p(xs)} for ${p(aud)}`,
  p => `${p(xs)}: ${p(suf)}`,
];

const T: Record<string, Tpl[]> = {
  Fiction: [p => `The ${p(adj)} ${p(noun)}`, p => `${p(noun)} of ${p(place)}`, p => `The ${p(noun)} and the ${p(thing)}`, p => `${p(first)} and the ${p(adj)} ${p(noun)}`],
  History: [p => `The Fall of ${p(place)}`, p => `${p(place)} Through the Ages`, p => `${p(adj)} Empires of ${p(place)}`, p => `The ${p(adj)} Years: ${p(place)}`],
  Science: study(science),
  Technology: study(tech),
  Business: study(biz),
  Poetry: [p => `Verses of ${p(noun)}`, p => `${p(adj)} ${p(noun)}: Collected Poems`, p => `Ghazals of ${p(place)}`, p => `Songs of the ${p(adj)} ${p(noun)}`],
  Biography: [p => `The Life of ${p(first)} ${p(last)}`, p => `${p(first)} ${p(last)}: A Biography`, p => `Remembering ${p(first)} ${p(last)}`],
  Religion: [p => `Reflections on ${p(concept)}`, p => `The ${p(adj)} Path`, p => `${p(adj)} Lessons on ${p(concept)}`],
  Philosophy: [p => `On ${p(concept)}`, p => `The Problem of ${p(concept)}`, p => `${p(concept)} and the ${p(noun)}`, p => `${p(concept)} and ${p(concept)}`],
  Children: [p => `The ${p(animal)} and the ${p(thing)}`, p => `${p(animal)}'s ${p(adj)} Adventure`, p => `${p(first)} and the ${p(animal)}`],
};

/** Returns a book title that matches the category and is never used twice. */
export function makeTitle(cat: string, pick: Pick, used: Set<string>): string {
  const tpls = T[cat] ?? T.Fiction;
  let t = '';
  for (let k = 0; k < 40; k++) {
    t = pick(tpls)(pick);
    if (!used.has(t)) { used.add(t); return t; }
  }
  for (let n = 2; ; n++) { const u = `${t}, Edition ${n}`; if (!used.has(u)) { used.add(u); return u; } }
}
