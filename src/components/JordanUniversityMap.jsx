// src/components/JordanUniversityMap.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Plus, Minus, Maximize2, MapPin, Info } from 'lucide-react';
import { UNIVERSITIES, STATUS_META } from '../data/universities';
import { JO_PATH, JO_VB } from '../data/jordanShape';
import './JordanUniversityMap.css';

const NO_DATA = 'لا توجد بيانات منشورة كافية';

/* -------- lat/lng -> position (%) on the existing Jordan outline --------
   Linear fit calibrated on the markers that were already placed correctly
   on this outline (error < 0.5% of the map size). */
const toPercent = (lat, lng) => ({
  x: 20.769 * lng - 721.738,
  y: -22.3776 * lat + 750.429,
});

/* -------- Arabic-friendly search normalisation -------- */
const normalize = (s = '') =>
  s
    .toString()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();

/* -------- Filters -------- */
const FILTERS = [
  { id: 'all', label: 'جميع الجامعات', test: () => true },
  { id: 'program', label: 'لديها برنامج إعادة تدوير', test: (u) => u.recyclingProgram === 'yes' },
  { id: 'separation', label: 'فصل النفايات', test: (u) => u.wasteSeparation === 'yes' || u.wasteSeparation === 'partial' },
  { id: 'ewaste', label: 'النفايات الإلكترونية', test: (u) => !!u.eWaste },
  { id: 'organic', label: 'النفايات العضوية', test: (u) => !!u.organicWaste },
  { id: 'awareness', label: 'مبادرات توعية', test: (u) => u.tags.includes('awareness') },
  { id: 'sustainability', label: 'استدامة بيئية', test: (u) => u.tags.includes('sustainability') },
];

/* -------- Labels shown in the popup / details -------- */
const programLabel = (v) =>
  v === 'yes' ? 'يوجد برنامج موثّق' : v === 'limited' ? 'بيانات محدودة' : null;

const separationLabel = (u) => {
  const base =
    u.wasteSeparation === 'yes' ? 'نعم، موثّق'
      : u.wasteSeparation === 'partial' ? 'جزئي'
        : u.wasteSeparation === 'limited' ? 'بيانات محدودة'
          : null;
  if (!base) return null;
  return u.wasteSeparationNote ? `${base} (${u.wasteSeparationNote})` : base;
};

/* =====================================================================
   Hook point for the AI agent.
   - Pass `onAskAI({ university, question })` from the parent to connect
     the chatbot (App.jsx already does this).
   - If no prop is passed, a window event `ecowasteai:ask` is dispatched
     so any other part of the app can listen to it.
   ===================================================================== */
export const ECOWASTEAI_ASK_EVENT = 'ecowasteai:ask';

const buildQuestion = (u) => `ما هي ممارسات إعادة التدوير وإدارة النفايات في ${u.name}؟`;

const Row = ({ label, children }) => (
  <div className="jum-row">
    <span className="jum-row-label">{label}</span>
    <span className="jum-row-value">{children || <em className="jum-nodata">{NO_DATA}</em>}</span>
  </div>
);

const MaterialChips = ({ items }) =>
  items && items.length ? (
    <span className="jum-mats">
      {items.map((m) => (
        <span key={m} className="jum-mat">{m}</span>
      ))}
    </span>
  ) : null;

const StatusBadge = ({ status }) => (
  <span className={`jum-badge ${status}`}>
    <i />
    {STATUS_META[status].label}
  </span>
);

const SourceList = ({ sources }) =>
  sources && sources.length
    ? sources.map((s) =>
        s.url ? (
          <a key={s.label} href={s.url} target="_blank" rel="noreferrer">{s.label}</a>
        ) : (
          <span key={s.label}>{s.label}</span>
        ),
      )
    : null;

export default function JordanUniversityMap({ onAskAI }) {
  const [query, setQuery] = useState('');
  const [filterId, setFilterId] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [detailsId, setDetailsId] = useState(null);
  const [zoom, setZoom] = useState(1);

  const viewportRef = useRef(null);
  const stageRef = useRef(null);
  const cardRef = useRef(null);

  const unis = useMemo(
    () => UNIVERSITIES.map((u) => ({ ...u, pos: toPercent(u.latitude, u.longitude) })),
    [],
  );

  const visible = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filterId) || FILTERS[0];
    const q = normalize(query);
    return unis.filter(
      (u) => f.test(u) && (!q || normalize(u.name).includes(q) || normalize(u.city).includes(q)),
    );
  }, [unis, filterId, query]);

  const visibleIds = useMemo(() => new Set(visible.map((u) => u.id)), [visible]);

  // Alphabetical list (not a ranking)
  const sorted = useMemo(
    () => [...visible].sort((a, b) => a.name.localeCompare(b.name, 'ar')),
    [visible],
  );

  const counts = useMemo(() => {
    const c = { documented: 0, limited: 0, nodata: 0 };
    visible.forEach((u) => { c[u.status] += 1; });
    return c;
  }, [visible]);

  const selected = unis.find((u) => u.id === selectedId) || null;
  const detail = unis.find((u) => u.id === detailsId) || null;

  // Close the popup if the selected university gets filtered out
  useEffect(() => {
    if (selectedId && !visibleIds.has(selectedId)) setSelectedId(null);
  }, [visibleIds, selectedId]);

  // Esc closes details first, then the popup
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (detailsId) setDetailsId(null);
      else if (selectedId) setSelectedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailsId, selectedId]);

  // Lock page scroll while the details dialog is open
  useEffect(() => {
    if (!detailsId) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [detailsId]);

  // Centre the map on the selected university / on zoom changes
  useEffect(() => {
    const vp = viewportRef.current;
    const st = stageRef.current;
    if (!vp || !st) return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fx = selected ? selected.pos.x / 100 : 0.5;
    const fy = selected ? selected.pos.y / 100 : 0.5;
    vp.scrollTo({
      left: st.offsetLeft + st.offsetWidth * fx - vp.clientWidth / 2,
      top: st.offsetTop + st.offsetHeight * fy - vp.clientHeight / 2,
      behavior: reduce ? 'auto' : 'smooth',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, selectedId]);

  const pickFromList = (id) => {
    setSelectedId(id);
    setZoom((z) => Math.max(z, 2));
    if (window.matchMedia && window.matchMedia('(max-width: 960px)').matches && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleSearchKey = (e) => {
    if (e.key === 'Enter' && sorted.length) pickFromList(sorted[0].id);
  };

  const handleAskEcoWasteAI = (u) => {
    const payload = { university: u, question: buildQuestion(u) };
    if (typeof onAskAI === 'function') onAskAI(payload);
    else window.dispatchEvent(new CustomEvent(ECOWASTEAI_ASK_EVENT, { detail: payload }));
  };

  const zoomBy = (d) => setZoom((z) => Math.min(3.5, Math.max(1, +(z + d).toFixed(2))));

  return (
    <section className="jum-sec" dir="rtl" aria-labelledby="jum-title">
      <div className="jum-wrap">
        {/* ---------- Header ---------- */}
        <header className="jum-head">
          <span className="jum-pill">الخريطة التفاعلية</span>
          <h2 id="jum-title">خريطة إعادة التدوير في الجامعات الأردنية</h2>
          <p>اكتشف ممارسات إدارة النفايات وإعادة التدوير في الجامعات الأردنية، وتعرّف على المبادرات البيئية لكل جامعة.</p>
        </header>

        {/* ---------- Search + filters ---------- */}
        <div className="jum-toolbar">
          <label className="jum-search">
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              value={query}
              placeholder="ابحث عن اسم الجامعة…"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleSearchKey}
              aria-label="ابحث عن اسم الجامعة"
            />
            {query && (
              <button type="button" className="jum-search-clear" onClick={() => setQuery('')} aria-label="مسح البحث">
                <X size={16} />
              </button>
            )}
          </label>

          <div className="jum-filters" role="group" aria-label="تصفية الجامعات">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`jum-chip ${filterId === f.id ? 'on' : ''}`}
                aria-pressed={filterId === f.id}
                onClick={() => setFilterId(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="jum-layout">
          {/* ---------- Map ---------- */}
          <div className="jum-map-card" ref={cardRef}>
            <div className="jum-zoom" role="group" aria-label="التحكم بالتكبير">
              <button type="button" onClick={() => zoomBy(0.5)} aria-label="تكبير" disabled={zoom >= 3.5}><Plus size={18} /></button>
              <button type="button" onClick={() => zoomBy(-0.5)} aria-label="تصغير" disabled={zoom <= 1}><Minus size={18} /></button>
              <button type="button" onClick={() => { setZoom(1); setSelectedId(null); }} aria-label="إعادة ضبط الخريطة"><Maximize2 size={16} /></button>
            </div>

            <div className="jum-viewport" ref={viewportRef}>
              <div
                className="jum-stage"
                ref={stageRef}
                style={{ '--z': zoom, aspectRatio: `${JO_VB[2]} / ${JO_VB[3]}` }}
              >
                <svg className="jum-svg" viewBox={JO_VB.join(' ')} aria-hidden="true">
                  <defs>
                    <linearGradient id="jum-g" x1="0" x2="1" y1="0" y2="1">
                      <stop offset="0" stopColor="#e9fbd2" />
                      <stop offset="1" stopColor="#c9f0a0" />
                    </linearGradient>
                  </defs>
                  <path className="jum-shape" d={JO_PATH} />
                </svg>

                {unis.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className={`jum-dot ${u.status} ${selectedId === u.id ? 'sel' : ''} ${visibleIds.has(u.id) ? '' : 'dim'}`}
                    style={{ left: `${u.pos.x}%`, top: `${u.pos.y}%` }}
                    aria-label={`${u.name} — ${u.city}`}
                    tabIndex={visibleIds.has(u.id) ? 0 : -1}
                    onClick={() => setSelectedId((id) => (id === u.id ? null : u.id))}
                  >
                    <span className="jum-dot-core" />
                    <span className="jum-dot-label">{u.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Legend on the map */}
            <div className="jum-legend-float" aria-hidden="true">
              {Object.entries(STATUS_META).map(([k, m]) => (
                <span key={k}><i style={{ background: m.color }} />{m.label}</span>
              ))}
            </div>

            {visible.length === 0 && (
              <div className="jum-empty-map">لا توجد جامعات مطابقة للبحث أو التصفية الحالية.</div>
            )}

            {/* ---------- Popup ---------- */}
            {selected && (
              <aside className="jum-popup" role="dialog" aria-label={`معلومات ${selected.name}`}>
                <button type="button" className="jum-x" onClick={() => setSelectedId(null)} aria-label="إغلاق"><X size={18} /></button>
                <h3>{selected.name}</h3>
                <p className="jum-city"><MapPin size={15} aria-hidden="true" /> {selected.city} · {selected.type}</p>
                <StatusBadge status={selected.status} />

                <div className="jum-rows">
                  <Row label="حالة إعادة التدوير">{programLabel(selected.recyclingProgram)}</Row>
                  <Row label="فصل النفايات">{separationLabel(selected)}</Row>
                  <Row label="المواد التي يتم تدويرها"><MaterialChips items={selected.materials} /></Row>
                  <Row label="النفايات الإلكترونية">{selected.eWaste}</Row>
                  <Row label="النفايات العضوية">{selected.organicWaste}</Row>
                  <Row label="التوعية والمبادرات">{selected.awareness}</Row>
                  <Row label="مصدر المعلومات"><SourceList sources={selected.sources} /></Row>
                </div>

                <div className="jum-actions">
                  <button type="button" className="jum-btn primary" onClick={() => setDetailsId(selected.id)}>
                    <Info size={16} /> عرض التفاصيل
                  </button>
                  <button type="button" className="jum-btn dark" onClick={() => handleAskEcoWasteAI(selected)}>
                    اسأل EcoWasteAI 🤖
                  </button>
                </div>
              </aside>
            )}
          </div>

          {/* ---------- Sidebar ---------- */}
          <aside className="jum-side">
            <div className="jum-box">
              <h4>نظرة سريعة</h4>
              <div className="jum-stats">
                <div><strong>{visible.length}</strong><span>جامعة معروضة</span></div>
                <div><strong style={{ color: STATUS_META.documented.color }}>{counts.documented}</strong><span>ممارسات موثقة</span></div>
                <div><strong style={{ color: '#c99700' }}>{counts.limited}</strong><span>بيانات محدودة</span></div>
              </div>
            </div>

            <div className="jum-box">
              <h4>دليل الألوان</h4>
              <ul className="jum-legend">
                {Object.entries(STATUS_META).map(([k, m]) => (
                  <li key={k}><i style={{ background: m.color }} />{m.label}</li>
                ))}
              </ul>
              <p className="jum-note">
                الألوان تدل على توفر بيانات منشورة فقط، وليست تقييمًا أو ترتيبًا للجامعات.
              </p>
            </div>

            <div className="jum-box jum-list-box">
              <h4>الجامعات <small>(مرتبة أبجديًا)</small></h4>
              {sorted.length === 0 ? (
                <p className="jum-note">لا توجد نتائج مطابقة.</p>
              ) : (
                <ul className="jum-list">
                  {sorted.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        className={selectedId === u.id ? 'on' : ''}
                        onClick={() => pickFromList(u.id)}
                      >
                        <i className={u.status} style={{ background: STATUS_META[u.status].color }} />
                        <span className="jum-li-name">{u.name}</span>
                        <span className="jum-li-city">{u.city}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* ---------- Details dialog ---------- */}
      {detail && (
        <div className="jum-modal-bg" onClick={() => setDetailsId(null)}>
          <div className="jum-modal" role="dialog" aria-modal="true" aria-label={`تفاصيل ${detail.name}`} onClick={(e) => e.stopPropagation()}>
            <button type="button" className="jum-x" onClick={() => setDetailsId(null)} aria-label="إغلاق"><X size={20} /></button>
            <h3>{detail.name}</h3>
            <p className="jum-city"><MapPin size={15} aria-hidden="true" /> {detail.city} · {detail.type}</p>
            <StatusBadge status={detail.status} />

            <p className="jum-desc">{detail.description || NO_DATA}</p>

            <div className="jum-rows">
              <Row label="حالة إعادة التدوير">{programLabel(detail.recyclingProgram)}</Row>
              <Row label="فصل النفايات">{separationLabel(detail)}</Row>
              <Row label="المواد / الممارسات الموثقة"><MaterialChips items={detail.materials} /></Row>
              <Row label="النفايات الإلكترونية">{detail.eWaste}</Row>
              <Row label="النفايات العضوية">{detail.organicWaste}</Row>
              <Row label="التوعية والمبادرات">{detail.awareness}</Row>
              <Row label="الأهداف المعلنة">{detail.goals}</Row>
              <Row label="مصدر المعلومات"><SourceList sources={detail.sources} /></Row>
            </div>

            <div className="jum-actions">
              <button type="button" className="jum-btn dark" onClick={() => { handleAskEcoWasteAI(detail); setDetailsId(null); }}>
                اسأل EcoWasteAI 🤖
              </button>
              <button type="button" className="jum-btn ghost" onClick={() => setDetailsId(null)}>إغلاق</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
