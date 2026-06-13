import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { db } from '../firebase';
import {
  collection, getDocs, query, orderBy, where,
  limit, startAfter
} from 'firebase/firestore';
import '../style/History.css';
import '../style/DailyForm.css';

// ─────────────────────────────────────────────────────────────────────────────
// FIX 3 — In-Memory Cache (module-level, survives re-renders)
// Key   → "tab|officer=X|from=Y|to=Z|page=N"
// Value → { records: [...], hasMore: true/false }
// ─────────────────────────────────────────────────────────────────────────────
const historyCache = new Map();
const PAGE_SIZE = 10;

function buildCacheKey(tab, officer, dateFrom, dateTo, pageIndex) {
  return `${tab}|officer=${officer}|from=${dateFrom}|to=${dateTo}|page=${pageIndex}`;
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('field');

  // ── Data ───────────────────────────────────────────────────────────────────
  const [fieldData, setFieldData] = useState([]);
  const [demoData, setDemoData]   = useState([]);
  const [loading, setLoading]     = useState(true);

  // ── Filter inputs (not yet sent to Firebase) ──────────────────────────────
  const [officerFilter, setOfficerFilter] = useState('All');
  const [dateFrom, setDateFrom]           = useState('');
  const [dateTo, setDateTo]               = useState('');

  // ── Applied filters (sent to Firebase on Apply click) ─────────────────────
  const [appliedFilters, setAppliedFilters] = useState({
    officer: 'All',
    dateFrom: '',
    dateTo: '',
  });

  // ── FIX 1 — Pagination state ──────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(0);
  const [pageCursors, setPageCursors] = useState([null]);
  const [hasMore, setHasMore]         = useState(false);

  // ── Officer dropdown list ─────────────────────────────────────────────────
  const [officerList, setOfficerList] = useState([]);

  // Fetch unique officer names once for the filter dropdown
  useEffect(() => {
    async function fetchOfficerList() {
      try {
        const snap = await getDocs(
          query(collection(db, 'fieldOfficerForms'), orderBy('createdAt', 'desc'), limit(200))
        );
        const names = new Set();
        snap.docs.forEach(d => {
          const n = d.data().officerName;
          if (n) names.add(n);
        });
        setOfficerList(Array.from(names).sort());
      } catch (_) { /* non-critical */ }
    }
    fetchOfficerList();
  }, []);

  // ── FIX 1 + 2 + 3 — Core fetch function ──────────────────────────────────
  const fetchPage = useCallback(async (tab, pageIndex, cursors, filters) => {
    const { officer, dateFrom, dateTo } = filters;
    const collectionName = tab === 'field' ? 'fieldOfficerForms' : 'demoForms';

    // ── FIX 3: Check cache first ─────────────────────────────────────────
    const cacheKey = buildCacheKey(tab, officer, dateFrom, dateTo, pageIndex);
    if (historyCache.has(cacheKey)) {
      const cached = historyCache.get(cacheKey);
      if (tab === 'field') setFieldData(cached.records);
      else setDemoData(cached.records);
      setHasMore(cached.hasMore);
      setLoading(false);
      return;
    }

    // ── FIX 2: Build Firebase query with server-side filters ─────────────
    // IMPORTANT: We avoid composite indexes by NEVER combining where() on
    // one field with orderBy() on a different field.
    //
    // Strategy:
    //   - Date range only    → where(date) + orderBy(date)     [same field = OK]
    //   - Officer only       → where(officerName)              [no orderBy needed]
    //   - Officer + Date     → where(date) + orderBy(date)     [officer filtered client-side]
    //   - No filters         → orderBy(createdAt)              [single field = OK]
    // ──────────────────────────────────────────────────────────────────────
    const constraints = [];
    let officerClientSide = ''; // if set, we filter by officer AFTER fetching

    const hasDateFilter    = !!(dateFrom || dateTo);
    const hasOfficerFilter = tab === 'field' && officer && officer !== 'All';

    if (hasDateFilter && hasOfficerFilter) {
      // Both filters → date goes server-side, officer goes client-side
      // (combining where on 2 different fields needs a composite index)
      if (dateFrom) constraints.push(where('date', '>=', dateFrom));
      if (dateTo)   constraints.push(where('date', '<=', dateTo));
      constraints.push(orderBy('date', 'desc'));
      officerClientSide = officer; // will filter after fetch
    } else if (hasDateFilter) {
      // Date only → server-side (where + orderBy on same 'date' field)
      if (dateFrom) constraints.push(where('date', '>=', dateFrom));
      if (dateTo)   constraints.push(where('date', '<=', dateTo));
      constraints.push(orderBy('date', 'desc'));
    } else if (hasOfficerFilter) {
      // Officer only → server-side where, no orderBy (avoids composite index)
      constraints.push(where('officerName', '==', officer));
    } else {
      // No filters → just order by createdAt
      constraints.push(orderBy('createdAt', 'desc'));
    }

    // ── FIX 1: Cursor-based pagination ───────────────────────────────────
    const cursor = cursors[pageIndex];
    if (cursor) {
      constraints.push(startAfter(cursor));
    }

    // Fetch PAGE_SIZE + 1 to check if next page exists
    constraints.push(limit(PAGE_SIZE + 1));

    const q = query(collection(db, collectionName), ...constraints);
    const snap = await getDocs(q);

    const hasMoreData = snap.docs.length > PAGE_SIZE;
    const pageDocs = hasMoreData ? snap.docs.slice(0, PAGE_SIZE) : snap.docs;
    let fetched = pageDocs.map(d => ({ id: d.id, ...d.data() }));

    // Client-side officer filter (used when both officer + date are set)
    if (officerClientSide) {
      fetched = fetched.filter(r => r.officerName === officerClientSide);
    }

    // Save cursor for next page
    if (pageDocs.length > 0) {
      setPageCursors(prev => {
        const updated = [...prev];
        updated[pageIndex + 1] = pageDocs[pageDocs.length - 1];
        return updated;
      });
    }

    // ── FIX 3: Save to cache ─────────────────────────────────────────────
    historyCache.set(cacheKey, { records: fetched, hasMore: hasMoreData });

    if (tab === 'field') setFieldData(fetched);
    else setDemoData(fetched);
    setHasMore(hasMoreData);
    setLoading(false);
  }, []);

  // Trigger fetch whenever tab, page, or applied filters change
  useEffect(() => {
    setLoading(true);
    fetchPage(activeTab, currentPage, pageCursors, appliedFilters).catch(err => {
      console.error("Error fetching history data:", err);
      toast.error('Could not load history. Please check your connection.');
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, currentPage, appliedFilters]);

  // ── Tab switch resets pagination ───────────────────────────────────────────
  const switchTab = (tab) => {
    setActiveTab(tab);
    setCurrentPage(0);
    setPageCursors([null]);
  };

  // ── Filter actions ────────────────────────────────────────────────────────
  const applyFilters = () => {
    historyCache.clear();
    setCurrentPage(0);
    setPageCursors([null]);
    setAppliedFilters({ officer: officerFilter, dateFrom, dateTo });
  };

  const clearFilters = () => {
    setOfficerFilter('All');
    setDateFrom('');
    setDateTo('');
    historyCache.clear();
    setCurrentPage(0);
    setPageCursors([null]);
    setAppliedFilters({ officer: 'All', dateFrom: '', dateTo: '' });
  };

  // ── Pagination helpers ────────────────────────────────────────────────────
  const goNext = () => setCurrentPage(p => p + 1);
  const goPrev = () => setCurrentPage(p => Math.max(0, p - 1));

  // Active filter indicator
  const hasActiveFilters =
    appliedFilters.officer !== 'All' || appliedFilters.dateFrom || appliedFilters.dateTo;

  const currentData = activeTab === 'field' ? fieldData : demoData;

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans pb-20">
      <div className="daily-form-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <span className="header-title">History</span>
        <button className="header-more">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
        </button>
      </div>
      
      <main className="max-w-4xl mx-auto px-4 py-10">
        {/* ── Tab Buttons ── */}
        <header className="mb-10">
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => switchTab('field')}
              className={`w-full sm:w-auto px-8 py-3.5 rounded-2xl font-bold text-[15px] transition-all duration-300 transform active:scale-95 ${
                activeTab === 'field'
                  ? 'bg-[#3B82F6] text-white shadow-[0_10px_25px_-5px_rgba(59,130,246,0.4)] ring-4 ring-blue-500/10'
                  : 'bg-white text-[#64748B] hover:bg-[#F1F5F9] shadow-sm'
              }`}
            >
              Daily Form History
            </button>
            <button
              onClick={() => switchTab('demo')}
              className={`w-full sm:w-auto px-8 py-3.5 rounded-2xl font-bold text-[15px] transition-all duration-300 transform active:scale-95 ${
                activeTab === 'demo'
                  ? 'bg-[#3B82F6] text-white shadow-[0_10px_25px_-5px_rgba(59,130,246,0.4)] ring-4 ring-blue-500/10'
                  : 'bg-white text-[#64748B] hover:bg-[#F1F5F9] shadow-sm'
              }`}
            >
              Demo Sales History
            </button>
          </div>
        </header>

        {/* ── Filters Card (shared for both tabs) ── */}
        <div className="bg-white rounded-[20px] sm:rounded-[24px] p-5 sm:p-8 shadow-[0_2px_12px_-3px_rgba(0,0,0,0.04)] border border-slate-100/80 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Officer dropdown (only for field tab) */}
            {activeTab === 'field' && (
              <div>
                <label className="block text-[11px] font-bold text-[#3B82F6] uppercase tracking-[0.1em] mb-2.5 ml-1">Officer</label>
                <select 
                  value={officerFilter}
                  onChange={(e) => setOfficerFilter(e.target.value)}
                  className="w-full bg-[#F1F5F9] border-none rounded-2xl px-5 py-3.5 text-[#334155] font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer"
                >
                  <option value="All">All</option>
                  {officerList.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-[11px] font-bold text-[#3B82F6] uppercase tracking-[0.1em] mb-2.5 ml-1">Date From</label>
              <input 
                type="date" 
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full bg-[#F1F5F9] border-none rounded-2xl px-5 py-3.5 text-[#334155] font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer" 
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#3B82F6] uppercase tracking-[0.1em] mb-2.5 ml-1">Date To</label>
              <input 
                type="date" 
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full bg-[#F1F5F9] border-none rounded-2xl px-5 py-3.5 text-[#334155] font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer" 
              />
            </div>
          </div>

          {/* Apply / Clear buttons */}
          <div style={{ display: 'flex', gap: 12, marginTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={applyFilters}
              className="px-6 py-3 bg-[#3B82F6] text-white rounded-2xl font-bold text-[14px] shadow-[0_4px_12px_-2px_rgba(59,130,246,0.4)] hover:bg-[#2563EB] transition-all active:scale-95"
            >
              🔍 Apply Filters
            </button>
            <button
              onClick={clearFilters}
              className="px-6 py-3 bg-[#F1F5F9] text-[#64748B] rounded-2xl font-bold text-[14px] hover:bg-[#E2E8F0] transition-all active:scale-95"
            >
              ✕ Clear
            </button>

            {/* Active filter badge */}
            {hasActiveFilters && (
              <span className="px-4 py-2 bg-[#DBEAFE] text-[#2563EB] rounded-full text-[12px] font-bold">
                🔍 Filtered
              </span>
            )}

            {/* Cache indicator */}
            <span className="ml-auto text-[11px] text-[#94A3B8] font-semibold">
              💾 Cache: {historyCache.size} page(s) in memory
            </span>
          </div>
        </div>

        {/* ── Loading State ── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 animate-pulse">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-400 font-bold">Loading history...</p>
          </div>
        ) : (
          <div className="relative min-h-[400px]">
            {/* ── Section Header ── */}
            <div className="flex justify-between items-center px-4 mb-6">
              <h2 className="text-[22px] font-extrabold text-[#1E293B]">
                {activeTab === 'field' ? 'Daily Form Reports' : 'Demo Sales Reports'}
              </h2>
              <span className="text-[13px] text-slate-400 font-bold">
                {currentData.length} record(s) on this page
              </span>
            </div>

            {/* ── Report Cards ── */}
            <div className="space-y-5">
              {currentData.length > 0 ? (
                currentData.map(report => (
                  <ReportCard key={report.id} report={{
                    ...report,
                    reportId: report.reportId || (activeTab === 'field'
                      ? `#RF-${report.id.slice(-5).toUpperCase()}`
                      : `#DS-${report.id.slice(-5).toUpperCase()}`),
                    initials: activeTab === 'field'
                      ? (report.officerName?.split(' ').map(n => n[0]).join('').toUpperCase() || '??')
                      : (report.village?.slice(0, 2).toUpperCase() || report.demoName?.slice(0, 2).toUpperCase() || 'DS'),
                    status: report.status || 'COMPLETED',
                    ...(activeTab === 'demo' && {
                      officerName: report.village || report.demoName || 'Demo Site',
                      workingType: `Entry By: ${report.entryBy || 'System'}`
                    })
                  }} />
                ))
              ) : (
                <div className="text-center py-20 bg-white rounded-[32px] border border-dashed border-slate-200">
                  <p className="text-slate-400 font-bold">
                    {hasActiveFilters ? 'No records found for the selected filters.' : 'No records found.'}
                  </p>
                </div>
              )}
            </div>

            {/* ── FIX 1: Pagination Controls ── */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 16, marginTop: 32, paddingBottom: 12,
            }}>
              <button
                onClick={goPrev}
                disabled={currentPage === 0}
                className={`px-6 py-3 rounded-2xl font-bold text-[14px] transition-all active:scale-95 ${
                  currentPage === 0
                    ? 'bg-[#F1F5F9] text-[#CBD5E1] cursor-not-allowed'
                    : 'bg-white text-[#3B82F6] shadow-sm hover:bg-[#EFF6FF] cursor-pointer'
                }`}
              >
                ← Prev
              </button>

              <span className="px-6 py-3 bg-[#3B82F6] text-white rounded-2xl font-black text-[14px] shadow-[0_4px_12px_-2px_rgba(59,130,246,0.3)]">
                Page {currentPage + 1}
              </span>

              <button
                onClick={goNext}
                disabled={!hasMore}
                className={`px-6 py-3 rounded-2xl font-bold text-[14px] transition-all active:scale-95 ${
                  !hasMore
                    ? 'bg-[#F1F5F9] text-[#CBD5E1] cursor-not-allowed'
                    : 'bg-white text-[#3B82F6] shadow-sm hover:bg-[#EFF6FF] cursor-pointer'
                }`}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ── ReportCard component (unchanged) ─────────────────────────────────────────
function ReportCard({ report }) {
  const statusColors = {
    'COMPLETED': 'bg-[#E8F5E9] text-[#2E7D32]',
    'IN REVIEW': 'bg-[#E8EAF6] text-[#3F51B5]',
    'PENDING': 'bg-[#E8EAF6] text-[#3F51B5]'
  };

  return (
    <div className="bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-7 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100/80 hover:shadow-[0_12px_30px_-10px_rgba(0,0,0,0.08)] transition-all duration-300 group cursor-default">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h4 className="font-extrabold text-[#2563EB] text-[17px] mb-1 tracking-tight group-hover:text-blue-700 transition-colors">{report.reportId}</h4>
          <p className="text-[13px] text-slate-400 font-bold">{report.date} • {report.time || report.createdAt?.toDate?.().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) || 'N/A'}</p>
        </div>
        <span className={`px-5 py-2 rounded-full text-[11px] font-black uppercase tracking-wider shadow-sm ${statusColors[report.status] || 'bg-slate-100 text-slate-600'}`}>
          {report.status}
        </span>
      </div>

      <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100">
        <div className="w-14 h-14 rounded-full bg-[#E0E7FF] flex items-center justify-center text-[#3730A3] font-black text-[17px] shadow-sm border-2 border-white">
          {report.initials}
        </div>
        <div>
          <h5 className="font-extrabold text-[#1E293B] text-[16px] mb-1 leading-tight">{report.officerName}</h5>
          <p className="text-[13px] text-slate-400 font-bold">{report.workingType}</p>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div className="flex gap-5">
          <button className="w-auto text-slate-400 hover:text-[#2563EB] transition-all duration-200 transform hover:scale-110" title="View Details">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          <button className="w-auto text-slate-400 hover:text-[#2563EB] transition-all duration-200 transform hover:scale-110" title="Edit Record">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        </div>
        <button className="w-auto flex items-center gap-2.5 px-6 py-3 bg-[#E8EAF6] text-[#3F51B5] rounded-xl text-[13px] font-black hover:bg-[#D1D5DB] transition-all duration-200 shadow-sm active:scale-95 group/btn">
          <svg className="w-4.5 h-4.5 transition-transform group-hover/btn:-translate-y-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          PDF
        </button>
      </div>
    </div>
  );
}
