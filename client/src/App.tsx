import { useCallback, useEffect, useState, ReactNode, CSSProperties } from 'react';
import { api, Copy, Group, HistoryData, LoanV, Loc, Reader, Stats } from './api';

type Notify = (m: string, bad?: boolean) => void;
const fmt = (s: string) => new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const locText = (l: Loc) => `Section ${l.section}, Shelf ${l.shelf}, Row ${l.row}, Column ${l.column}, Position ${l.position}`;

function useDebounced<T>(v: T, ms = 250) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}
function useCount(n: number) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let f = 0; const s = performance.now();
    const tick = (t: number) => { const p = Math.min(1, (t - s) / 800); setV(Math.round(n * p)); if (p < 1) f = requestAnimationFrame(tick); };
    f = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(f);
  }, [n]);
  return v;
}
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="mh"><h3>{title}</h3><button className="x" onClick={onClose} aria-label="Close">×</button></div>
        {children}
      </div>
    </div>
  );
}
function Field({ label, value, onChange, type = 'text', ...rest }: { label: string; value: string | number; onChange: (v: string) => void; type?: string; placeholder?: string; maxLength?: number }) {
  return <label className="field"><span>{label}</span><input type={type} value={value} onChange={e => onChange(e.target.value)} {...rest} /></label>;
}
const Stat = ({ label, value, money, i }: { label: string; value: number; money?: boolean; i: number }) => {
  const v = useCount(value);
  return <div className="stat" style={{ animationDelay: `${i * 90}ms` }}><b>{v.toLocaleString()}{money ? ' PKR' : ''}</b><span>{label}</span></div>;
};

/* ---------------- Dashboard ---------------- */
function Dashboard() {
  const [s, setS] = useState<Stats | null>(null);
  const [od, setOd] = useState<LoanV[]>([]);
  useEffect(() => { api<Stats>('/api/stats').then(setS); api<LoanV[]>('/api/loans?status=overdue').then(setOd); }, []);
  if (!s) return <p className="empty">Loading dashboard…</p>;
  const items: [string, number, boolean?][] = [['Total books', s.total], ['Available', s.available], ['Borrowed', s.borrowed], ['Lost', s.lost], ['Overdue', s.overdue], ['Readers', s.readers], ['Revenue collected', s.revenue, true]];
  return (
    <>
      <div className="stats">{items.map(([l, v, m], i) => <Stat key={l} label={l} value={v} money={m} i={i} />)}</div>
      <h2>Overdue books</h2>
      {od.length === 0 ? <p className="empty">No overdue books. Everything is on time.</p> :
        od.slice(0, 8).map(l => (
          <div className="row" key={l.id}><div><b>{l.title}</b><small>{l.reader}, due {fmt(l.dueAt)}</small></div><span className="chip bad">{l.lateDays} days late, {l.fine} PKR fine</span></div>
        ))}
    </>
  );
}

/* ---------------- Books ---------------- */
const blank = { title: '', author: '', publisher: '', category: '', year: '', isbn: '', price: '', copies: '1' };

function BookForm({ group, onDone, notify }: { group: Group | null; onDone: () => void; notify: Notify }) {
  const [f, setF] = useState(group ? { ...blank, title: group.title, author: group.author, publisher: group.publisher, category: group.category, year: String(group.year), isbn: group.isbn ?? '', price: String(group.price) } : blank);
  const set = (k: keyof typeof blank) => (v: string) => setF({ ...f, [k]: v });
  const save = async () => {
    try {
      if (group) await api(`/api/books/${group.copies[0].id}`, 'PUT', f); else await api('/api/books', 'POST', f);
      notify(group ? 'Book updated.' : 'Book added to the shelves.'); onDone();
    } catch (e) { notify((e as Error).message, true); }
  };
  return (
    <Modal title={group ? 'Edit book' : 'Add book'} onClose={onDone}>
      <div className="grid2">
        <Field label="Title" value={f.title} onChange={set('title')} />
        <Field label="Author" value={f.author} onChange={set('author')} />
        <Field label="Publisher" value={f.publisher} onChange={set('publisher')} />
        <Field label="Category" value={f.category} onChange={set('category')} />
        <Field label="Year" type="number" value={f.year} onChange={set('year')} />
        <Field label="Price (PKR)" type="number" value={f.price} onChange={set('price')} />
        <Field label="ISBN (optional)" value={f.isbn} onChange={set('isbn')} />
        {!group && <Field label="Copies (1 to 5)" type="number" value={f.copies} onChange={set('copies')} />}
      </div>
      <button className="btn" onClick={save}>{group ? 'Save changes' : 'Add book'}</button>
    </Modal>
  );
}

function IssueModal({ copy, title, onDone, notify }: { copy: Copy; title: string; onDone: () => void; notify: Notify }) {
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [list, setList] = useState<Reader[]>([]);
  const [f, setF] = useState({ name: '', phone: '', cnic: '' });
  useEffect(() => { api<Reader[]>(`/api/readers?q=${encodeURIComponent(dq)}`).then(setList); }, [dq]);
  const issue = async (r: Reader) => {
    try { const l = await api<LoanV>('/api/loans/issue', 'POST', { readerId: r.id, bookId: copy.id }); notify(`Issued to ${r.name}. Fee 100 PKR, due ${fmt(l.dueAt)}.`); onDone(); }
    catch (e) { notify((e as Error).message, true); }
  };
  const addAndIssue = async () => {
    try { const r = await api<Reader>('/api/readers', 'POST', f); await issue(r); }
    catch (e) { notify((e as Error).message, true); }
  };
  return (
    <Modal title={`Issue "${title}"`} onClose={onDone}>
      <div className="tabs">
        <button className={!adding ? 'on' : ''} onClick={() => setAdding(false)}>Choose reader</button>
        <button className={adding ? 'on' : ''} onClick={() => setAdding(true)}>Add new reader</button>
      </div>
      {adding ? (
        <>
          <Field label="Full name" value={f.name} onChange={v => setF({ ...f, name: v })} />
          <Field label="Phone (11 digits)" value={f.phone} maxLength={11} placeholder="03001234567" onChange={v => setF({ ...f, phone: v.replace(/\D/g, '') })} />
          <Field label="CNIC (13 digits)" value={f.cnic} maxLength={13} placeholder="3120112345671" onChange={v => setF({ ...f, cnic: v.replace(/\D/g, '') })} />
          <button className="btn" onClick={addAndIssue}>Add reader and issue book</button>
        </>
      ) : (
        <>
          <input className="search" autoFocus placeholder="Find reader by name, phone or CNIC" value={q} onChange={e => setQ(e.target.value)} />
          <div className="scroll">{list.length === 0 ? <p className="empty">No reader found. Choose Add new reader to register them now.</p> :
            list.map(r => <button className="row pick" key={r.id} onClick={() => issue(r)}><div><b>{r.name}</b><small>{r.phone}, CNIC {r.cnic}</small></div><span className="chip ok">Issue</span></button>)}</div>
        </>
      )}
    </Modal>
  );
}

function Cover({ title, cat }: { title: string; cat: string }) {
  const h = 180 + ([...cat].reduce((a, c) => a + c.charCodeAt(0), 0) % 80);
  return <div className="cover" style={{ '--h': h } as CSSProperties}><b>{title}</b><i>{cat}</i></div>;
}

function Books({ notify }: { notify: Notify }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [avail, setAvail] = useState(false);
  const [cats, setCats] = useState<{ name: string; count: number }[]>([]);
  const dq = useDebounced(q);
  const [data, setData] = useState<{ total: number; results: Group[] }>({ total: 0, results: [] });
  const [form, setForm] = useState<Group | null | 'new'>(null);
  const [issue, setIssue] = useState<{ copy: Copy; title: string } | null>(null);
  const load = useCallback(() => { api<{ total: number; results: Group[] }>(`/api/books/search?q=${encodeURIComponent(dq)}&category=${encodeURIComponent(cat)}&available=${avail ? 1 : 0}`).then(setData); }, [dq, cat, avail]);
  const loadCats = () => { api<{ name: string; count: number }[]>('/api/categories').then(setCats); };
  useEffect(load, [load]);
  useEffect(loadCats, []);
  const del = async (c: Copy) => {
    if (!confirm('Delete this copy permanently?')) return;
    try { await api(`/api/books/${c.id}`, 'DELETE'); notify('Copy deleted.'); load(); } catch (e) { notify((e as Error).message, true); }
  };
  const lost = async (c: Copy) => {
    const loan = (await api<LoanV[]>('/api/loans?status=active')).find(l => l.bookId === c.id);
    if (loan) { await markLost(loan, notify); load(); }
  };
  return (
    <>
      <div className="bar">
        <input className="search" placeholder="Search by title, author or ISBN" value={q} onChange={e => setQ(e.target.value)} />
        <button className="btn" onClick={() => setForm('new')}>Add book</button>
      </div>
      <div className="tabs filters">
        <button className={cat === '' ? 'on' : ''} onClick={() => setCat('')}>All categories</button>
        {cats.map(c => <button key={c.name} className={cat === c.name ? 'on' : ''} onClick={() => setCat(c.name)}>{c.name} ({c.count.toLocaleString()})</button>)}
      </div>
      <div className="tabs"><button className={avail ? 'on' : ''} onClick={() => setAvail(!avail)}>Available now only</button></div>
      <p className="muted">{data.total.toLocaleString()} titles found{data.total > 40 ? ', showing the first 40' : ''}</p>
      {data.results.length === 0 && <p className="empty">No book matches. Check the spelling, try the author name, or clear the filters.</p>}
      {data.results.map((g, i) => (
        <article className="card book" key={g.title + g.author} style={{ animationDelay: `${Math.min(i, 10) * 45}ms` }}>
          <Cover title={g.title} cat={g.category} />
          <div className="info">
            <header>
              <div><h3>{g.title}</h3><p>by {g.author}</p></div>
              <span className={`chip ${g.available ? 'ok' : 'bad'}`}>{g.available} of {g.copies.length} available</span>
            </header>
            <p className="muted">{g.publisher}, {g.category}, {g.year}{g.isbn ? `, ISBN ${g.isbn}` : ''}, {g.price} PKR</p>
            <ul className="copies">
              {g.copies.map(c => (
                <li key={c.id}>
                  <span className={`chip ${c.status}`}>{c.status}</span>
                  <div><span>{locText(c.loc)}</span>{c.loan && <small className={c.loan.overdue ? 'late' : ''}>Borrowed by {c.loan.reader}, due {fmt(c.loan.dueAt)}</small>}</div>
                  <div className="acts">
                    {c.status === 'available' && <button className="mini" onClick={() => setIssue({ copy: c, title: g.title })}>Issue</button>}
                    {c.status === 'borrowed' && <button className="mini warn" onClick={() => lost(c)}>Mark lost</button>}
                    {c.status !== 'borrowed' && <button className="mini warn" onClick={() => del(c)}>Delete</button>}
                  </div>
                </li>
              ))}
            </ul>
            <button className="mini" onClick={() => setForm(g)}>Edit details</button>
          </div>
        </article>
      ))}
      {form && <BookForm group={form === 'new' ? null : form} notify={notify} onDone={() => { setForm(null); load(); loadCats(); }} />}
      {issue && <IssueModal {...issue} notify={notify} onDone={() => { setIssue(null); load(); }} />}
    </>
  );
}

function History() {
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [f, setF] = useState('all');
  const [d, setD] = useState<HistoryData | null>(null);
  useEffect(() => { api<HistoryData>(`/api/history?q=${encodeURIComponent(dq)}&filter=${f}`).then(setD); }, [dq, f]);
  const chip = (l: LoanV): [string, string] => {
    switch (l.outcome) {
      case 'on_time': return ['ok', 'Returned on time'];
      case 'late': return ['borrowed', `Returned ${l.lateDays} days late`];
      case 'lost': return ['lost', 'Lost'];
      case 'overdue': return ['bad', `${l.lateDays} days overdue`];
      default: return ['', 'Borrowed now'];
    }
  };
  const tabs: [string, string][] = [['all', 'All'], ['active', 'Borrowed now'], ['on_time', 'Returned on time'], ['late', 'Returned late'], ['lost', 'Lost']];
  const s = d?.summary;
  return (
    <>
      {s && <div className="stats">{([['Total borrowings', s.borrowings], ['Returned on time', s.onTime], ['Returned late', s.late], ['Lost books', s.lost], ['Borrow fees', s.fees, true], ['Fines and lost charges', s.fines, true]] as [string, number, boolean?][]).map(([l, v, m], i) => <Stat key={l} label={l} value={v} money={m} i={i} />)}</div>}
      <h2>Borrowing history</h2>
      <input className="search" placeholder="Search by reader name, phone or book title" value={q} onChange={e => setQ(e.target.value)} />
      <div className="tabs" style={{ marginTop: 12 }}>{tabs.map(([k, l]) => <button key={k} className={f === k ? 'on' : ''} onClick={() => setF(k)}>{l}</button>)}</div>
      {d && d.loans.length === 0 && <p className="empty">No records yet. Every issue, return and fine will be saved here.</p>}
      {d?.loans.map((l, i) => {
        const [cls, label] = chip(l);
        return (
          <div className="row" key={l.id} style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}>
            <div>
              <b>{l.title}</b>
              <small>{l.reader}{l.phone ? `, ${l.phone}` : ''}</small>
              <small>Borrowed {fmt(l.issuedAt)}, due {fmt(l.dueAt)}{l.returnedAt ? `, ${l.status === 'lost' ? 'reported lost' : 'returned'} ${fmt(l.returnedAt)}` : ''}</small>
            </div>
            <div className="acts end">
              <span className={`chip ${cls}`}>{label}</span>
              <small>Fee {l.fee}{l.fine ? ` + fine ${l.fine}` : ''}{l.lostCharge ? ` + lost book ${l.lostCharge}` : ''} = <b>{l.total} PKR</b></small>
            </div>
          </div>
        );
      })}
    </>
  );
}

async function markLost(l: LoanV, notify: Notify) {
  if (!confirm(`Mark "${l.title}" as lost? ${l.reader} will be charged the book's price.`)) return;
  try { const r = await api<LoanV>(`/api/loans/${l.id}/lost`, 'POST'); notify(`Marked lost. ${r.lostCharge} PKR charged to ${r.reader}.`); } catch (e) { notify((e as Error).message, true); }
}

/* ---------------- Readers ---------------- */
function Readers({ notify }: { notify: Notify }) {
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [list, setList] = useState<Reader[]>([]);
  const [form, setForm] = useState<Reader | 'new' | null>(null);
  const [hist, setHist] = useState<{ reader: Reader; loans: LoanV[]; totalSpent: number; active: number } | null>(null);
  const load = useCallback(() => { api<Reader[]>(`/api/readers?q=${encodeURIComponent(dq)}`).then(setList); }, [dq]);
  useEffect(load, [load]);
  const del = async (r: Reader) => {
    if (!confirm(`Delete ${r.name}?`)) return;
    try { await api(`/api/readers/${r.id}`, 'DELETE'); notify('Reader deleted.'); load(); } catch (e) { notify((e as Error).message, true); }
  };
  return (
    <>
      <div className="bar">
        <input className="search" placeholder="Search by name, phone or CNIC" value={q} onChange={e => setQ(e.target.value)} />
        <button className="btn" onClick={() => setForm('new')}>Add reader</button>
      </div>
      {list.length === 0 && <p className="empty">No readers yet. Add the first reader to start issuing books.</p>}
      {list.map((r, i) => (
        <div className="row" key={r.id} style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
          <div><b>{r.name}</b><small>Phone {r.phone}, CNIC {r.cnic}</small></div>
          <div className="acts">
            <button className="mini" onClick={async () => setHist(await api(`/api/readers/${r.id}`))}>History</button>
            <button className="mini" onClick={() => setForm(r)}>Edit</button>
            <button className="mini warn" onClick={() => del(r)}>Delete</button>
          </div>
        </div>
      ))}
      {form && <ReaderForm reader={form === 'new' ? null : form} notify={notify} onDone={() => { setForm(null); load(); }} />}
      {hist && (
        <Modal title={hist.reader.name} onClose={() => setHist(null)}>
          <div className="stats small"><div className="stat"><b>{hist.totalSpent} PKR</b><span>Total expenses</span></div><div className="stat"><b>{hist.active} of 3</b><span>Books held now</span></div></div>
          <div className="scroll">{hist.loans.length === 0 ? <p className="empty">This reader has not borrowed any books yet.</p> : hist.loans.map(l => (
            <div className="row" key={l.id}><div><b>{l.title}</b><small>Borrowed {fmt(l.issuedAt)}, due {fmt(l.dueAt)}{l.returnedAt ? `, ${l.status === 'lost' ? 'lost' : 'returned'} ${fmt(l.returnedAt)}` : ''}</small></div><span className={`chip ${l.status === 'active' ? 'borrowed' : l.status === 'lost' ? 'lost' : 'ok'}`}>{l.total} PKR</span></div>
          ))}</div>
        </Modal>
      )}
    </>
  );
}
function ReaderForm({ reader, onDone, notify }: { reader: Reader | null; onDone: () => void; notify: Notify }) {
  const [f, setF] = useState({ name: reader?.name ?? '', phone: reader?.phone ?? '', cnic: reader?.cnic ?? '' });
  const save = async () => {
    try { await api(reader ? `/api/readers/${reader.id}` : '/api/readers', reader ? 'PUT' : 'POST', f); notify(reader ? 'Reader updated.' : 'Reader added.'); onDone(); }
    catch (e) { notify((e as Error).message, true); }
  };
  return (
    <Modal title={reader ? 'Edit reader' : 'Add reader'} onClose={onDone}>
      <Field label="Full name" value={f.name} onChange={v => setF({ ...f, name: v })} />
      <Field label="Phone (11 digits)" value={f.phone} maxLength={11} placeholder="03001234567" onChange={v => setF({ ...f, phone: v.replace(/\D/g, '') })} />
      <Field label="CNIC (13 digits)" value={f.cnic} maxLength={13} placeholder="3120112345671" onChange={v => setF({ ...f, cnic: v.replace(/\D/g, '') })} />
      <button className="btn" onClick={save}>{reader ? 'Save changes' : 'Add reader'}</button>
    </Modal>
  );
}

/* ---------------- Loans ---------------- */
function Loans({ notify }: { notify: Notify }) {
  const [tab, setTab] = useState<'active' | 'overdue' | 'all'>('active');
  const [list, setList] = useState<LoanV[]>([]);
  const load = useCallback(() => { api<LoanV[]>(`/api/loans?status=${tab}`).then(setList); }, [tab]);
  useEffect(load, [load]);
  const ret = async (l: LoanV) => {
    try { const r = await api<LoanV>(`/api/loans/${l.id}/return`, 'POST'); notify(`Returned. Total charged: ${r.fee + r.fine} PKR${r.fine ? ` (includes ${r.fine} PKR late fine)` : ''}.`); load(); }
    catch (e) { notify((e as Error).message, true); }
  };
  return (
    <>
      <div className="tabs">{(['active', 'overdue', 'all'] as const).map(t => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t === 'active' ? 'Borrowed now' : t === 'overdue' ? 'Overdue' : 'All history'}</button>)}</div>
      {list.length === 0 && <p className="empty">{tab === 'overdue' ? 'No overdue books.' : 'Nothing here yet. Issue a book from the Books page.'}</p>}
      {list.map((l, i) => (
        <div className="row" key={l.id} style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}>
          <div><b>{l.title}</b><small>{l.reader}, borrowed {fmt(l.issuedAt)}, due {fmt(l.dueAt)}</small></div>
          <div className="acts">
            {l.status === 'active'
              ? <><span className={`chip ${l.lateDays ? 'bad' : 'borrowed'}`}>{l.lateDays ? `${l.lateDays} days late, ${l.fine} PKR fine` : 'On time'}</span><button className="mini" onClick={() => ret(l)}>Return</button><button className="mini warn" onClick={async () => { await markLost(l, notify); load(); }}>Lost</button></>
              : <span className={`chip ${l.status === 'lost' ? 'lost' : 'ok'}`}>{l.status === 'lost' ? `Lost, ${l.total} PKR` : `Returned, ${l.total} PKR`}</span>}
          </div>
        </div>
      ))}
    </>
  );
}

/* ---------------- App shell ---------------- */
const Bolt = () => <svg className="bolt" viewBox="0 0 24 24" width="30" height="30"><path d="M13 2 4 14h6l-1 8 9-12h-6z" fill="currentColor" /></svg>;

export default function App() {
  const [page, setPage] = useState<'dash' | 'books' | 'readers' | 'loans' | 'history'>('dash');
  const [toast, setToast] = useState<{ m: string; bad: boolean; k: number } | null>(null);
  const notify: Notify = (m, bad = false) => setToast({ m, bad, k: Date.now() });
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);
  const nav: [typeof page, string][] = [['dash', 'Dashboard'], ['books', 'Books'], ['readers', 'Readers'], ['loans', 'Loans'], ['history', 'History']];
  return (
    <>
      <div className="bg" />
      <header className="top">
        <div className="brand"><Bolt /><h1>Voltage Library</h1></div>
        <nav>{nav.map(([k, l]) => <button key={k} className={page === k ? 'on' : ''} onClick={() => setPage(k)}>{l}</button>)}</nav>
      </header>
      <main key={page}>
        {page === 'dash' && <Dashboard />}
        {page === 'books' && <Books notify={notify} />}
        {page === 'readers' && <Readers notify={notify} />}
        {page === 'loans' && <Loans notify={notify} />}
        {page === 'history' && <History />}
      </main>
      {toast && <div key={toast.k} className={`toast ${toast.bad ? 'err' : ''}`}>{toast.m}</div>}
    </>
  );
}
