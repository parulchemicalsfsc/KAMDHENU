import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import Navbar from '../components/Navbar';
import { db } from '../firebase';
import {
  collection, getDocs, query, orderBy, where,
  limit, startAfter, updateDoc, doc
} from 'firebase/firestore';
import '../style/History.css';
import '../style/DailyForm.css';

// ── In-Memory Cache ───────────────────────────────────────────────────────────
const historyCache = new Map();
const PAGE_SIZE = 10;

function buildCacheKey(tab, officer, dateFrom, dateTo, pageIndex) {
  return `${tab}|officer=${officer}|from=${dateFrom}|to=${dateTo}|page=${pageIndex}`;
}

// ── Sample MoM fallback (shown if Firebase has no records) ───────────────────
const SAMPLE_MOMS = [
  {
    id: 'sample-mom-1',
    meetingName: 'Weekly Sales Review',
    date: '2025-06-28',
    participants: ['JASH ILASARIYA', 'SONAL MADAM', 'MAULIC SHAH', 'JIGAR SHAH'],
    manualParticipant: '',
    points: [
      'Reviewed demo sales targets for Q2',
      'Discussed new village outreach strategy',
      'Action: Follow up with pending leads by Friday',
      'Stock level check — reorder 5LTR PLASTIC JAR',
    ],
    summary: {
      discussion: '1. Reviewed demo sales targets for Q2\n2. Discussed new village outreach strategy\n3. Action: Follow up with pending leads by Friday\n4. Stock level check — reorder 5LTR PLASTIC JAR',
      actions: '• Action: Follow up with pending leads by Friday',
    },
    image: null,
    timestamp: null,
  },
  {
    id: 'sample-mom-2',
    meetingName: 'Monthly Planning Meeting',
    date: '2025-06-14',
    participants: ['BHAVIN PRAJAPATI', 'PARUL BEN', 'SHUBHAM', 'OMKAR SIR'],
    manualParticipant: 'Alpesh Patel',
    points: [
      'Q3 demo targets set for all officers',
      'Team assignments for upcoming village demos',
      'To Do: Update member registration list',
    ],
    summary: {
      discussion: '1. Q3 demo targets set for all officers\n2. Team assignments for upcoming village demos\n3. To Do: Update member registration list',
      actions: '• To Do: Update member registration list',
    },
    image: null,
    timestamp: null,
  },
];

// ── Main Component ────────────────────────────────────────────────────────────
export default function HistoryPage() {
  // Tab: 'field' | 'demo' | 'mom'
  const [activeTab, setActiveTab] = useState('field');

  // Data
  const [fieldData, setFieldData]   = useState([]);
  const [demoData, setDemoData]     = useState([]);
  const [loading, setLoading]       = useState(true);

  // Filters
  const [officerFilter, setOfficerFilter] = useState('All');
  const [dateFrom, setDateFrom]           = useState('');
  const [dateTo, setDateTo]               = useState('');
  const [searchQuery, setSearchQuery]     = useState('');

  const [appliedFilters, setAppliedFilters] = useState({ officer: 'All', dateFrom: '', dateTo: '' });

  // Pagination
  const [currentPage, setCurrentPage] = useState(0);
  const [pageCursors, setPageCursors] = useState([null]);
  const [hasMore, setHasMore]         = useState(false);

  // Officer dropdown
  const [officerList, setOfficerList] = useState([]);

  // View modal
  const [viewModalRecord, setViewModalRecord] = useState(null);

  // Edit modal
  const [editModalRecord, setEditModalRecord] = useState(null);
  const [editSaving, setEditSaving]           = useState(false);

  // MoM tab
  const [momData, setMomData]         = useState([]);
  const [momLoading, setMomLoading]   = useState(false);
  const [expandedMomId, setExpandedMomId] = useState(null);

  // ── Fetch officer list ──────────────────────────────────────────────────
  useEffect(() => {
    async function fetchOfficerList() {
      try {
        const snap = await getDocs(
          query(collection(db, 'fieldOfficerForms'), orderBy('createdAt', 'desc'), limit(200))
        );
        const names = new Set();
        snap.docs.forEach(d => { const n = d.data().officerName; if (n) names.add(n); });
        setOfficerList(Array.from(names).sort());
      } catch (_) {}
    }
    fetchOfficerList();
  }, []);

  // ── Fetch MoM data when MoM tab is active ──────────────────────────────
  useEffect(() => {
    if (activeTab !== 'mom') return;
    setMomLoading(true);
    getDocs(query(collection(db, 'demo_moms'), orderBy('timestamp', 'desc')))
      .then(snap => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setMomData(docs.length > 0 ? docs : SAMPLE_MOMS);
        setMomLoading(false);
      })
      .catch(() => {
        setMomData(SAMPLE_MOMS);
        setMomLoading(false);
      });
  }, [activeTab]);

  // ── Core fetch function ─────────────────────────────────────────────────
  const fetchPage = useCallback(async (tab, pageIndex, cursors, filters) => {
    if (tab === 'mom') return; // MoM has its own fetch
    const { officer, dateFrom, dateTo } = filters;
    const collectionName = tab === 'field' ? 'fieldOfficerForms' : 'demoForms';

    const cacheKey = buildCacheKey(tab, officer, dateFrom, dateTo, pageIndex);
    if (historyCache.has(cacheKey)) {
      const cached = historyCache.get(cacheKey);
      if (tab === 'field') setFieldData(cached.records);
      else setDemoData(cached.records);
      setHasMore(cached.hasMore);
      setLoading(false);
      return;
    }

    const constraints = [];
    let officerClientSide = '';
    const hasDateFilter    = !!(dateFrom || dateTo);
    const hasOfficerFilter = tab === 'field' && officer && officer !== 'All';

    if (hasDateFilter && hasOfficerFilter) {
      if (dateFrom) constraints.push(where('date', '>=', dateFrom));
      if (dateTo)   constraints.push(where('date', '<=', dateTo));
      constraints.push(orderBy('date', 'desc'));
      officerClientSide = officer;
    } else if (hasDateFilter) {
      if (dateFrom) constraints.push(where('date', '>=', dateFrom));
      if (dateTo)   constraints.push(where('date', '<=', dateTo));
      constraints.push(orderBy('date', 'desc'));
    } else if (hasOfficerFilter) {
      constraints.push(where('officerName', '==', officer));
    } else {
      constraints.push(orderBy('createdAt', 'desc'));
    }

    const cursor = cursors[pageIndex];
    if (cursor) constraints.push(startAfter(cursor));
    constraints.push(limit(PAGE_SIZE + 1));

    const q = query(collection(db, collectionName), ...constraints);
    const snap = await getDocs(q);

    const hasMoreData = snap.docs.length > PAGE_SIZE;
    const pageDocs    = hasMoreData ? snap.docs.slice(0, PAGE_SIZE) : snap.docs;
    let fetched       = pageDocs.map(d => ({ id: d.id, ...d.data() }));
    if (officerClientSide) fetched = fetched.filter(r => r.officerName === officerClientSide);

    if (pageDocs.length > 0) {
      setPageCursors(prev => {
        const updated = [...prev];
        updated[pageIndex + 1] = pageDocs[pageDocs.length - 1];
        return updated;
      });
    }

    historyCache.set(cacheKey, { records: fetched, hasMore: hasMoreData });
    if (tab === 'field') setFieldData(fetched);
    else setDemoData(fetched);
    setHasMore(hasMoreData);
    setLoading(false);
  }, []);

  // Trigger fetch for field/demo tabs
  useEffect(() => {
    if (activeTab === 'mom') return;
    setLoading(true);
    fetchPage(activeTab, currentPage, pageCursors, appliedFilters).catch(err => {
      console.error('Error fetching history:', err);
      toast.error('Could not load history. Please check your connection.');
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, currentPage, appliedFilters]);

  // ── Tab switch ──────────────────────────────────────────────────────────
  const switchTab = (tab) => {
    setActiveTab(tab);
    setCurrentPage(0);
    setPageCursors([null]);
    setSearchQuery('');
    setExpandedMomId(null);
  };

  // ── Filter actions ──────────────────────────────────────────────────────
  const applyFilters = () => {
    historyCache.clear();
    setCurrentPage(0);
    setPageCursors([null]);
    setAppliedFilters({ officer: officerFilter, dateFrom, dateTo });
  };

  const clearFilters = () => {
    setOfficerFilter('All'); setDateFrom(''); setDateTo(''); setSearchQuery('');
    historyCache.clear();
    setCurrentPage(0);
    setPageCursors([null]);
    setAppliedFilters({ officer: 'All', dateFrom: '', dateTo: '' });
  };

  // ── Pagination ──────────────────────────────────────────────────────────
  const goNext = () => setCurrentPage(p => p + 1);
  const goPrev = () => setCurrentPage(p => Math.max(0, p - 1));

  // ── Search + data ───────────────────────────────────────────────────────
  const hasActiveFilters = appliedFilters.officer !== 'All' || appliedFilters.dateFrom || appliedFilters.dateTo;
  const rawData = activeTab === 'field' ? fieldData : demoData;

  const currentData = searchQuery.trim()
    ? rawData.filter(r => {
        const q = searchQuery.toLowerCase();
        return (
          (r.officerName || '').toLowerCase().includes(q) ||
          (r.date || '').includes(q) ||
          (r.village || '').toLowerCase().includes(q) ||
          (r.demoName || '').toLowerCase().includes(q) ||
          (r.entryBy || '').toLowerCase().includes(q) ||
          (r.locations || []).join(' ').toLowerCase().includes(q)
        );
      })
    : rawData;

  // ── MoM PDF ─────────────────────────────────────────────────────────────
  const generateMomPDF = async (mom) => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      let y = 16;

      doc.setFillColor(13, 110, 253);
      doc.rect(0, 0, 210, 28, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(15);
      doc.setFont('helvetica', 'bold');
      doc.text('Minutes of Meeting', 14, 18);
      y = 36;

      doc.setTextColor(13, 110, 253);
      doc.setFontSize(13);
      doc.text(mom.meetingName || 'Untitled Meeting', 14, y); y += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text(`Date: ${mom.date || '-'}`, 14, y); y += 7;
      if (mom.location?.lat) { doc.text(`Location: ${mom.location.lat}, ${mom.location.lng}`, 14, y); y += 7; }
      y += 3;

      const allP = [...(Array.isArray(mom.participants) ? mom.participants : []), mom.manualParticipant].filter(Boolean);
      if (allP.length) {
        doc.setFont('helvetica', 'bold'); doc.setTextColor(13, 110, 253);
        doc.text(`Participants (${allP.length}):`, 14, y); y += 6;
        doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 50);
        allP.forEach(p => { if (y > 272) { doc.addPage(); y = 15; } doc.text(`• ${p}`, 20, y); y += 5; });
        y += 3;
      }

      if ((mom.points || []).length) {
        if (y > 250) { doc.addPage(); y = 15; }
        doc.setFont('helvetica', 'bold'); doc.setTextColor(13, 110, 253);
        doc.text('Discussion Points:', 14, y); y += 6;
        doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 50);
        mom.points.forEach((pt, i) => {
          if (y > 272) { doc.addPage(); y = 15; }
          const lines = doc.splitTextToSize(`${i + 1}. ${pt}`, 174);
          doc.text(lines, 20, y); y += lines.length * 5 + 2;
        });
      }

      if (mom.summary?.actions) {
        y += 4;
        if (y > 250) { doc.addPage(); y = 15; }
        doc.setFont('helvetica', 'bold'); doc.setTextColor(185, 28, 28);
        doc.text('Action Items:', 14, y); y += 6;
        doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 50);
        const lines = doc.splitTextToSize(mom.summary.actions, 174);
        lines.forEach(l => { if (y > 275) { doc.addPage(); y = 15; } doc.text(l, 20, y); y += 5; });
      }

      doc.save(`MoM_${(mom.meetingName || 'meeting').replace(/\s+/g, '_')}_${mom.date || ''}.pdf`);
      toast.success('PDF exported! 📄');
    } catch (e) {
      toast.error('PDF export failed');
    }
  };

  // ── Save Edit ────────────────────────────────────────────────────────────
  const handleSaveEdit = async (updatedRecord) => {
    setEditSaving(true);
    try {
      const isField = (updatedRecord.reportId || '').startsWith('#RF-');
      const collectionName = isField ? 'fieldOfficerForms' : 'demoForms';
      const { reportId, initials, status: _s, ...dataToSave } = updatedRecord;
      await updateDoc(doc(db, collectionName, updatedRecord.id), dataToSave);
      // Update local state
      historyCache.clear();
      if (isField) {
        setFieldData(prev => prev.map(r => r.id === updatedRecord.id ? { ...r, ...dataToSave } : r));
      } else {
        setDemoData(prev => prev.map(r => r.id === updatedRecord.id ? { ...r, ...dataToSave } : r));
      }
      toast.success('Record updated successfully! ✓');
      setEditModalRecord(null);
    } catch (e) {
      toast.error('Update failed: ' + e.message);
    }
    setEditSaving(false);
  };

  // ── View Modal ──────────────────────────────────────────────────────────
  const ViewModal = ({ record, onClose }) => {
    if (!record) return null;
    const isField = (record.reportId || '').startsWith('#RF-');
    return (
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{ background: '#fff', borderRadius: 16, padding: '28px 24px', maxWidth: 560, width: '100%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '2px solid #e0eaff', paddingBottom: 12 }}>
            <h3 style={{ margin: 0, color: '#1e40af', fontWeight: 800, fontSize: '1.1rem' }}>
              {isField ? '📋 Field Daily Form Details' : '📊 Demo Sales Details'}
            </h3>
            <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontWeight: 700, fontSize: '1rem' }}>✕</button>
          </div>

          {isField ? (
            <div style={{ lineHeight: 1.9, fontSize: '0.9rem', color: '#334155' }}>
              <Row label="Officer" val={record.officerName} />
              <Row label="Date" val={record.date} />
              <Row label="Working Type" val={record.workingType} />
              <Row label="KMs Travelled" val={record.kms} />
              <Row label="Punch In" val={record.punchIn} />
              <Row label="Punch Out" val={record.punchOut} />
              <Row label="Total Hours" val={record.hours} />
              <Row label="Entry By" val={record.entryBy} />
              <Row label="Reviewer" val={record.reviewer} />
              <Row label="Reviewer Comment" val={record.reviewerComment} />
              {(record.locations || []).filter(Boolean).length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <strong style={{ color: '#1e40af' }}>Visited Locations:</strong>
                  <ul style={{ margin: '4px 0 0 16px' }}>
                    {record.locations.filter(Boolean).map((l, i) => <li key={i}>{l}</li>)}
                  </ul>
                </div>
              )}
              {(record.customers || []).filter(c => c.name).length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <strong style={{ color: '#1e40af' }}>Customers:</strong>
                  <ul style={{ margin: '4px 0 0 16px' }}>
                    {record.customers.filter(c => c.name).map((c, i) => (
                      <li key={i} style={{ marginBottom: 4 }}>
                        <b>{c.name}</b> {c.phone ? `(${c.phone})` : ''} {c.type ? `- ${c.type}` : ''}
                        {(c.orders || []).length > 0 && (
                          <div style={{ fontSize: '0.82rem', color: '#64748b' }}>Orders: {c.orders.map(o => `${o.packaging} x ${o.quantity}`).join(', ')}</div>
                        )}
                        {c.remark && <div style={{ fontSize: '0.82rem', color: '#64748b' }}>Remark: {c.remark}</div>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <Row label="Notes" val={record.notes} />
              <Row label="Remarks" val={record.remarks} />
              <div style={{ marginTop: 10, padding: '10px 14px', background: '#f0f7ff', borderRadius: 8 }}>
                <strong style={{ color: '#1e40af' }}>Expenses:</strong>
                <div>Food: ₹{record.expenses?.food ?? '-'} &nbsp;|&nbsp; Fuel: ₹{record.expenses?.fuel ?? '-'} &nbsp;|&nbsp; <b>Total: ₹{record.expenses?.total ?? '-'}</b></div>
              </div>
            </div>
          ) : (
            <div style={{ lineHeight: 1.9, fontSize: '0.9rem', color: '#334155' }}>
              <Row label="Demo Name" val={record.demoName || record.village} />
              <Row label="Village" val={record.village} />
              <Row label="Date" val={record.date} />
              <Row label="Taluka" val={record.taluka} />
              <Row label="Mantri" val={record.mantri} />
              <Row label="Total Milk" val={record.totalMilk} />
              <Row label="Active Sabhasad" val={record.activeSabhasad} />
              <Row label="Team Members" val={record.teamMembers} />
              <Row label="Entry By" val={record.entryBy} />
              <Row label="Demo Remarks" val={record.demoRemarks} />
              {(record.customers || []).length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <strong style={{ color: '#1e40af' }}>Customers:</strong>
                  <ul style={{ margin: '4px 0 0 16px' }}>
                    {record.customers.map((c, i) => (
                      <li key={i}><b>{c.name}</b> ({c.mobile || '-'}) — {c.orderPackaging} × {c.orderQty} {c.remarks ? `| ${c.remarks}` : ''}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 20, textAlign: 'right' }}>
            <button onClick={onClose} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 24px', fontWeight: 700, cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      </div>
    );
  };

  // ── Edit Modal ──────────────────────────────────────────────────────────
  const EditModal = ({ record, onClose }) => {
    if (!record) return null;
    const isField = (record.reportId || '').startsWith('#RF-');
    const [form, setForm] = useState({ ...record });
    const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));
    const setExp = (key, val) => setForm(prev => ({ ...prev, expenses: { ...(prev.expenses || {}), [key]: val } }));

    const inputStyle = {
      width: '100%', border: '1.5px solid #b6c7e6', borderRadius: 8,
      padding: '8px 10px', fontFamily: 'inherit', fontSize: '0.88rem',
      background: '#f8faff', outline: 'none', boxSizing: 'border-box',
    };
    const labelStyle = { fontWeight: 700, color: '#1e40af', fontSize: '0.8rem', display: 'block', marginBottom: 4 };
    const fieldStyle = { marginBottom: 14 };

    return (
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{ background: '#fff', borderRadius: 16, padding: '28px 24px', maxWidth: 600, width: '100%', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.25)' }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '2px solid #e0eaff', paddingBottom: 12 }}>
            <h3 style={{ margin: 0, color: '#1e40af', fontWeight: 800, fontSize: '1.1rem' }}>
              ✏️ Edit {isField ? 'Field Daily Form' : 'Demo Sales'} Record
            </h3>
            <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontWeight: 700, fontSize: '1rem' }}>✕</button>
          </div>

          {isField ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Officer Name</label>
                  <input style={inputStyle} value={form.officerName || ''} onChange={e => set('officerName', e.target.value)} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Date</label>
                  <input type="date" style={inputStyle} value={form.date || ''} onChange={e => set('date', e.target.value)} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Working Type</label>
                  <input style={inputStyle} value={form.workingType || ''} onChange={e => set('workingType', e.target.value)} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>KMs Travelled</label>
                  <input style={inputStyle} value={form.kms || ''} onChange={e => set('kms', e.target.value)} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Punch In</label>
                  <input style={inputStyle} value={form.punchIn || ''} onChange={e => set('punchIn', e.target.value)} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Punch Out</label>
                  <input style={inputStyle} value={form.punchOut || ''} onChange={e => set('punchOut', e.target.value)} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Total Hours</label>
                  <input style={inputStyle} value={form.hours || ''} onChange={e => set('hours', e.target.value)} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Reviewer</label>
                  <input style={inputStyle} value={form.reviewer || ''} onChange={e => set('reviewer', e.target.value)} />
                </div>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Reviewer Comment</label>
                <input style={inputStyle} value={form.reviewerComment || ''} onChange={e => set('reviewerComment', e.target.value)} />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Notes</label>
                <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Remarks</label>
                <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={form.remarks || ''} onChange={e => set('remarks', e.target.value)} />
              </div>
              <div style={{ background: '#f0f7ff', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
                <label style={{ ...labelStyle, marginBottom: 10 }}>💰 Expenses</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ ...labelStyle, color: '#64748b' }}>Food (₹)</label>
                    <input style={inputStyle} value={form.expenses?.food || ''} onChange={e => setExp('food', e.target.value)} />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, color: '#64748b' }}>Fuel (₹)</label>
                    <input style={inputStyle} value={form.expenses?.fuel || ''} onChange={e => setExp('fuel', e.target.value)} />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, color: '#64748b' }}>Total (₹)</label>
                    <input style={inputStyle} value={form.expenses?.total || ''} onChange={e => setExp('total', e.target.value)} />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Demo Name</label>
                  <input style={inputStyle} value={form.demoName || ''} onChange={e => set('demoName', e.target.value)} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Village</label>
                  <input style={inputStyle} value={form.village || ''} onChange={e => set('village', e.target.value)} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Date</label>
                  <input type="date" style={inputStyle} value={form.date || ''} onChange={e => set('date', e.target.value)} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Taluka</label>
                  <input style={inputStyle} value={form.taluka || ''} onChange={e => set('taluka', e.target.value)} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Mantri</label>
                  <input style={inputStyle} value={form.mantri || ''} onChange={e => set('mantri', e.target.value)} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Total Milk</label>
                  <input style={inputStyle} value={form.totalMilk || ''} onChange={e => set('totalMilk', e.target.value)} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Active Sabhasad</label>
                  <input style={inputStyle} value={form.activeSabhasad || ''} onChange={e => set('activeSabhasad', e.target.value)} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Team Members</label>
                  <input style={inputStyle} value={form.teamMembers || ''} onChange={e => set('teamMembers', e.target.value)} />
                </div>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Demo Remarks</label>
                <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={form.demoRemarks || ''} onChange={e => set('demoRemarks', e.target.value)} />
              </div>
            </>
          )}

          {/* Footer buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8, paddingTop: 16, borderTop: '1px solid #e0eaff' }}>
            <button
              onClick={onClose}
              style={{ padding: '10px 22px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}
            >Cancel</button>
            <button
              onClick={() => handleSaveEdit(form)}
              disabled={editSaving}
              style={{ padding: '10px 26px', background: editSaving ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: editSaving ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}
            >
              {editSaving ? '⏳ Saving...' : '💾 Save Changes'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'sans-serif', paddingBottom: 80 }}>
      <Navbar />

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>

        {/* ── Tab Buttons ── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { key: 'field', label: '📋 Field Daily Form History' },
            { key: 'demo',  label: '📊 Demo Sales History' },
            { key: 'mom',   label: '🗒️ MoM History' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => switchTab(tab.key)}
              style={{
                padding: '10px 22px', borderRadius: 14, fontWeight: 700, fontSize: '0.9rem',
                border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                background: activeTab === tab.key ? '#3b82f6' : '#fff',
                color: activeTab === tab.key ? '#fff' : '#64748b',
                boxShadow: activeTab === tab.key ? '0 6px 20px rgba(59,130,246,0.35)' : '0 1px 4px rgba(0,0,0,0.06)',
              }}
            >{tab.label}</button>
          ))}
        </div>

        {/* ── MoM Tab Content ── */}
        {activeTab === 'mom' ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontWeight: 800, color: '#1e293b', fontSize: '1.2rem' }}>🗒️ Minutes of Meeting Records</h2>
              <span style={{ background: '#dbeafe', color: '#1d4ed8', borderRadius: 20, padding: '3px 14px', fontWeight: 700, fontSize: '0.82rem' }}>
                {momData.length} record{momData.length !== 1 ? 's' : ''}
              </span>
            </div>

            {momLoading ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>⏳</div>
                Loading MoM records...
              </div>
            ) : (
              <div style={{ borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}>
                {momData.map((mom, idx) => {
                  const isExpanded = expandedMomId === mom.id;
                  const allP = [...(Array.isArray(mom.participants) ? mom.participants : []), mom.manualParticipant].filter(Boolean);
                  const dateStr = mom.date || (mom.timestamp?.toDate ? mom.timestamp.toDate().toLocaleDateString('en-IN') : '—');

                  return (
                    <div key={mom.id} style={{ borderBottom: idx < momData.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                      {/* Accordion Header */}
                      <div
                        onClick={() => setExpandedMomId(prev => prev === mom.id ? null : mom.id)}
                        style={{
                          padding: '14px 20px', display: 'flex', justifyContent: 'space-between',
                          alignItems: 'center', cursor: 'pointer',
                          background: isExpanded ? '#eff6ff' : '#fff',
                          transition: 'background 0.2s', userSelect: 'none',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
                          <div style={{
                            width: 44, height: 44, borderRadius: '50%',
                            border: `2px solid ${isExpanded ? '#3b82f6' : '#93c5fd'}`,
                            background: mom.image ? 'transparent' : '#eff6ff',
                            overflow: 'hidden', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {mom.image ? <img src={mom.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '1.2rem' }}>🗒️</span>}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 800, color: isExpanded ? '#1e40af' : '#1e293b', fontSize: '0.98rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {mom.meetingName || 'Untitled Meeting'}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <span>📅 {dateStr}</span>
                              <span>•</span>
                              <span>👥 {allP.length} participants</span>
                              <span>•</span>
                              <span>📌 {(mom.points || []).length} points</span>
                            </div>
                          </div>
                        </div>
                        <span style={{ background: isExpanded ? '#dbeafe' : '#f0f7ff', color: '#2563eb', borderRadius: 20, padding: '3px 12px', fontSize: '0.8rem', fontWeight: 700, border: '1px solid #bfdbfe', whiteSpace: 'nowrap', marginLeft: 10 }}>
                          {isExpanded ? '▲ Hide' : '▼ Show'}
                        </span>
                      </div>

                      {/* Accordion Body */}
                      {isExpanded && (
                        <div style={{ padding: '16px 20px 20px', background: '#f8fbff', borderTop: '1px solid #dbeafe' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
                            {mom.image && (
                              <img src={mom.image} alt="meeting" style={{ width: 100, height: 100, borderRadius: 10, objectFit: 'cover', border: '2px solid #93c5fd', flexShrink: 0 }} />
                            )}
                            <div style={{ flex: 1, minWidth: 200 }}>
                              {allP.length > 0 && (
                                <div style={{ marginBottom: 12 }}>
                                  <div style={{ fontWeight: 700, color: '#1e40af', marginBottom: 6, fontSize: '0.85rem' }}>👥 Participants</div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                    {allP.map((p, i) => <span key={i} style={{ background: '#dbeafe', color: '#1d4ed8', borderRadius: 20, padding: '2px 9px', fontSize: '0.78rem', fontWeight: 600 }}>{p}</span>)}
                                  </div>
                                </div>
                              )}
                              {(mom.points || []).length > 0 && (
                                <div style={{ marginBottom: 12 }}>
                                  <div style={{ fontWeight: 700, color: '#1e40af', marginBottom: 6, fontSize: '0.85rem' }}>📌 Discussion Points</div>
                                  <ol style={{ margin: 0, paddingLeft: 18, color: '#334155' }}>
                                    {mom.points.map((pt, i) => <li key={i} style={{ marginBottom: 3, fontSize: '0.85rem' }}>{pt}</li>)}
                                  </ol>
                                </div>
                              )}
                              {mom.summary?.actions && (
                                <div style={{ padding: '8px 12px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
                                  <div style={{ fontWeight: 700, color: '#b91c1c', marginBottom: 4, fontSize: '0.82rem' }}>⚡ Action Items</div>
                                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#7f1d1d', fontSize: '0.82rem', fontFamily: 'inherit' }}>{mom.summary.actions}</pre>
                                </div>
                              )}
                            </div>
                          </div>
                          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                            <button onClick={() => generateMomPDF(mom)} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
                              📄 Export PDF
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* ── Filters Card ── */}
            <div style={{ background: '#fff', borderRadius: 20, padding: '20px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', border: '1px solid rgba(241,245,249,0.8)', marginBottom: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 14 }}>
                {activeTab === 'field' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Officer</label>
                    <select
                      value={officerFilter}
                      onChange={e => setOfficerFilter(e.target.value)}
                      style={{ width: '100%', background: '#f1f5f9', border: 'none', borderRadius: 14, padding: '10px 16px', color: '#334155', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
                    >
                      <option value="All">All</option>
                      {officerList.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Date From</label>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: '100%', background: '#f1f5f9', border: 'none', borderRadius: 14, padding: '10px 16px', color: '#334155', fontWeight: 600, outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Date To</label>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: '100%', background: '#f1f5f9', border: 'none', borderRadius: 14, padding: '10px 16px', color: '#334155', fontWeight: 600, outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }} />
                </div>
              </div>

              {/* Search bar */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>🔍 Search</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={activeTab === 'field' ? 'Search by officer name, location, date...' : 'Search by village, demo name, entry by...'}
                  style={{ width: '100%', background: '#f1f5f9', border: 'none', borderRadius: 14, padding: '10px 16px', color: '#334155', fontWeight: 500, outline: 'none', boxSizing: 'border-box', fontSize: '0.9rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={applyFilters}
                  style={{ padding: '10px 22px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 14, fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.35)' }}
                >🔍 Apply Filters</button>
                <button
                  onClick={clearFilters}
                  style={{ padding: '10px 18px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 14, fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer' }}
                >✕ Clear</button>
                {hasActiveFilters && (
                  <span style={{ padding: '5px 14px', background: '#dbeafe', color: '#2563eb', borderRadius: 20, fontSize: '0.78rem', fontWeight: 700 }}>🔍 Filtered</span>
                )}
                {searchQuery && (
                  <span style={{ padding: '5px 14px', background: '#f0fdf4', color: '#16a34a', borderRadius: 20, fontSize: '0.78rem', fontWeight: 700 }}>
                    Found {currentData.length} result{currentData.length !== 1 ? 's' : ''}
                  </span>
                )}
                <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>
                  💾 Cache: {historyCache.size} page(s)
                </span>
              </div>
            </div>

            {/* ── Loading ── */}
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
                <div style={{ width: 44, height: 44, border: '4px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: 16 }} />
                <p style={{ color: '#94a3b8', fontWeight: 700 }}>Loading history...</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px', marginBottom: 16 }}>
                  <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>
                    {activeTab === 'field' ? '📋 Field Daily Form Reports' : '📊 Demo Sales Reports'}
                  </h2>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 700 }}>
                    {currentData.length} record{currentData.length !== 1 ? 's' : ''} on this page
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {currentData.length > 0 ? (
                    currentData.map(report => (
                      <ReportCard
                        key={report.id}
                        report={{
                          ...report,
                          reportId: report.reportId || (activeTab === 'field'
                            ? `#RF-${report.id.slice(-5).toUpperCase()}`
                            : `#DS-${report.id.slice(-5).toUpperCase()}`),
                          initials: activeTab === 'field'
                            ? (report.officerName?.split(' ').map(n => n[0]).join('').toUpperCase() || '??')
                            : (report.village?.slice(0, 2).toUpperCase() || report.demoName?.slice(0, 2).toUpperCase() || 'DS'),
                          status: report.status || 'COMPLETED',
                          ...(activeTab === 'demo' && {
                            officerName: report.demoName || report.village || 'Demo Site',
                            workingType: `Entry By: ${report.entryBy || 'System'}`,
                          }),
                        }}
                        onView={() => setViewModalRecord({
                          ...report,
                          reportId: activeTab === 'field' ? `#RF-${report.id.slice(-5).toUpperCase()}` : `#DS-${report.id.slice(-5).toUpperCase()}`,
                        })}
                        onEdit={() => setEditModalRecord({
                          ...report,
                          reportId: activeTab === 'field' ? `#RF-${report.id.slice(-5).toUpperCase()}` : `#DS-${report.id.slice(-5).toUpperCase()}`,
                        })}
                      />
                    ))
                  ) : (
                    <div style={{ textAlign: 'center', padding: 80, background: '#fff', borderRadius: 24, border: '2px dashed #e2e8f0' }}>
                      <p style={{ color: '#94a3b8', fontWeight: 700, fontSize: '1rem' }}>
                        {hasActiveFilters || searchQuery ? 'No records match the selected filters.' : 'No records found.'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Pagination */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 32 }}>
                  <button
                    onClick={goPrev}
                    disabled={currentPage === 0}
                    style={{
                      padding: '10px 22px', borderRadius: 14, fontWeight: 700, fontSize: '0.88rem', border: 'none', cursor: currentPage === 0 ? 'not-allowed' : 'pointer',
                      background: currentPage === 0 ? '#f1f5f9' : '#fff',
                      color: currentPage === 0 ? '#cbd5e1' : '#3b82f6',
                      boxShadow: currentPage === 0 ? 'none' : '0 1px 4px rgba(0,0,0,0.08)',
                    }}
                  >← Prev</button>
                  <span style={{ padding: '10px 24px', background: '#3b82f6', color: '#fff', borderRadius: 14, fontWeight: 800, fontSize: '0.88rem', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>
                    Page {currentPage + 1}
                  </span>
                  <button
                    onClick={goNext}
                    disabled={!hasMore}
                    style={{
                      padding: '10px 22px', borderRadius: 14, fontWeight: 700, fontSize: '0.88rem', border: 'none', cursor: !hasMore ? 'not-allowed' : 'pointer',
                      background: !hasMore ? '#f1f5f9' : '#fff',
                      color: !hasMore ? '#cbd5e1' : '#3b82f6',
                      boxShadow: !hasMore ? 'none' : '0 1px 4px rgba(0,0,0,0.08)',
                    }}
                  >Next →</button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* ── View Modal ── */}
      {viewModalRecord && (
        <ViewModal record={viewModalRecord} onClose={() => setViewModalRecord(null)} />
      )}

      {/* ── Edit Modal ── */}
      {editModalRecord && (
        <EditModal record={editModalRecord} onClose={() => setEditModalRecord(null)} />
      )}
    </div>
  );
}

// ── Helper: label-value row ───────────────────────────────────────────────────
function Row({ label, val }) {
  if (!val) return null;
  return (
    <div style={{ display: 'flex', gap: 8, paddingBottom: 2 }}>
      <span style={{ fontWeight: 700, color: '#1e40af', minWidth: 140, flexShrink: 0 }}>{label}:</span>
      <span style={{ color: '#334155' }}>{val}</span>
    </div>
  );
}

// ── ReportCard component ──────────────────────────────────────────────────────
function ReportCard({ report, onView, onEdit }) {
  const statusColors = {
    COMPLETED: 'background:#e8f5e9;color:#2e7d32',
    'IN REVIEW': 'background:#e8eaf6;color:#3f51b5',
    PENDING: 'background:#fff3e0;color:#e65100',
  };

  // ── PDF Export (FIXED) ────────────────────────────────────────────────
  const handleDownloadPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const autoTableModule = await import('jspdf-autotable');
      const autoTable = autoTableModule.default;
      const docPdf = new jsPDF();
      docPdf.setFont('helvetica');

      const isFieldReport = (report.reportId || '').startsWith('#RF-');

      if (isFieldReport) {
        // ── Field Daily Form PDF ──
        let y = 15;
        docPdf.setFontSize(16);
        docPdf.setTextColor(13, 110, 253);
        docPdf.text('Field Daily Form Report', 14, y); y += 10;

        docPdf.setFontSize(10);
        docPdf.setTextColor(60, 60, 60);
        const addLine = (text) => {
          if (y > 272) { docPdf.addPage(); y = 15; }
          const lines = docPdf.splitTextToSize(text, 180);
          docPdf.text(lines, 14, y);
          y += lines.length * 5 + 2;
        };

        addLine(`Officer: ${report.officerName || '-'}`);
        addLine(`Date: ${report.date || '-'}`);
        addLine(`Working Type: ${report.workingType || '-'}`);
        addLine(`KMs Travelled: ${report.kms || '-'}`);
        addLine(`Punch In: ${report.punchIn || '-'}  |  Punch Out: ${report.punchOut || '-'}  |  Hours: ${report.hours || '-'}`);
        addLine(`Entry By: ${report.entryBy || '-'}`);
        addLine(`Reviewer: ${report.reviewer || '-'}`);
        addLine(`Reviewer Comment: ${report.reviewerComment || '-'}`);
        y += 3;

        // Locations
        if ((report.locations || []).filter(Boolean).length > 0) {
          if (y > 250) { docPdf.addPage(); y = 15; }
          docPdf.setFont('helvetica', 'bold');
          docPdf.setTextColor(13, 110, 253);
          docPdf.text('Visited Locations:', 14, y); y += 6;
          docPdf.setFont('helvetica', 'normal');
          docPdf.setTextColor(60, 60, 60);
          report.locations.filter(Boolean).forEach(loc => { addLine(`• ${loc}`); });
          y += 3;
        }

        // Customers
        if ((report.customers || []).filter(c => c.name).length > 0) {
          if (y > 240) { docPdf.addPage(); y = 15; }
          docPdf.setFont('helvetica', 'bold');
          docPdf.setTextColor(13, 110, 253);
          docPdf.setFontSize(11);
          docPdf.text('Customers:', 14, y); y += 4;
          docPdf.setFont('helvetica', 'normal');
          docPdf.setFontSize(10);
          docPdf.setTextColor(60, 60, 60);

          autoTable(docPdf, {
            startY: y,
            head: [['Name', 'Type', 'Phone', 'Orders', 'Remark']],
            body: report.customers.filter(c => c.name).map(c => [
              c.name || '-',
              c.type || '-',
              c.phone || '-',
              (c.orders || []).map(o => `${o.packaging} x ${o.quantity}`).join('; ') || '-',
              c.remark || '-',
            ]),
            theme: 'grid',
            styles: { fontSize: 9 },
            margin: { left: 14, right: 14 },
          });
          y = docPdf.lastAutoTable.finalY + 8;
        }

        // Notes, Remarks, Expenses
        if (y > 250) { docPdf.addPage(); y = 15; }
        docPdf.setFont('helvetica', 'bold');
        docPdf.setTextColor(13, 110, 253);
        docPdf.setFontSize(10);
        docPdf.text('Notes:', 14, y); y += 5;
        docPdf.setFont('helvetica', 'normal');
        docPdf.setTextColor(60, 60, 60);
        const noteLines = docPdf.splitTextToSize(report.notes || '-', 180);
        docPdf.text(noteLines, 14, y); y += noteLines.length * 5 + 4;

        docPdf.setFont('helvetica', 'bold'); docPdf.setTextColor(13, 110, 253);
        docPdf.text('Remarks:', 14, y); y += 5;
        docPdf.setFont('helvetica', 'normal'); docPdf.setTextColor(60, 60, 60);
        const remLines = docPdf.splitTextToSize(report.remarks || '-', 180);
        docPdf.text(remLines, 14, y); y += remLines.length * 5 + 4;

        const exp = report.expenses || { food: '-', fuel: '-', total: '-' };
        if (y > 265) { docPdf.addPage(); y = 15; }
        docPdf.setFont('helvetica', 'bold'); docPdf.setTextColor(13, 110, 253);
        docPdf.text('Expenses:', 14, y); y += 5;
        docPdf.setFont('helvetica', 'normal'); docPdf.setTextColor(60, 60, 60);
        docPdf.text(`Food: Rs.${exp.food}   Fuel: Rs.${exp.fuel}   Total: Rs.${exp.total}`, 14, y);

        docPdf.save(`DailyForm_${report.officerName || 'report'}_${report.date || ''}.pdf`);

      } else {
        // ── Demo Sales PDF (FIXED labels + autoTable) ──
        let y = 15;
        docPdf.setFontSize(16);
        docPdf.setTextColor(13, 110, 253);
        docPdf.text('Demo Sales Report', 14, y); y += 10;

        docPdf.setFontSize(10);
        docPdf.setTextColor(60, 60, 60);
        const addLine = (text) => {
          if (y > 272) { docPdf.addPage(); y = 15; }
          const lines = docPdf.splitTextToSize(text, 180);
          docPdf.text(lines, 14, y);
          y += lines.length * 5 + 2;
        };

        addLine(`Demo Name: ${report.demoName || report.officerName || '-'}`);
        addLine(`Village: ${report.village || '-'}`);
        addLine(`Date: ${report.date || '-'}`);
        addLine(`Taluka: ${report.taluka || '-'}`);
        addLine(`Mantri: ${report.mantri || '-'}`);
        addLine(`Total Milk: ${report.totalMilk || '-'}`);
        addLine(`Active Sabhasad: ${report.activeSabhasad || '-'}`);
        addLine(`Team Members: ${report.teamMembers || '-'}`);
        addLine(`Entry By: ${report.entryBy || '-'}`);
        addLine(`Demo Remarks: ${report.demoRemarks || '-'}`);
        y += 3;

        // Customers table
        if ((report.customers || []).length > 0) {
          if (y > 240) { docPdf.addPage(); y = 15; }
          docPdf.setFont('helvetica', 'bold');
          docPdf.setTextColor(13, 110, 253);
          docPdf.setFontSize(11);
          docPdf.text('Customers', 14, y); y += 4;
          docPdf.setFont('helvetica', 'normal');

          autoTable(docPdf, {
            startY: y,
            head: [['Name', 'Code', 'Mobile', 'Packaging', 'Qty', 'Remarks']],
            body: report.customers.map(c => [
              c.name || '-', c.code || '-', c.mobile || '-',
              c.orderPackaging || c.packaging || '-',
              c.orderQty || c.quantity || '-',
              c.remarks || '-',
            ]),
            theme: 'grid',
            styles: { fontSize: 9 },
            margin: { left: 14, right: 14 },
          });
          y = docPdf.lastAutoTable.finalY + 8;
        }

        docPdf.save(`DemoSales_${report.village || report.demoName || 'report'}_${report.date || ''}.pdf`);
      }

      toast.success('PDF downloaded! 📄');
    } catch (err) {
      console.error(err);
      toast.error('Failed to download PDF. Please try again.');
    }
  };

  const [statusStyle] = (statusColors[report.status] || 'background:#f1f5f9;color:#64748b').split(';').reduce(
    (acc, s) => { const [k, v] = s.split(':'); acc[0][k.trim()] = v?.trim(); return acc; }, [{}]
  );

  return (
    <div style={{
      background: '#fff', borderRadius: 20, padding: '20px 22px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid rgba(241,245,249,0.8)',
      transition: 'box-shadow 0.3s',
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
        <div>
          <h4 style={{ fontWeight: 800, color: '#2563eb', fontSize: '1rem', margin: '0 0 3px' }}>{report.reportId}</h4>
          <p style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 700, margin: 0 }}>
            {report.date} • {report.time || (report.createdAt?.toDate?.().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) || 'N/A'}
          </p>
        </div>
        <span style={{
          padding: '5px 14px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 800,
          textTransform: 'uppercase', letterSpacing: '0.08em',
          ...Object.fromEntries((statusColors[report.status] || 'background:#f1f5f9;color:#64748b').split(';').map(s => { const [k, v] = s.split(':'); return [k?.trim(), v?.trim()]; }))
        }}>
          {report.status}
        </span>
      </div>

      {/* Officer row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3730a3', fontWeight: 800, fontSize: '1rem', border: '2px solid #fff', boxShadow: '0 2px 6px rgba(0,0,0,0.08)', flexShrink: 0 }}>
          {report.initials}
        </div>
        <div>
          <h5 style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.95rem', margin: '0 0 2px' }}>{report.officerName}</h5>
          <p style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 700, margin: 0 }}>{report.workingType}</p>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          {/* View button — FIXED: now calls onView */}
          <button
            onClick={onView}
            title="View Details"
            style={{ background: '#eff6ff', color: '#2563eb', border: '1.5px solid #bfdbfe', borderRadius: 10, padding: '7px 14px', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            View
          </button>

          {/* Edit — now functional */}
          <button
            onClick={onEdit}
            title="Edit Record"
            style={{ background: '#fef9c3', color: '#92400e', border: '1.5px solid #fde68a', borderRadius: 10, padding: '7px 14px', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            Edit
          </button>
        </div>

        {/* Download PDF */}
        <button
          onClick={handleDownloadPDF}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', background: '#e8eaf6', color: '#3f51b5', borderRadius: 12, fontSize: '0.82rem', fontWeight: 800, border: 'none', cursor: 'pointer', transition: 'background 0.2s' }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          Download PDF
        </button>
      </div>
    </div>
  );
}
