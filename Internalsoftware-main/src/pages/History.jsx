import React, { useEffect, useState, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db } from '../firebase';
import Navbar from '../components/Navbar';
import {
  collection, getDocs, getDoc, query, orderBy, where,
  limit, startAfter, doc, updateDoc, deleteDoc
} from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const REVIEWERS = [
  'Maulik Shah',
  'Jigar Shah',
  'Sonal Madam',
  'Bhavin Prajapati',
  'Jash Ilasariya',
  'Shubham',
];

const PAGE_SIZE = 10; // records per page

// ─────────────────────────────────────────────────────────────────────────────
// FIX 3 — In-Memory Cache (module-level: survives re-renders, cleared on filter change)
// Key   → "officer=X|from=Y|to=Z|page=N"
// Value → { records: [...], hasMore: true/false }
// NOTE: Firestore DocumentSnapshot objects (cursors) are stored separately
//       in pageCursors state because they cannot be JSON-serialised.
// ─────────────────────────────────────────────────────────────────────────────
const historyCache = new Map();

function buildCacheKey(officerFilter, dateFrom, dateTo, pageIndex) {
  return `officer=${officerFilter}|from=${dateFrom}|to=${dateTo}|page=${pageIndex}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export default function History() {

  // ── Data ──────────────────────────────────────────────────────────────────
  const [records, setRecords]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  // ── Filter input state (not yet sent to Firebase) ─────────────────────────
  const [officerFilter, setOfficerFilter] = useState('');
  const [dateFrom, setDateFrom]           = useState('');
  const [dateTo, setDateTo]               = useState('');
  const [search, setSearch]               = useState('');   // client-side text search

  // ── Applied filters (sent to Firebase when user clicks "Apply") ───────────
  const [appliedFilters, setAppliedFilters] = useState({
    officerFilter: '',
    dateFrom: '',
    dateTo: '',
  });

  // ── FIX 1 — Pagination state ──────────────────────────────────────────────
  // pageCursors[i] = the Firestore DocumentSnapshot that is the LAST doc of page i.
  // Using that snapshot as startAfter() gives us page i+1.
  // pageCursors[0] = null → first page needs no startAfter cursor.
  const [currentPage, setCurrentPage]   = useState(0);           // 0-indexed
  const [pageCursors, setPageCursors]   = useState([null]);      // array of cursors
  const [hasMore, setHasMore]           = useState(false);       // is there a next page?

  // ── UI state ─────────────────────────────────────────────────────────────
  const [expandedId, setExpandedId]   = useState(null);
  const [commentModal, setCommentModal] = useState({
    open: false, id: null, reviewer: '', text: '',
  });

  // ── Officer dropdown list (one-time lightweight fetch) ────────────────────
  const [officerList, setOfficerList] = useState([]);

  // Fetch unique officer names once for the filter dropdown
  useEffect(() => {
    async function fetchOfficerList() {
      try {
        // Fetch up to 200 most-recent records just for the officerName field
        const snap = await getDocs(
          query(collection(db, 'fieldOfficerForms'), orderBy('createdAt', 'desc'), limit(200))
        );
        const names = new Set();
        snap.docs.forEach(d => {
          const n = d.data().officerName;
          if (n) names.add(n);
        });
        setOfficerList(Array.from(names).sort());
      } catch (_) {
        // non-critical — dropdown just stays empty
      }
    }
    fetchOfficerList();
  }, []);

  // ── FIX 1 + 2 + 3 — Core fetch function ──────────────────────────────────
  const fetchPage = useCallback(async (pageIndex, cursors, filters) => {
    const { officerFilter, dateFrom, dateTo } = filters;

    // ── FIX 3: Check cache first ──────────────────────────────────────────
    const cacheKey = buildCacheKey(officerFilter, dateFrom, dateTo, pageIndex);
    if (historyCache.has(cacheKey)) {
      const cached = historyCache.get(cacheKey);
      setRecords(cached.records);
      setHasMore(cached.hasMore);
      setLoading(false);
      return;
    }

    // ── FIX 2: Build Firebase query with server-side filters ──────────────
    // Strategy to avoid composite indexes:
    //   - Date only    → where(date) + orderBy(date)     [same field = OK]
    //   - Officer only → where(officerName)              [no orderBy needed]
    //   - Both         → where(date) + orderBy(date)     [officer client-side]
    //   - Neither      → orderBy(createdAt)              [single field = OK]
    const constraints = [];
    let officerClientSide = '';

    const hasDateFilter    = !!(dateFrom || dateTo);
    const hasOfficerFilter = !!officerFilter;

    if (hasDateFilter && hasOfficerFilter) {
      if (dateFrom) constraints.push(where('date', '>=', dateFrom));
      if (dateTo)   constraints.push(where('date', '<=', dateTo));
      constraints.push(orderBy('date', 'desc'));
      officerClientSide = officerFilter;
    } else if (hasDateFilter) {
      if (dateFrom) constraints.push(where('date', '>=', dateFrom));
      if (dateTo)   constraints.push(where('date', '<=', dateTo));
      constraints.push(orderBy('date', 'desc'));
    } else if (hasOfficerFilter) {
      constraints.push(where('officerName', '==', officerFilter));
    } else {
      constraints.push(orderBy('createdAt', 'desc'));
    }

    // ── FIX 1: Cursor-based pagination ────────────────────────────────────
    const cursor = cursors[pageIndex];
    if (cursor) {
      constraints.push(startAfter(cursor));
    }

    // Fetch PAGE_SIZE + 1 records: the extra one tells us if a next page exists
    constraints.push(limit(PAGE_SIZE + 1));

    const q   = query(collection(db, 'fieldOfficerForms'), ...constraints);
    const snap = await getDocs(q);

    const hasMoreData = snap.docs.length > PAGE_SIZE;
    const pageDocs    = hasMoreData ? snap.docs.slice(0, PAGE_SIZE) : snap.docs;
    let fetched       = pageDocs.map(d => ({ id: d.id, ...d.data() }));

    // Client-side officer filter (when officer + date are both active)
    if (officerClientSide) {
      fetched = fetched.filter(r => r.officerName === officerClientSide);
    }

    // Save the LAST doc of this page as the cursor for page (pageIndex + 1)
    if (pageDocs.length > 0) {
      setPageCursors(prev => {
        const updated = [...prev];
        updated[pageIndex + 1] = pageDocs[pageDocs.length - 1];
        return updated;
      });
    }

    // ── FIX 3: Save result to cache ───────────────────────────────────────
    historyCache.set(cacheKey, { records: fetched, hasMore: hasMoreData });

    setRecords(fetched);
    setHasMore(hasMoreData);
    setLoading(false);
  }, []);

  // Trigger fetch whenever currentPage or appliedFilters change
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchPage(currentPage, pageCursors, appliedFilters).catch(() => {
      setError('Failed to load history. Please check your connection and try again.');
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, appliedFilters]);

  // ── Filter actions ────────────────────────────────────────────────────────
  const applyFilters = () => {
    historyCache.clear();           // clear cache for new filter combination
    setCurrentPage(0);
    setPageCursors([null]);
    setAppliedFilters({ officerFilter, dateFrom, dateTo });
  };

  const clearFilters = () => {
    setOfficerFilter('');
    setDateFrom('');
    setDateTo('');
    setSearch('');
    historyCache.clear();
    setCurrentPage(0);
    setPageCursors([null]);
    setAppliedFilters({ officerFilter: '', dateFrom: '', dateTo: '' });
  };

  // ── Pagination helpers ────────────────────────────────────────────────────
  const goNext = () => {
    setExpandedId(null);
    setCurrentPage(p => p + 1);
  };
  const goPrev = () => {
    setExpandedId(null);
    setCurrentPage(p => Math.max(0, p - 1));
  };

  // ── Client-side text search (Firestore can't do full-text search) ─────────
  const displayed = search.trim()
    ? records.filter(r => {
        const s = search.toLowerCase();
        const inLoc  = (r.locations || []).join(',').toLowerCase().includes(s);
        const inCust = (r.customers || []).some(c =>
          (c.name  || '').toLowerCase().includes(s) ||
          (c.phone || '').toLowerCase().includes(s)
        );
        return inLoc || inCust;
      })
    : records;

  // ── PDF Export (unchanged) ────────────────────────────────────────────────
  const exportRecordToPDF = (record) => {
    const docPdf = new jsPDF();
    docPdf.setFont('helvetica');
    docPdf.setFontSize(16);
    docPdf.text('Daily Form Data', 14, 18);
    docPdf.setFontSize(11);
    docPdf.text(`Officer: ${record.officerName || '-'} | Date: ${record.date || '-'}`, 14, 28);
    docPdf.text(`Working Type: ${record.workingType || '-'} | KMs: ${record.kms || '-'}`, 14, 36);
    docPdf.text(`Punch In: ${record.punchIn || '-'} | Punch Out: ${record.punchOut || '-'} | Hours: ${record.hours || '-'}`, 14, 44);
    docPdf.text(`Entry By: ${record.entryBy || '-'}`, 14, 52);
    docPdf.text(`Reviewer: ${record.reviewer || '-'}`, 14, 60);
    docPdf.text(`Reviewer Comment: ${record.reviewerComment || '-'}`, 14, 68);
    docPdf.text('Visited Locations:', 14, 78);
    (record.locations || []).forEach((loc, i) => {
      if (loc) docPdf.text(`- ${loc}`, 20, 86 + i * 7);
    });
    let y = 86 + (record.locations?.length || 0) * 7 + 6;
    docPdf.text('Customers:', 14, y); y += 6;
    (record.customers || []).forEach((c, i) => {
      if (c.name) {
        docPdf.text(`${i + 1}. ${c.name} (${c.type || ''})`, 18, y); y += 6;
        if (c.address) { docPdf.text(`Address: ${c.address}`, 22, y); y += 6; }
        if (c.phone)   { docPdf.text(`Phone: ${c.phone}`,   22, y); y += 6; }
        if (c.remark)  { docPdf.text(`Remark: ${c.remark}`, 22, y); y += 6; }
        (c.orders || []).forEach(o => {
          if (o.packaging && o.quantity) {
            docPdf.text(`Order: ${o.packaging} x ${o.quantity}`, 26, y); y += 6;
          }
        });
        y += 2;
      }
    });
    y += 4;
    docPdf.text('Notes:', 14, y);    y += 6;
    docPdf.text(record.notes   || '-', 18, y); y += 8;
    docPdf.text('Remarks:', 14, y);  y += 6;
    docPdf.text(record.remarks || '-', 18, y); y += 8;
    docPdf.text('Expenses:', 14, y); y += 6;
    const exp = record.expenses || { food: 0, fuel: 0, total: 0 };
    docPdf.text(`Food Allowance: ₹${exp.food} | Fuel: ₹${exp.fuel} | Total: ₹${exp.total}`, 18, y);
    docPdf.save(`DailyForm_${record.officerName || 'data'}_${record.date || ''}.pdf`);
  };

  // ── Comment modal (unchanged) ─────────────────────────────────────────────
  const openCommentModal  = (id, rev, txt) =>
    setCommentModal({ open: true, id, reviewer: rev || '', text: txt || '' });
  const closeCommentModal = () =>
    setCommentModal({ open: false, id: null, reviewer: '', text: '' });

  const saveComment = async () => {
    if (!commentModal.reviewer) return alert('Select reviewer');
    try {
      await updateDoc(doc(db, 'fieldOfficerForms', commentModal.id), {
        commentedBy:      commentModal.reviewer,
        commentText:      commentModal.text,
        commentTimestamp: new Date().toISOString(),
      });
      // Optimistic update + invalidate cache entry for current page
      const key = buildCacheKey(
        appliedFilters.officerFilter,
        appliedFilters.dateFrom,
        appliedFilters.dateTo,
        currentPage
      );
      historyCache.delete(key);
      setRecords(prev => prev.map(r =>
        r.id === commentModal.id
          ? { ...r, commentedBy: commentModal.reviewer, commentText: commentModal.text, commentTimestamp: new Date().toISOString() }
          : r
      ));
      closeCommentModal();
    } catch (e) {
      alert('Failed to save comment');
    }
  };

  // ── Delete (unchanged) ────────────────────────────────────────────────────
  const deleteReport = async (id) => {
    if (!window.confirm('Delete this report?')) return;
    try {
      await deleteDoc(doc(db, 'fieldOfficerForms', id));
      // Invalidate cache for current page (record count changed)
      historyCache.clear();
      setRecords(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      alert('Failed to delete');
    }
  };

  // ── Active filter badge helpers ───────────────────────────────────────────
  const hasActiveFilters =
    appliedFilters.officerFilter || appliedFilters.dateFrom || appliedFilters.dateTo;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="form-container" style={{ maxWidth: 900 }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ color: '#174ea6', fontWeight: 800, margin: 0 }}>Daily Form History</h2>
          {hasActiveFilters && (
            <span style={{
              background: '#e3f0fb', color: '#1E88E5', borderRadius: 20,
              padding: '3px 12px', fontSize: '0.85rem', fontWeight: 600,
            }}>
              🔍 Filtered
            </span>
          )}
        </div>

        {/* ── Filter Panel ── */}
        <div className="section-card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>

            {/* Officer Filter */}
            <div style={{ minWidth: 140, flex: 1 }}>
              <label style={{ marginBottom: 4, display: 'block' }}>Officer</label>
              <select value={officerFilter} onChange={e => setOfficerFilter(e.target.value)}>
                <option value="">All Officers</option>
                {officerList.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            {/* Date From */}
            <div style={{ minWidth: 140, flex: 1 }}>
              <label style={{ marginBottom: 4, display: 'block' }}>Date From</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>

            {/* Date To */}
            <div style={{ minWidth: 140, flex: 1 }}>
              <label style={{ marginBottom: 4, display: 'block' }}>Date To</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', paddingBottom: 2 }}>
              <button
                className="btn-primary w-auto"
                type="button"
                onClick={applyFilters}
                style={{ padding: '7px 18px' }}
              >
                Apply Filters
              </button>
              <button
                className="btn-outline w-auto"
                type="button"
                onClick={clearFilters}
                style={{ padding: '7px 14px', background: '#f1f5f9', color: '#64748b' }}
              >
                Clear
              </button>
            </div>
          </div>

          {/* Text search — client-side only */}
          <div style={{ marginTop: 10 }}>
            <input
              type="text"
              placeholder="Search location, customer, phone… (searches current page)"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ marginBottom: 0 }}
            />
          </div>

          {/* Cache info badge */}
          <div style={{ marginTop: 8, fontSize: '0.78rem', color: '#94a3b8' }}>
            💾 Cache: {historyCache.size} page(s) stored in memory
          </div>
        </div>

        {/* ── Table / States ── */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>⏳</div>
            Loading records…
          </div>
        ) : error ? (
          <div style={{ color: 'red', padding: 16 }}>{error}</div>
        ) : displayed.length === 0 ? (
          <div style={{ color: '#888', padding: '32px 0', textAlign: 'center' }}>
            {search ? 'No records match your search on this page.' : 'No reports found for the selected filters.'}
          </div>
        ) : (
          <table className="history-table" style={{ width: '100%' }}>
            <thead>
              <tr style={{ background: '#f7fafd' }}>
                <th>Date</th>
                <th>Officer</th>
                <th>Latest Comment</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map(r => (
                <React.Fragment key={r.id}>
                  {/* ── Row ── */}
                  <tr
                    style={{ background: expandedId === r.id ? '#e3edfa' : undefined, cursor: 'pointer' }}
                    onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                  >
                    <td>{r.date || '-'}</td>
                    <td>{r.officerName || '-'}</td>
                    <td style={{ fontSize: '0.95em' }}>
                      {r.commentedBy && r.commentText ? (
                        <span>
                          Commented by <b>{r.commentedBy}</b><br />
                          <span style={{ fontSize: '0.88em', color: '#555' }}>
                            {r.commentTimestamp ? new Date(r.commentTimestamp).toLocaleString() : ''}
                          </span>
                        </span>
                      ) : (
                        <span style={{ color: '#aaa' }}>No comment</span>
                      )}
                    </td>
                    <td style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button title="Download PDF"  className="btn-glow w-auto"   type="button" onClick={e => { e.stopPropagation(); exportRecordToPDF(r); }}>🧾</button>
                      <button title="View"          className="btn-outline w-auto" type="button" onClick={e => { e.stopPropagation(); setExpandedId(expandedId === r.id ? null : r.id); }}>👁</button>
                      <button title="Edit"          className="btn-outline w-auto" type="button" disabled>✏️</button>
                      <button title="Delete"        className="btn-outline w-auto" type="button" onClick={e => { e.stopPropagation(); deleteReport(r.id); }}>🗑️</button>
                      <button title={r.commentedBy ? 'Edit Comment' : 'Add Comment'} className="btn-outline w-auto" type="button" onClick={e => { e.stopPropagation(); openCommentModal(r.id, r.commentedBy, r.commentText); }}>💬</button>
                    </td>
                  </tr>

                  {/* ── Expanded Detail Row ── */}
                  {expandedId === r.id && (
                    <tr>
                      <td colSpan={4} style={{ background: '#f7fafd', padding: 0 }}>
                        <div className="section-card" style={{ margin: 0, border: 'none', boxShadow: 'none', padding: '16px 8px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
                            <div style={{ minWidth: 220, flex: 1 }}>
                              <strong>Officer:</strong> {r.officerName || '-'}<br />
                              <strong>Date:</strong> {r.date || '-'}<br />
                              <strong>Working Type:</strong> {r.workingType || '-'}<br />
                              <strong>KMs Travelled:</strong> {r.kms || '-'}<br />
                              <strong>Entry By:</strong> {r.entryBy || '-'}<br />
                              <strong>Reviewer:</strong> {r.reviewer || '-'}<br />
                              <strong>Reviewer Comment:</strong> {r.reviewerComment || '-'}<br />
                            </div>
                            <div style={{ minWidth: 220, flex: 2 }}>
                              <strong>Visited Locations:</strong>
                              <ul style={{ margin: '4px 0 8px 16px' }}>
                                {(r.locations || []).filter(Boolean).map((loc, i) => <li key={i}>{loc}</li>)}
                              </ul>
                              <strong>Customers:</strong>
                              <ul style={{ margin: '4px 0 8px 16px' }}>
                                {(r.customers || []).filter(c => c.name).map((c, i) => (
                                  <li key={i}>
                                    <b>{c.name}</b> {c.phone ? `(${c.phone})` : ''} {c.type ? `- ${c.type}` : ''}<br />
                                    {c.orders && c.orders.length > 0 && (
                                      <span>Orders: {c.orders.map(o => `${o.packaging} x ${o.quantity}`).join(', ')}</span>
                                    )}<br />
                                    {c.address && <span>Address: {c.address}<br /></span>}
                                    {c.remark  && <span>Remark: {c.remark}<br /></span>}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div style={{ minWidth: 220, flex: 1 }}>
                              <strong>Notes:</strong><br />
                              <span style={{ whiteSpace: 'pre-line' }}>{r.notes || '-'}</span><br />
                              <strong>Remarks:</strong><br />
                              <span style={{ whiteSpace: 'pre-line' }}>{r.remarks || '-'}</span><br />
                              <strong>Expense Summary:</strong><br />
                              <span>
                                Food: ₹{r.expenses?.food  ?? '-'}<br />
                                Fuel: ₹{r.expenses?.fuel  ?? '-'}<br />
                                Total: ₹{r.expenses?.total ?? '-'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}

        {/* ── Pagination Controls ── */}
        {!loading && !error && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 16, marginTop: 20, padding: '12px 0',
          }}>
            <button
              className="btn-outline w-auto"
              type="button"
              onClick={goPrev}
              disabled={currentPage === 0}
              style={{
                padding: '8px 20px', fontWeight: 700,
                opacity: currentPage === 0 ? 0.4 : 1,
                cursor: currentPage === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              ← Prev
            </button>

            <span style={{
              background: '#e3f0fb', color: '#1E88E5', borderRadius: 20,
              padding: '5px 18px', fontWeight: 700, fontSize: '0.95rem',
            }}>
              Page {currentPage + 1}
            </span>

            <button
              className="btn-primary w-auto"
              type="button"
              onClick={goNext}
              disabled={!hasMore}
              style={{
                padding: '8px 20px', fontWeight: 700,
                opacity: !hasMore ? 0.4 : 1,
                cursor: !hasMore ? 'not-allowed' : 'pointer',
              }}
            >
              Next →
            </button>
          </div>
        )}

        {/* ── Comment Modal ── */}
        {commentModal.open && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: '#0006', zIndex: 1000, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <div className="section-card" style={{
              background: '#fff', borderRadius: 12, padding: 24,
              minWidth: 320, maxWidth: 400, boxShadow: '0 2px 24px #2563eb33',
            }}>
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>Add / Edit Comment</h3>
              <label>Reviewer:</label>
              <select
                value={commentModal.reviewer}
                onChange={e => setCommentModal(m => ({ ...m, reviewer: e.target.value }))}
                style={{ width: '100%', marginBottom: 8 }}
              >
                <option value="">Select Reviewer</option>
                {REVIEWERS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <label>Comment:</label>
              <textarea
                value={commentModal.text}
                onChange={e => setCommentModal(m => ({ ...m, text: e.target.value }))}
                style={{ width: '100%', minHeight: 60, marginBottom: 16 }}
              />
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button className="btn-outline" type="button" onClick={closeCommentModal}>Cancel</button>
                <button className="btn-primary" type="button" onClick={saveComment}>Save</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
