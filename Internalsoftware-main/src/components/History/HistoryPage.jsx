import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../Navbar';
import { db } from '../../firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { jsPDF } from 'jspdf';
import { toast } from 'react-toastify';
import './History.css';
import '../../DailyForm.css';

export default function HistoryPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('field');
  const [fieldOfficerData, setFieldOfficerData] = useState([]);
  const [demoSalesData, setDemoSalesData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [officerFilter, setOfficerFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const fieldQuery = query(collection(db, 'fieldOfficerForms'), orderBy('createdAt', 'desc'));
        const fieldSnap = await getDocs(fieldQuery);
        setFieldOfficerData(fieldSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const demoQuery = query(collection(db, 'demoForms'), orderBy('createdAt', 'desc'));
        const demoSnap = await getDocs(demoQuery);
        setDemoSalesData(demoSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching history data:", error);
        toast.error("Could not load history. Please check your connection and try again.");
      }
      setLoading(false);
    };

    fetchData();
  }, []);

  const filteredFieldData = React.useMemo(() => {
    return fieldOfficerData.filter(d => {
      const matchesOfficer = officerFilter === 'All' || d.officerName === officerFilter;
      const matchesDateFrom = !dateFrom || d.date >= dateFrom;
      const matchesDateTo = !dateTo || d.date <= dateTo;
      return matchesOfficer && matchesDateFrom && matchesDateTo;
    });
  }, [fieldOfficerData, officerFilter, dateFrom, dateTo]);

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
        <header className="mb-10">
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => setActiveTab('field')}
              className={`w-full sm:w-auto px-8 py-3.5 rounded-2xl font-bold text-[15px] transition-all duration-300 transform active:scale-95 ${
                activeTab === 'field'
                  ? 'bg-[#3B82F6] text-white shadow-[0_10px_25px_-5px_rgba(59,130,246,0.4)] ring-4 ring-blue-500/10'
                  : 'bg-white text-[#64748B] hover:bg-[#F1F5F9] shadow-sm'
              }`}
            >
              Daily Form History
            </button>
            <button
              onClick={() => setActiveTab('demo')}
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

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 animate-pulse">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-400 font-bold">Loading history...</p>
          </div>
        ) : (
          <div className="relative min-h-[600px]">
            {/* Field Officer History Section */}
            <div 
              className={`transition-all duration-500 ease-out transform ${
                activeTab === 'field' 
                  ? 'opacity-100 translate-x-0 relative' 
                  : 'opacity-0 -translate-x-12 absolute inset-0 pointer-events-none'
              }`}
            >
              <FieldOfficerSection 
                data={filteredFieldData} 
                allData={fieldOfficerData}
                officerFilter={officerFilter}
                setOfficerFilter={setOfficerFilter}
                dateFrom={dateFrom}
                setDateFrom={setDateFrom}
                dateTo={dateTo}
                setDateTo={setDateTo}
              />
            </div>

            {/* Demo Sales History Section */}
            <div 
              className={`transition-all duration-500 ease-out transform ${
                activeTab === 'demo' 
                  ? 'opacity-100 translate-x-0 relative' 
                  : 'opacity-0 translate-x-12 absolute inset-0 pointer-events-none'
              }`}
            >
              <DemoSalesSection data={demoSalesData} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function FieldOfficerSection({ data, allData, officerFilter, setOfficerFilter, dateFrom, setDateFrom, dateTo, setDateTo }) {
  return (
    <div className="space-y-8 opacity-0 translate-y-4 animate-fadeInUp">
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out forwards;
        }
      `}</style>
      
      {/* Filters Card */}
      <div className="bg-white rounded-[20px] sm:rounded-[24px] p-5 sm:p-8 shadow-[0_2px_12px_-3px_rgba(0,0,0,0.04)] border border-slate-100/80">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-[11px] font-bold text-[#3B82F6] uppercase tracking-[0.1em] mb-2.5 ml-1">Officer</label>
            <select 
              value={officerFilter}
              onChange={(e) => setOfficerFilter(e.target.value)}
              className="w-full bg-[#F1F5F9] border-none rounded-2xl px-5 py-3.5 text-[#334155] font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer"
            >
              <option value="All">All</option>
              {[...new Set(allData.map(d => d.officerName))].filter(Boolean).sort().map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
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
          <div>
            <label className="block text-[11px] font-bold text-[#3B82F6] uppercase tracking-[0.1em] mb-2.5 ml-1">Date From</label>
            <input 
              type="date" 
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full bg-[#F1F5F9] border-none rounded-2xl px-5 py-3.5 text-[#334155] font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer" 
            />
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center px-4">
        <h2 className="text-[22px] font-extrabold text-[#1E293B]">Recent Reports</h2>
        <button className="text-[#3B82F6] font-bold text-sm hover:text-blue-700 transition-colors">View All</button>
      </div>

      <div className="space-y-5">
        {data.length > 0 ? (
          data.map(report => (
            <ReportCard key={report.id} report={{
              ...report,
              reportId: report.reportId || `#RF-${report.id.slice(-5).toUpperCase()}`,
              initials: report.officerName?.split(' ').map(n => n[0]).join('').toUpperCase() || '??',
              status: report.status || 'COMPLETED'
            }} />
          ))
        ) : (
          <div className="text-center py-20 bg-white rounded-[32px] border border-dashed border-slate-200">
            <p className="text-slate-400 font-bold">No records found.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DemoSalesSection({ data }) {
  // Simple analytics calculation
  const totalCustomers = data.reduce((sum, r) => sum + (r.customers?.length || 0), 0);
  const totalQuantity = data.reduce((sum, r) => sum + (r.customers?.reduce((s, c) => s + (Number(c.orderQty) || 0), 0) || 0), 0);
  
  const packagingTotals = {};
  data.forEach(r => {
    (r.customers || []).forEach(c => {
      if (c.orderPackaging) {
        packagingTotals[c.orderPackaging] = (packagingTotals[c.orderPackaging] || 0) + (Number(c.orderQty) || 0);
      }
    });
  });

  return (
    <div className="space-y-8 opacity-0 translate-y-4 animate-fadeInUp">
      {/* Analytics Card */}
      <div className="bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-8 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.04)] border border-slate-100/80">
        <h3 className="text-[20px] font-black text-[#1E293B] mb-6 tracking-tight">Analytics</h3>
        <ul className="space-y-4 text-[15px] text-slate-600 font-bold">
          <li className="flex items-center gap-2">
            1. Total Customers: <span className="text-[#1E293B] font-black">{totalCustomers}</span>
          </li>
          <li className="flex items-center gap-2">
            2. Total Quantity: <span className="text-[#1E293B] font-black">{totalQuantity}</span>
          </li>
          <li className="pt-2">
            <div className="flex items-center gap-2 mb-4">
              3. Packaging-wise Sales:
            </div>
            <ul className="ml-5 space-y-2.5 text-[14.5px]">
              {Object.entries(packagingTotals).length > 0 ? (
                Object.entries(packagingTotals).map(([pack, qty]) => (
                  <li key={pack} className="flex items-center gap-2.5">
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-500 uppercase tracking-tight font-bold">{pack}:</span>
                    <span className="text-[#1E293B] font-black">{qty}</span>
                  </li>
                ))
              ) : (
                <li className="text-slate-400 italic font-medium tracking-tight">• No packaging data available</li>
              )}
            </ul>
          </li>
        </ul>
      </div>

      <div className="flex justify-between items-center px-4">
        <h2 className="text-[22px] font-extrabold text-[#1E293B]">Recent Reports</h2>
        <button className="text-[#3B82F6] font-bold text-sm hover:text-blue-700 transition-colors">View All</button>
      </div>

      <div className="space-y-5">
        {data.length > 0 ? (
          data.map(report => (
            <ReportCard key={report.id} report={{
              ...report,
              reportId: report.reportId || `#DS-${report.id.slice(-5).toUpperCase()}`,
              initials: report.village?.slice(0, 2).toUpperCase() || report.demoName?.slice(0, 2).toUpperCase() || 'DS',
              status: 'COMPLETED',
              officerName: report.village || report.demoName || 'Demo Site',
              workingType: `Entry By: ${report.entryBy || 'System'}`
            }} />
          ))
        ) : (
          <div className="text-center py-20 bg-white rounded-[24px] border border-dashed border-slate-200">
            <p className="text-slate-400 font-bold">No demo records found.</p>
          </div>
        )}
      </div>
    </div>
  );
}

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
        <button onClick={() => {
          try {
            const doc = new jsPDF();
            doc.setFont('helvetica');
            doc.setFontSize(16);
            doc.text(`${report.reportId} - Report`, 14, 20);
            doc.setFontSize(12);
            doc.text(`Officer/Village: ${report.officerName || '-'}`, 14, 30);
            doc.text(`Date: ${report.date || '-'}`, 14, 40);
            doc.text(`Status: ${report.status || '-'}`, 14, 50);
            doc.save(`${report.reportId}_Report.pdf`);
            toast.success("PDF downloaded successfully!");
          } catch (e) {
            console.error("PDF generation failed:", e);
            toast.error("Failed to generate PDF. Please try again.");
          }
        }} className="w-auto flex items-center gap-2.5 px-6 py-3 bg-[#E8EAF6] text-[#3F51B5] rounded-xl text-[13px] font-black hover:bg-[#D1D5DB] transition-all duration-200 shadow-sm active:scale-95 group/btn">
          <svg className="w-4.5 h-4.5 transition-transform group-hover/btn:-translate-y-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          PDF
        </button>
      </div>
    </div>
  );
}
