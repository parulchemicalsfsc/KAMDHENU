import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import Navbar from '../components/Navbar';
import '../style/DailyForm.css';
import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';


const REMARK_QUESTIONS = [
  { id: 'supportive_mantry', label: 'SUPPORTIVE MANTRY', options: ['YES', 'NO'] },
  { id: 'supportive_sabhasad', label: 'SUPPORTIVE SABHASAD', options: ['YES', 'NO'] },
  { id: 'already_uses_other_brand', label: 'ALREADY USES OTHER BRAND', options: ['YES', 'NO'] },
  { id: 'internet_available', label: 'INTERNET AVAILABLE', options: ['YES', 'NO'] },
  { id: 'payment_issue', label: 'PAYMENT ISSUE', options: ['YES', 'NO'] },
  { id: 'result', label: 'RESULT', options: ['YES', 'NO'] },
  { id: 'available_with_sabhasad_mantry', label: 'AVAILABLE WITH SABHASAD/MANTRY', options: ['YES', 'NO'] },
  { id: 'suitable_for_animal', label: 'SUITABLE FOR ANIMAL', options: ['YES', 'NO'] },
  { id: 'high_price', label: 'HIGH PRICE', options: ['HIGH', 'LOW'] },
  { id: 'demand', label: 'DEMAND', options: ['HIGH', 'LOW'] },
  { id: 'payments', label: 'PAYMENTS', options: ['REGULAR', 'IRREGULAR'] },
];

export default function FieldOfficerForm() {
  const navigate = useNavigate();

  // --- State ---
  const [officers, setOfficers] = useState(() => {
    const stored = localStorage.getItem('officers');
    return stored ? JSON.parse(stored) : [
      { name: 'VINIT GADOYA', code: 'GJ03', type: 'Full Time' },
      { name: 'KALPESH MASTER', code: 'GJ16', type: 'Full Time' }
    ];
  });
  const [newOfficer, setNewOfficer] = useState({ name: '', code: '', type: 'Full Time' });
  const [showAddOfficer, setShowAddOfficer] = useState(false);
  
  const [form, setForm] = useState({
    officerName: '', 
    date: '', 
    kms: '0.0', 
    punchIn: '', 
    punchOut: '',
    remarks: '', 
    notes: '', 
    entryBy: '', 
    reviewer: '', 
    reviewerComment: '',
    workingType: 'Field Visit', 
    breakStart: '',
    breakEnd: '',
  });

  const [locations, setLocations] = useState(['']);
  const [customers, setCustomers] = useState([
    { 
      name: '', 
      type: 'Retail', 
      address: '', 
      phone: '', 
      remark: '', 
      isExpanded: true,
      orders: [{ packaging: '', quantity: '12' }] 
    }
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [submissionId, setSubmissionId] = useState(() => doc(collection(db, "fieldOfficerForms")).id);
  const [showRemarksModal, setShowRemarksModal] = useState(false);
  const [remarkSelections, setRemarkSelections] = useState({});
  const [sectionsExpanded, setSectionsExpanded] = useState({
    officerDetails: false,
    workInfo: false,
    visitedLocations: false,
    customersOrders: false,
    notesRemarks: false,
    reviewerSection: false,
    dailySummary: false
  });

  const toggleSection = (sectionKey) => {
    setSectionsExpanded(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  // --- Effects ---
  useEffect(() => {
    localStorage.setItem('officers', JSON.stringify(officers));
  }, [officers]);

  // --- Handlers ---
  const handleAddOfficer = () => {
    if (newOfficer.name && newOfficer.code) {
      const newList = [...officers, newOfficer];
      setOfficers(newList);
      setForm({ ...form, officerName: `${newOfficer.name} (${newOfficer.code})` });
      setNewOfficer({ name: '', code: '', type: 'Full Time' });
      setShowAddOfficer(false);
    }
  };

  const toggleCustomerExpansion = (index) => {
    const updated = [...customers];
    updated[index].isExpanded = !updated[index].isExpanded;
    setCustomers(updated);
  };

  const addLocationField = () => {
    setLocations([...locations, '']);
  };

  const handleLocationChange = (index, value) => {
    const updated = [...locations];
    updated[index] = value;
    setLocations(updated);
  };

  const addCustomer = () => {
    setCustomers([...customers, { 
      name: '', 
      type: 'Retail', 
      address: '', 
      phone: '', 
      remark: '', 
      isExpanded: true,
      orders: [{ packaging: '', quantity: '' }] 
    }]);
  };

  const updateCustomerField = (index, field, value) => {
    const updated = [...customers];
    updated[index][field] = value;
    setCustomers(updated);
  };

  const addOrder = (customerIndex) => {
    const updated = [...customers];
    updated[customerIndex].orders.push({ packaging: '', quantity: '' });
    setCustomers(updated);
  };

  const updateOrderField = (customerIndex, orderIndex, field, value) => {
    const updated = [...customers];
    updated[customerIndex].orders[orderIndex][field] = value;
    setCustomers(updated);
  };

  const calculateHours = () => {
    if (!form.punchIn || !form.punchOut) return 0;
    const [inH, inM] = form.punchIn.split(':').map(Number);
    const [outH, outM] = form.punchOut.split(':').map(Number);
    const inMin = inH * 60 + inM;
    const outMin = outH * 60 + outM;
    let totalWorkMin = outMin - inMin;
    if (form.breakStart && form.breakEnd) {
      const [bStartH, bStartM] = form.breakStart.split(':').map(Number);
      const [bEndH, bEndM] = form.breakEnd.split(':').map(Number);
      const breakMin = (bEndH * 60 + bEndM) - (bStartH * 60 + bStartM);
      totalWorkMin -= breakMin;
    }
    return (totalWorkMin / 60).toFixed(2);
  };

  const getTotalOrders = () => {
    let total = 0;
    customers.forEach(c => {
      c.orders.forEach(o => {
        total += Number(o.quantity) || 0;
      });
    });
    return total;
  };

  const getFoodAllowance = () => 15.00;
  const getFuelReimbursement = () => 34.20;
  const getTotalAmount = () => getFoodAllowance() + getFuelReimbursement();

  const handleRemarkSelect = (id, value) => {
    setRemarkSelections(prev => ({ ...prev, [id]: value }));
  };

  const generateFormattedRemarks = () => {
    const parts = [];
    REMARK_QUESTIONS.forEach(q => {
      if (remarkSelections[q.id]) {
        parts.push(`${q.label}: ${remarkSelections[q.id]}`);
      }
    });
    return parts.join(' | ');
  };

  const handleDoneRemarks = () => {
    const formatted = generateFormattedRemarks();
    setForm({ ...form, remarks: formatted });
    setShowRemarksModal(false);
  };

  // --- Export & Submit ---
  const exportToPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF();
      doc.setFont('helvetica');

      let y = 14;
      const lineGap = 8;

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Daily Form Report', 14, y);
      y += lineGap + 2;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');

      const addField = (label, value) => {
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}:`, 14, y);
        doc.setFont('helvetica', 'normal');
        doc.text(value || '-', 60, y);
        y += lineGap;
      };

      addField('Officer Name', form.officerName);
      addField('Date', form.date);
      addField('Working Type', form.workingType);
      addField('Punch In', form.punchIn);
      addField('Punch Out', form.punchOut);
      addField('Break Start', form.breakStart);
      addField('Break End', form.breakEnd);
      addField('KMs Travelled', form.kms);
      addField('Total Working Hours', `${calculateHours()} hrs`);
      addField('Entry By', form.entryBy);
      addField('Reviewer', form.reviewer);

      if (customers.length > 0) {
        y += 4;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text('Customer & Order Details', 14, y);
        y += lineGap;

        const body = [];
        customers.forEach(c => {
          c.orders.forEach(o => {
            body.push([c.name || '-', c.phone || '-', c.type || '-', o.packaging || '-', o.quantity || '-']);
          });
        });

        autoTable(doc, {
          startY: y,
          head: [['Customer', 'Phone', 'Type', 'Package', 'Qty']],
          body: body,
          theme: 'grid',
          styles: { font: 'helvetica', fontSize: 10 },
          headStyles: { fillColor: [37, 99, 235] },
        });
      }

      doc.save(`DailyFormReport_${form.officerName || 'Report'}_${form.date || ''}.pdf`);
      toast.success('PDF downloaded successfully! 📄');
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.error('Failed to generate PDF. Please try again.');
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        locations,
        customers,
        remarkSelections, // Store raw selections too
        totalAmount: getTotalAmount(),
        createdAt: new Date().toISOString(),
        submissionId,
      };

      const docRef = doc(db, "fieldOfficerForms", submissionId);
      const writePromise = setDoc(docRef, payload);
      const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve("timeout"), 2000));

      const result = await Promise.race([writePromise, timeoutPromise]);

      if (result === "timeout") {
        toast.info("Form saved locally. Syncing in background when online... 📲");
      } else {
        toast.success('Form submitted successfully! ✓');
      }

      // Pre-generate a new ID for the next potential submission
      setSubmissionId(doc(collection(db, "fieldOfficerForms")).id);
      navigate('/history');
    } catch (err) {
      console.error("Submission error:", err);
      toast.error('Something went wrong. Please try again.');
    }
    setSubmitting(false);
  };

  // --- Icons ---
  const Icons = {
    Person: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    Calendar: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    MapPin: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
    Users: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    Clipboard: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>,
    MessageSquare: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    Calculator: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/></svg>,
    ChevronDown: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
    ChevronUp: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>,
    Plus: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    Download: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
    Send: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
    Map: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>,
    CheckCircle: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  };

  return (
    <>
      <Navbar />
      <div className="daily-form-page">
      <div className="daily-form-container">
        {/* Officer Details */}
        <section className="form-section section-dotted">
          <div 
            className="section-header" 
            onClick={() => toggleSection('officerDetails')} 
            style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', width: '100%', marginBottom: sectionsExpanded.officerDetails ? '20px' : '0' }}
          >
            <span className="section-icon"><Icons.Person /></span>
            <span className="section-title">Officer Details</span>
            <span className="section-icon" style={{ marginLeft: 'auto' }}>
              {sectionsExpanded.officerDetails ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
            </span>
          </div>
          
          {sectionsExpanded.officerDetails && (
            <>
              <div className="field-group">
                <label className="field-label">OFFICER NAME:</label>
                <select 
                  className="select-field"
                  value={form.officerName}
                  onChange={(e) => setForm({ ...form, officerName: e.target.value })}
                >
                  <option value="">Select Officer</option>
                  {officers.map((o, i) => (
                    <option key={i} value={`${o.name} (${o.code})`}>
                      {o.name} ({o.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="field-group">
                <label className="field-label">OFFICER NAME:</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Full Name"
                  value={newOfficer.name} 
                  onChange={(e) => setNewOfficer({ ...newOfficer, name: e.target.value })}
                />
              </div>

              <div className="field-group">
                <label className="field-label">OFFICER CODE:</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Code (e.g. GJ03)"
                  value={newOfficer.code} 
                  onChange={(e) => setNewOfficer({ ...newOfficer, code: e.target.value })}
                />
              </div>

              <div className="field-group">
                <label className="field-label">OFFICER TYPE:</label>
                <select 
                  className="select-field"
                  value={newOfficer.type} 
                  onChange={(e) => setNewOfficer({ ...newOfficer, type: e.target.value })}
                >
                  <option value="Full Time">Full Time</option>
                  <option value="Part Time">Part Time</option>
                </select>
              </div>

              <div className="btn-row">
                <button className="btn-text" onClick={() => setShowAddOfficer(false)}>Cancel</button>
                <button className="btn-blue" onClick={handleAddOfficer}>
                  <Icons.CheckCircle /> Add Officer
                </button>
              </div>
            </>
          )}
        </section>

        {/* Work Information */}
        <section className="form-section section-dotted">
          <div 
            className="section-header" 
            onClick={() => toggleSection('workInfo')} 
            style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', width: '100%', marginBottom: sectionsExpanded.workInfo ? '20px' : '0' }}
          >
            <span className="section-icon"><Icons.Calendar /></span>
            <span className="section-title">Work Information</span>
            <span className="section-icon" style={{ marginLeft: 'auto' }}>
              {sectionsExpanded.workInfo ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
            </span>
          </div>

          {sectionsExpanded.workInfo && (
            <>
              <div className="field-group">
                <label className="field-label">DATE</label>
                <input 
                  type="date" 
                  className="input-field" 
                  value={form.date} 
                  onChange={(e) => setForm({ ...form, date: e.target.value })} 
                />
              </div>

              <div className="field-group">
                <label className="field-label">WORKING TYPE</label>
                <select 
                  className="select-field"
                  value={form.workingType} 
                  onChange={(e) => setForm({ ...form, workingType: e.target.value })}
                >
                  <option value="Field Visit">Field Visit</option>
                  <option value="Office Work">Office Work</option>
                  <option value="Leave">Leave</option>
                  <option value="Mixed">Mixed</option>
                </select>
              </div>

              <div className="field-row">
                <div className="field-group">
                  <label className="field-label">PUNCH IN</label>
                  <input 
                    type="time" 
                    className="input-field" 
                    value={form.punchIn} 
                    onChange={(e) => setForm({ ...form, punchIn: e.target.value })} 
                  />
                </div>
                <div className="field-group">
                  <label className="field-label">PUNCH OUT</label>
                  <input 
                    type="time" 
                    className="input-field" 
                    value={form.punchOut} 
                    onChange={(e) => setForm({ ...form, punchOut: e.target.value })} 
                  />
                </div>
              </div>

              <div className="field-row">
                <div className="field-group">
                  <label className="field-label">BREAK START</label>
                  <input 
                    type="time" 
                    className="input-field" 
                    value={form.breakStart} 
                    onChange={(e) => setForm({ ...form, breakStart: e.target.value })} 
                  />
                </div>
                <div className="field-group">
                  <label className="field-label">BREAK END</label>
                  <input 
                    type="time" 
                    className="input-field" 
                    value={form.breakEnd} 
                    onChange={(e) => setForm({ ...form, breakEnd: e.target.value })} 
                  />
                </div>
              </div>

              <div className="field-group">
                <label className="field-label">KMS TRAVELLED</label>
                <input 
                  type="number" 
                  step="0.1"
                  className="input-field" 
                  value={form.kms} 
                  onChange={(e) => setForm({ ...form, kms: e.target.value })} 
                />
              </div>
            </>
          )}
        </section>

        {/* Visited Locations */}
        <section className="form-section">
          <div 
            className="section-header" 
            onClick={() => toggleSection('visitedLocations')} 
            style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', width: '100%', marginBottom: sectionsExpanded.visitedLocations ? '20px' : '0' }}
          >
            <span className="section-icon"><Icons.MapPin /></span>
            <span className="section-title">Visited Locations</span>
            <span className="section-icon" style={{ marginLeft: 'auto' }}>
              {sectionsExpanded.visitedLocations ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
            </span>
          </div>

          {sectionsExpanded.visitedLocations && (
            <>
              {locations.map((loc, i) => (
                <div key={i} className="location-input-group">
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder={`Enter Location ${i + 1}`}
                    value={loc}
                    onChange={(e) => handleLocationChange(i, e.target.value)}
                  />
                  <span className="location-icon"><Icons.Map /></span>
                </div>
              ))}

              <button className="btn-add-location" onClick={addLocationField}>
                <Icons.MapPin /> Add Location
              </button>
            </>
          )}
        </section>

        {/* Customers & Orders */}
        <section className="form-section">
          <div 
            className="section-header" 
            onClick={() => toggleSection('customersOrders')} 
            style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', width: '100%', marginBottom: sectionsExpanded.customersOrders ? '20px' : '0' }}
          >
            <span className="section-icon"><Icons.Users /></span>
            <span className="section-title">Customers & Orders</span>
            <span className="section-icon" style={{ marginLeft: 'auto' }}>
              {sectionsExpanded.customersOrders ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
            </span>
          </div>

          {sectionsExpanded.customersOrders && (
            <>
              {customers.map((c, i) => (
                <div key={i} className="customer-card">
                  <div className="customer-card-header" onClick={() => toggleCustomerExpansion(i)}>
                    <div>
                      <h4>{c.name || "Customer Name"}</h4>
                      <p>{c.type || "RETAILER"}</p>
                    </div>
                    <span className="section-icon">
                      {c.isExpanded ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
                    </span>
                  </div>
                  
                  {c.isExpanded && (
                    <div className="customer-card-content">
                      <div className="field-group">
                        <label className="field-label">CUSTOMER NAME</label>
                        <input 
                          type="text" 
                          className="input-field" 
                          value={c.name}
                          onChange={(e) => updateCustomerField(i, 'name', e.target.value)}
                        />
                      </div>

                      <div className="field-row">
                        <div className="field-group">
                          <label className="field-label">PHONE</label>
                          <input 
                            type="tel" 
                            className="input-field" 
                            placeholder="10 Digits mobile"
                            value={c.phone}
                            onChange={(e) => updateCustomerField(i, 'phone', e.target.value)}
                          />
                        </div>
                        <div className="field-group">
                          <label className="field-label">TYPE</label>
                          <select 
                            className="select-field"
                            value={c.type}
                            onChange={(e) => updateCustomerField(i, 'type', e.target.value)}
                          >
                            <option value="Retail">Retail</option>
                            <option value="Distributor">Distributor</option>
                          </select>
                        </div>
                      </div>

                      <div className="order-details-section">
                        <div className="order-details-header">
                          <Icons.Calculator />
                          <span>ORDER DETAILS</span>
                        </div>

                        {c.orders.map((o, j) => (
                          <div key={j} className="order-row">
                            <select 
                              className="select-field"
                              value={o.packaging}
                              onChange={(e) => updateOrderField(i, j, 'packaging', e.target.value)}
                            >
                              <option value="">Select Order</option>
                              <option value="1L JAR">1L JAR</option>
                              <option value="2L JAR">2L JAR</option>
                              <option value="5L PLASTIC JAR">5L PLASTIC JAR</option>
                              <option value="5L STEEL BARNI">5L STEEL BARNI</option>
                              <option value="10 LTR JAR">10 LTR JAR</option>
                              <option value="10 LTR STEEL BARNI">10 LTR STEEL BARNI</option>
                              <option value="20 LTR CARBO">20 LTR CARBO</option>
                              <option value="20 LTR CAN">20 LTR CAN</option>
                              <option value="20 LTR STEEL BARNI">20 LTR STEEL BARNI</option>
                            </select>
                            <input 
                              type="number" 
                              className="input-field" 
                              value={o.quantity}
                              onChange={(e) => updateOrderField(i, j, 'quantity', e.target.value)}
                            />
                          </div>
                        ))}

                        <button className="btn-add-order" onClick={() => addOrder(i)}>
                          <Icons.Plus /> Add Order
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <button className="btn-blue btn-full" onClick={addCustomer} style={{ marginBottom: 20 }}>
                <Icons.Person /> Add New Customer
              </button>
            </>
          )}
        </section>

        {/* Notes & Remarks */}
        <section className="form-section">
          <div 
            className="section-header" 
            onClick={() => toggleSection('notesRemarks')} 
            style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', width: '100%', marginBottom: sectionsExpanded.notesRemarks ? '20px' : '0' }}
          >
            <span className="section-icon"><Icons.Clipboard /></span>
            <span className="section-title">Notes & Remarks</span>
            <span className="section-icon" style={{ marginLeft: 'auto' }}>
              {sectionsExpanded.notesRemarks ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
            </span>
          </div>

          {sectionsExpanded.notesRemarks && (
            <>
              <div className="field-group">
                <label className="field-label">ENTRY BY</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Your Name"
                  value={form.entryBy} 
                  onChange={(e) => setForm({ ...form, entryBy: e.target.value })} 
                />
              </div>

              <div className="field-group">
                <label className="field-label">GENERAL NOTES</label>
                <textarea 
                  className="textarea-field" 
                  placeholder="Enter field observations..."
                  rows="4"
                  value={form.notes} 
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              <div className="field-group" onClick={() => setShowRemarksModal(true)} style={{ cursor: 'pointer' }}>
                <label className="field-label">SPECIFIC REMARKS</label>
                <div className="textarea-field" style={{ minHeight: '80px', background: '#f1f5f9', color: form.remarks ? '#1e293b' : '#94a3b8' }}>
                  {form.remarks || "Tap to set visit remarks..."}
                </div>
              </div>
            </>
          )}
        </section>

        {/* Reviewer Section */}
        <section className="form-section section-dotted">
          <div 
            className="section-header" 
            onClick={() => toggleSection('reviewerSection')} 
            style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', width: '100%', marginBottom: sectionsExpanded.reviewerSection ? '20px' : '0' }}
          >
            <span className="section-icon"><Icons.MessageSquare /></span>
            <span className="section-title">Reviewer Section</span>
            <span className="section-icon" style={{ marginLeft: 'auto' }}>
              {sectionsExpanded.reviewerSection ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
            </span>
          </div>

          {sectionsExpanded.reviewerSection && (
            <>
              <div className="field-group">
                <label className="field-label">SELECT REVIEWER</label>
                <select 
                  className="select-field"
                  value={form.reviewer} 
                  onChange={(e) => setForm({ ...form, reviewer: e.target.value })}
                >
                  <option value="">Assigned Manager</option>
                  <option value="Maulik Shah">Maulik Shah</option>
                  <option value="Jigar Shah">Jigar Shah</option>
                  <option value="Sonal Madam">Sonal Madam</option>
                  <option value="Bhavin Prajapati">Bhavin Prajapati</option>
                  <option value="Jash Ilasariya">Jash Ilasariya</option>
                  <option value="Shubham">Shubham</option>
                </select>
              </div>

              <div className="field-group">
                <textarea 
                  className="textarea-field" 
                  placeholder="Manager comments will appear here..."
                  rows="3"
                  value={form.reviewerComment} 
                  onChange={(e) => setForm({ ...form, reviewerComment: e.target.value })}
                />
              </div>
            </>
          )}
        </section>

        {/* Daily Summary */}
        <section className="form-section summary-section">
          <div 
            className="section-header" 
            onClick={() => toggleSection('dailySummary')} 
            style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', width: '100%', marginBottom: sectionsExpanded.dailySummary ? '20px' : '0' }}
          >
            <span className="section-icon"><Icons.Calculator /></span>
            <span className="section-title">Daily Summary</span>
            <span className="section-icon" style={{ marginLeft: 'auto' }}>
              {sectionsExpanded.dailySummary ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
            </span>
          </div>

          {sectionsExpanded.dailySummary && (
            <>
              <div className="summary-row">
                <span>Total Orders</span>
                <span>{getTotalOrders()} Units</span>
              </div>
              <div className="summary-row">
                <span>Food Allowance</span>
                <span>₹{getFoodAllowance().toFixed(2)}</span>
              </div>
              <div className="summary-row">
                <span>Fuel Reimbursement</span>
                <span>₹{getFuelReimbursement().toFixed(2)}</span>
              </div>

              <div className="summary-divider"></div>

              <div className="total-amount-row">
                <span className="total-label">Total Amount</span>
                <span className="total-value">₹{getTotalAmount().toFixed(2)}</span>
              </div>
            </>
          )}
        </section>

        {/* Action Buttons */}
        <div className="form-actions" style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button className="btn-blue btn-full" style={{ backgroundColor: '#2563eb' }} onClick={exportToPDF}>
            <Icons.Download /> Download PDF
          </button>
          <button className="btn-blue btn-full" style={{ backgroundColor: '#2563eb' }} onClick={handleSubmit} disabled={submitting}>
            <Icons.Send /> {submitting ? 'Submitting...' : 'Submit to Company'}
          </button>
        </div>


      </div>

      {/* Remarks Modal */}
      {showRemarksModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>VISIT REMARKS</h3>
            </div>
            <div className="modal-body">
              {REMARK_QUESTIONS.map(q => (
                <div key={q.id} className="remark-row">
                  <span className="remark-question">{q.label}</span>
                  <div className="remark-options">
                    {q.options.map(opt => (
                      <label key={opt} className="remark-option">
                        <input 
                          type="radio" 
                          name={q.id} 
                          value={opt}
                          checked={remarkSelections[q.id] === opt}
                          onChange={() => handleRemarkSelect(q.id, opt)}
                        />
                        <div className="radio-custom">
                          <div className="radio-dot"></div>
                        </div>
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn-done" onClick={handleDoneRemarks}>
                Done <Icons.CheckCircle />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
