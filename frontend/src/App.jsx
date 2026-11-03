import { useEffect, useState } from 'react';

const API = 'http://localhost:4000/api';

const s = {
  page: { fontFamily: 'system-ui, sans-serif', maxWidth: 900, margin: '0 auto', padding: 20, color: '#111' },
  card: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 16 },
  input: { display: 'block', width: '100%', padding: 10, marginBottom: 10, borderRadius: 8, border: '1px solid #ccc', boxSizing: 'border-box' },
  btn: { padding: '8px 14px', borderRadius: 8, border: 'none', background: '#4f46e5', color: '#fff', cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 },
};

function weatherText(code) {
  if (code === 0) return 'Clear sky';
  if (code <= 3) return 'Partly cloudy';
  if (code === 45 || code === 48) return 'Foggy';
  if (code >= 51 && code <= 67) return 'Rainy';
  if (code >= 80 && code <= 82) return 'Rain showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Cloudy';
}

async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

function AuthForm({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({
    username: '', first_name: '', last_name: '', email: '', password: '',
  });
  const [error, setError] = useState('');

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const body = mode === 'login'
        ? { email: form.email, password: form.password }
        : form;
      const data = await api(`/auth/${mode}`, { method: 'POST', body });
      onAuth(data.token, data.user);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ ...s.page, maxWidth: 400 }}>
      <h1>Study App</h1>
      <form onSubmit={submit} style={s.card}>
        <h2>{mode === 'login' ? 'Log in' : 'Create account'}</h2>
        {mode === 'register' && (
          <>
            <input style={s.input} name="username" placeholder="Username" onChange={change} />
            <input style={s.input} name="first_name" placeholder="First name" onChange={change} />
            <input style={s.input} name="last_name" placeholder="Last name" onChange={change} />
          </>
        )}
        <input style={s.input} name="email" type="email" placeholder="Email" onChange={change} />
        <input style={s.input} name="password" type="password" placeholder="Password" onChange={change} />
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
        <button style={s.btn} type="submit">{mode === 'login' ? 'Log in' : 'Sign up'}</button>
        <p>
          {mode === 'login' ? 'No account? ' : 'Have an account? '}
          <a href="#" onClick={(e) => { e.preventDefault(); setMode(mode === 'login' ? 'register' : 'login'); }}>
            {mode === 'login' ? 'Sign up' : 'Log in'}
          </a>
        </p>
      </form>
    </div>
  );
}

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={s.card}>
      <h3>Time</h3>
      <div style={{ fontSize: 32 }}>{now.toLocaleTimeString()}</div>
      <div>{now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
    </div>
  );
}

function Weather() {
  const [w, setW] = useState(null);
  useEffect(() => {
    // Default: Cebu City. We'll make this a user setting later.
    fetch('https://api.open-meteo.com/v1/forecast?latitude=10.3157&longitude=123.8854&current=temperature_2m,weather_code')
      .then((r) => r.json())
      .then((d) => setW(d.current))
      .catch(() => setW(null));
  }, []);
  return (
    <div style={s.card}>
      <h3>Weather</h3>
      {w ? (
        <>
          <div style={{ fontSize: 32 }}>{Math.round(w.temperature_2m)}°C</div>
          <div>{weatherText(w.weather_code)}</div>
        </>
      ) : <div>Loading…</div>}
    </div>
  );
}

function Quote() {
  const [q, setQ] = useState(null);
  const load = () => api('/dashboard/quote').then(setQ);
  useEffect(() => { load(); }, []);
  return (
    <div style={s.card}>
      <h3>Quote</h3>
      {q ? <><p>"{q.text}"</p><small>— {q.author}</small></> : 'Loading…'}
      <div><button style={{ ...s.btn, marginTop: 10 }} onClick={load}>Refresh</button></div>
    </div>
  );
}

function Verse() {
  const [v, setV] = useState(null);
  const load = () => api('/dashboard/verse').then(setV);
  useEffect(() => { load(); }, []);
  return (
    <div style={s.card}>
      <h3>Bible verse</h3>
      {v ? (
        <>
          <p>"{v.text}"</p>
          <small>{v.book} {v.chapter}:{v.verse_start} ({v.version})</small>
        </>
      ) : 'Loading…'}
      <div><button style={{ ...s.btn, marginTop: 10 }} onClick={load}>Refresh</button></div>
    </div>
  );
}

function Notes({ token }) {
  const [notes, setNotes] = useState([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const load = () => api('/notes', { token }).then(setNotes);
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    await api('/notes', { method: 'POST', token, body: { title, content } });
    setTitle(''); setContent('');
    load();
  };

  const remove = async (id) => {
    await api(`/notes/${id}`, { method: 'DELETE', token });
    load();
  };

  return (
    <div style={s.card}>
      <h3>My notes</h3>
      <form onSubmit={add}>
        <input style={s.input} placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea style={{ ...s.input, height: 80 }} placeholder="Write your note…" value={content} onChange={(e) => setContent(e.target.value)} />
        <button style={s.btn} type="submit">Add note</button>
      </form>
      <hr />
      {notes.length === 0 && <p>No notes yet.</p>}
      {notes.map((n) => (
        <div key={n.note_id} style={{ borderBottom: '1px solid #eee', padding: '8px 0' }}>
          <strong>{n.title}</strong>
          <p style={{ margin: '4px 0', whiteSpace: 'pre-wrap' }}>{n.content}</p>
          <button onClick={() => remove(n.note_id)}>Delete</button>
        </div>
      ))}
    </div>
  );
}

function FocusTimer({ token }) {
  const [minutes, setMinutes] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [endAt, setEndAt] = useState(null);
  const [today, setToday] = useState({ minutes: 0, sessions: 0 });

  const loadToday = () =>
    api('/focus/today', { token }).then(setToday).catch(() => {});
  useEffect(() => { loadToday(); }, []);

  // Tick every second while running
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setSecondsLeft(Math.max(0, Math.round((endAt - Date.now()) / 1000)));
    }, 500);
    return () => clearInterval(t);
  }, [running, endAt]);

  // When the countdown hits zero, save the session
  useEffect(() => {
    if (running && secondsLeft <= 0) {
      setRunning(false);
      api('/focus', {
        method: 'POST',
        token,
        body: { planned_min: minutes, actual_min: minutes, status: 'completed' },
      }).then(loadToday);
      alert('Focus session complete! Take a short break.');
    }
  }, [secondsLeft, running]);

  const start = () => {
    setEndAt(Date.now() + secondsLeft * 1000);
    setRunning(true);
  };
  const pause = () => setRunning(false);
  const reset = () => {
    setRunning(false);
    setSecondsLeft(minutes * 60);
  };
  const changeMinutes = (e) => {
    const m = Math.min(180, Math.max(1, Number(e.target.value) || 1));
    setMinutes(m);
    setSecondsLeft(m * 60);
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div style={s.card}>
      <h3>Focus mode</h3>
      <div style={{ fontSize: 56, lineHeight: 1.3, textAlign: 'center' }}>{mm}:{ss}</div>
      <div style={{ textAlign: 'center', marginBottom: 10 }}>
        <label>
          Minutes:{' '}
          <input
            type="number"
            min="1"
            max="180"
            value={minutes}
            onChange={changeMinutes}
            disabled={running}
            style={{ width: 70, padding: 6 }}
          />
        </label>
      </div>
      <div style={{ textAlign: 'center' }}>
        {!running ? (
          <button style={s.btn} onClick={start}>Start</button>
        ) : (
          <button style={s.btn} onClick={pause}>Pause</button>
        )}{' '}
        <button style={s.btn} onClick={reset}>Reset</button>
      </div>
      <p style={{ textAlign: 'center', marginBottom: 0 }}>
        Today: <strong>{today.minutes} min</strong> focused · {today.sessions} sessions
      </p>
    </div>
  );
}

function NotesBoard({ token }) {
  const [subjects, setSubjects] = useState([]);
  const [notes, setNotes] = useState([]);
  const [active, setActive] = useState('all');
  const [search, setSearch] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [editId, setEditId] = useState(null);
  const [edit, setEdit] = useState({ title: '', content: '', subject_id: '' });
  const [error, setError] = useState('');

  const loadSubjects = () => api('/subjects', { token }).then(setSubjects);
  const loadNotes = () => {
    const params = new URLSearchParams();
    if (active !== 'all') params.set('subject_id', active);
    if (search.trim()) params.set('q', search.trim());
    return api(`/notes?${params.toString()}`, { token }).then(setNotes);
  };

  useEffect(() => { loadSubjects(); }, []);
  useEffect(() => { loadNotes(); }, [active, search]);

  const addSubject = async (e) => {
    e.preventDefault();
    setError('');
    if (!newSubject.trim()) return;
    try {
      await api('/subjects', { method: 'POST', token, body: { name: newSubject } });
      setNewSubject('');
      loadSubjects();
    } catch (err) {
      setError(err.message);
    }
  };

  const removeSubject = async (id) => {
    if (!confirm('Delete this subject? Your notes will be kept.')) return;
    await api(`/subjects/${id}`, { method: 'DELETE', token });
    loadSubjects();
    if (active === id) setActive('all');
    else loadNotes();
  };

  const addNote = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    await api('/notes', {
      method: 'POST',
      token,
      body: {
        title,
        content,
        subject_id: subjectId || (active !== 'all' ? active : null),
      },
    });
    setTitle('');
    setContent('');
    loadNotes();
    loadSubjects();
  };

  const startEdit = (n) => {
    setEditId(n.note_id);
    setEdit({ title: n.title, content: n.content, subject_id: n.subject_id || '' });
  };

  const saveEdit = async () => {
    await api(`/notes/${editId}`, {
      method: 'PUT',
      token,
      body: {
        title: edit.title,
        content: edit.content,
        subject_id: edit.subject_id || undefined,
      },
    });
    setEditId(null);
    loadNotes();
    loadSubjects();
  };

  const removeNote = async (id) => {
    await api(`/notes/${id}`, { method: 'DELETE', token });
    loadNotes();
    loadSubjects();
  };

  const chip = (isActive) => ({
    padding: '6px 12px',
    borderRadius: 20,
    border: '1px solid #c7c9d1',
    background: isActive ? '#4f46e5' : '#fff',
    color: isActive ? '#fff' : '#111',
    cursor: 'pointer',
    marginRight: 6,
    marginBottom: 6,
  });

  const subjectName = (id) => subjects.find((x) => x.subject_id === id)?.name;

  return (
    <div style={s.card}>
      <h3>My notes</h3>

      <input
        style={s.input}
        placeholder="Search your notes…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div style={{ marginBottom: 8 }}>
        <button style={chip(active === 'all')} onClick={() => setActive('all')}>
          All
        </button>
        {subjects.map((sub) => (
          <span key={sub.subject_id}>
            <button
              style={chip(active === sub.subject_id)}
              onClick={() => setActive(sub.subject_id)}
            >
              {sub.name} ({sub.note_count})
            </button>
            <button
              title="Delete subject"
              onClick={() => removeSubject(sub.subject_id)}
              style={{ marginRight: 10, border: 'none', background: 'none', cursor: 'pointer' }}
            >
              ✕
            </button>
          </span>
        ))}
      </div>

      <form onSubmit={addSubject} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
        <input
          style={{ ...s.input, marginBottom: 0 }}
          placeholder="New subject (e.g. Math)"
          value={newSubject}
          onChange={(e) => setNewSubject(e.target.value)}
        />
        <button style={s.btn} type="submit">Add</button>
      </form>
      {error && <p style={{ color: 'crimson', marginTop: 0 }}>{error}</p>}

      <hr />

      <form onSubmit={addNote}>
        <input
          style={s.input}
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          style={{ ...s.input, height: 80 }}
          placeholder="Write your note…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <select
          style={s.input}
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
        >
          <option value="">
            {active !== 'all' ? 'Current subject' : 'No subject'}
          </option>
          {subjects.map((sub) => (
            <option key={sub.subject_id} value={sub.subject_id}>{sub.name}</option>
          ))}
        </select>
        <button style={s.btn} type="submit">Add note</button>
      </form>

      <hr />

      {notes.length === 0 && <p>No notes here yet.</p>}
      {notes.map((n) => (
        <div key={n.note_id} style={{ borderBottom: '1px solid #eee', padding: '10px 0' }}>
          {editId === n.note_id ? (
            <>
              <input
                style={s.input}
                value={edit.title}
                onChange={(e) => setEdit({ ...edit, title: e.target.value })}
              />
              <textarea
                style={{ ...s.input, height: 100 }}
                value={edit.content}
                onChange={(e) => setEdit({ ...edit, content: e.target.value })}
              />
              <select
                style={s.input}
                value={edit.subject_id}
                onChange={(e) => setEdit({ ...edit, subject_id: e.target.value })}
              >
                <option value="">(keep subject)</option>
                {subjects.map((sub) => (
                  <option key={sub.subject_id} value={sub.subject_id}>{sub.name}</option>
                ))}
              </select>
              <button style={s.btn} onClick={saveEdit}>Save</button>{' '}
              <button onClick={() => setEditId(null)}>Cancel</button>
            </>
          ) : (
            <>
              <strong>{n.title}</strong>
              {subjectName(n.subject_id) && (
                <span style={{ marginLeft: 8, fontSize: 12, color: '#4f46e5' }}>
                  #{subjectName(n.subject_id)}
                </span>
              )}
              <p style={{ margin: '4px 0', whiteSpace: 'pre-wrap' }}>{n.content}</p>
              <button onClick={() => startEdit(n)}>Edit</button>{' '}
              <button onClick={() => removeNote(n.note_id)}>Delete</button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function FilesBoard({ token }) {
  const [files, setFiles] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState(null);

  const loadSubjects = () => api('/subjects', { token }).then(setSubjects);
  const loadFiles = () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    return api(`/files?${params.toString()}`, { token }).then(setFiles);
  };

  useEffect(() => { loadSubjects(); }, []);
  useEffect(() => { loadFiles(); }, [search]);

  const upload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const form = new FormData();
      if (subjectId) form.append('subject_id', subjectId);
      form.append('file', file);
      const res = await fetch(`${API}/files`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      loadFiles();
    } catch (err) {
      setError(err.message);
    }
    setUploading(false);
    e.target.value = '';
  };

  const closeViewer = () => {
    if (viewing?.url) URL.revokeObjectURL(viewing.url);
    setViewing(null);
  };

  const view = async (f) => {
    closeViewer();
    const ext = f.original_name.split('.').pop().toLowerCase();
    try {
      if (ext === 'pdf' || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
        const res = await fetch(`${API}/files/${f.file_id}/content`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const blob = await res.blob();
        setViewing({
          file: f,
          kind: ext === 'pdf' ? 'pdf' : 'image',
          url: URL.createObjectURL(blob),
          text: null,
        });
      } else {
        const d = await api(`/files/${f.file_id}/text`, { token });
        setViewing({ file: f, kind: 'text', url: null, text: d.text || '(No readable text found. Use Download to open it on your computer.)' });
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const loadText = async () => {
    const d = await api(`/files/${viewing.file.file_id}/text`, { token });
    setViewing((v) => ({ ...v, text: d.text || '(No readable text found in this file)' }));
  };

  const download = async (f) => {
  const res = await fetch(`${API}/files/${f.file_id}`.concat('/content'), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = f.original_name;
  a.click();
  URL.revokeObjectURL(url);
};

const remove = async (f) => {
    if (!confirm(`Delete "${f.original_name}"?`)) return;
    await api(`/files/${f.file_id}`, { method: 'DELETE', token });
    if (viewing?.file.file_id === f.file_id) closeViewer();
    loadFiles();
  };

  const subjectName = (id) => subjects.find((x) => x.subject_id === id)?.name;

  return (
    <div style={s.card}>
      <h3>My files</h3>

      <input
        style={s.input}
        placeholder="Search inside your files…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
        <select
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          onFocus={loadSubjects}
          style={{ padding: 8 }}
        >
          <option value="">No subject</option>
          {subjects.map((sub) => (
            <option key={sub.subject_id} value={sub.subject_id}>{sub.name}</option>
          ))}
        </select>
        <input
          type="file"
          accept=".pdf,.docx,.pptx,.xlsx,.odt,.odp,.ods,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.gif,.webp,.doc,.ppt,.xls"
          onChange={upload}
          disabled={uploading}
        />
        {uploading && <span>Uploading and reading…</span>}
      </div>
      <small>PDF, Word, PowerPoint, Excel, text, CSV, and images up to 25 MB.</small>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      <hr />

      {files.length === 0 && <p>No files yet.</p>}
      {files.map((f) => (
        <div key={f.file_id} style={{ borderBottom: '1px solid #eee', padding: '8px 0' }}>
          <strong>{f.original_name}</strong>
          {subjectName(f.subject_id) && (
            <span style={{ marginLeft: 8, fontSize: 12, color: '#4f46e5' }}>
              #{subjectName(f.subject_id)}
            </span>
          )}
          <div style={{ fontSize: 12, color: '#666' }}>
            {Math.max(1, Math.round(Number(f.size_bytes) / 1024))} KB ·{' '}
            {f.has_text ? 'readable text found' : 'no text found (image or scanned file)'}
          </div>
          <div style={{ marginTop: 4 }}>
            <button onClick={() => view(f)}>View</button>{' '}<button onClick={() => download(f)}>Download</button>{' '}
            <button onClick={() => remove(f)}>Delete</button>
          </div>
        </div>
      ))}

      {viewing && (
        <div style={{ marginTop: 16, borderTop: '2px solid #4f46e5', paddingTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>{viewing.file.original_name}</strong>
            <button onClick={closeViewer}>Close</button>
          </div>

          {viewing.kind === 'pdf' && (
            <iframe
              title="pdf"
              src={viewing.url}
              style={{ width: '100%', height: 600, border: '1px solid #ddd', marginTop: 8 }}
            />
          )}
          {viewing.kind === 'image' && (
            <img src={viewing.url} alt="" style={{ maxWidth: '100%', marginTop: 8 }} />
          )}
          {viewing.kind === 'pdf' && viewing.text === null && viewing.file.has_text && (
            <button style={{ ...s.btn, marginTop: 8 }} onClick={loadText}>
              Show readable text
            </button>
          )}
          {viewing.text !== null && (
            <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 400, overflow: 'auto', background: '#f6f6f8', padding: 12, borderRadius: 8, marginTop: 8 }}>
              {viewing.text}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));

  const onAuth = (t, u) => {
    localStorage.setItem('token', t);
    localStorage.setItem('user', JSON.stringify(u));
    setToken(t); setUser(u);
  };

  const logout = () => {
    localStorage.clear();
    setToken(null); setUser(null);
  };

  if (!token) return <AuthForm onAuth={onAuth} />;

  return (
    <div style={s.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Hi, {user?.first_name}!</h1>
        <button style={s.btn} onClick={logout}>Log out</button>
      </div>
      <div style={s.grid}>
        <Clock />
        <Weather />
        <Quote />
        <Verse />
      </div>
      <FocusTimer token={token} />
        <NotesBoard token={token} />
        <FilesBoard token={token} />
    </div>
  );
}