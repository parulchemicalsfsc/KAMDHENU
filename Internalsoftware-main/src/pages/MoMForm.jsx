import React, { useState, useEffect } from "react";
import { toast } from 'react-toastify';
import { db } from "../firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import Navbar from "../components/Navbar";
import "../style/form.css";

const participantsList = [
  "JASH ILASARIYA", "SONAL MADAM", "BHAVIN PRAJAPATI", "MAULIC SHAH",
  "JIGAR SHAH", "SHUBHAM", "MISTRY SIR", "JYOTIKA", "BHAVISHA",
  "PARUL BEN", "MALA BEN", "PRIYANKA BEN", "OMKAR SIR", "SANKET SIR", "ALPESH SIR"
];

// ── Image compression helper ──────────────────────────────────────────────────
const compressImage = (file, maxW = 800, maxH = 800, quality = 0.75) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxW) { h = Math.round((h * maxW) / w); w = maxW; }
        if (h > maxH) { w = Math.round((w * maxH) / h); h = maxH; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  card: {
    background: '#fff', borderRadius: 14,
    boxShadow: '0 2px 16px rgba(37,99,235,0.07)',
    border: '1px solid #e0eaff', padding: '24px 20px', marginBottom: 24,
  },
  label: { fontWeight: 700, color: '#174ea6', marginBottom: 6, display: 'block', fontSize: '0.9rem' },
  input: {
    width: '100%', borderRadius: 8, padding: '9px 12px',
    border: '1.5px solid #b6c7e6', fontFamily: 'inherit',
    fontSize: '0.95rem', boxSizing: 'border-box', outline: 'none',
  },
  btn: (bg) => ({
    flex: 1, minWidth: 140, background: bg, color: '#fff',
    border: 'none', borderRadius: 8, padding: '11px 16px',
    fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem',
    transition: 'opacity 0.2s',
  }),
};

// ── Main Component ────────────────────────────────────────────────────────────
const MoMForm = () => {
  // Form state
  const [meetingName, setMeetingName] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState({ lat: '', lng: '' });
  const [participants, setParticipants] = useState([]);
  const [manualParticipant, setManualParticipant] = useState('');
  const [points, setPoints] = useState([]);
  const [currentPoint, setCurrentPoint] = useState('');
  const [summary, setSummary] = useState(null);
  const [image, setImage] = useState(null);          // base64 compressed
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude.toFixed(5), lng: pos.coords.longitude.toFixed(5) }),
      () => {}
    );
    setDate(new Date().toISOString().split('T')[0]);
  }, []);

  // ── Image upload + compress ──────────────────────────────────────────────
  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('Image too large (>10MB)'); return; }
    setUploadingImage(true);
    try {
      const compressed = await compressImage(file);
      setImage(compressed);
      setImagePreview(compressed);
      toast.success('Photo loaded & compressed ✓');
    } catch {
      toast.error('Image processing failed');
    }
    setUploadingImage(false);
  };

  // ── Participants ──────────────────────────────────────────────────────────
  const handleParticipantChange = (e) => {
    setParticipants(Array.from(e.target.selectedOptions).map(o => o.value));
  };

  // ── Discussion Points ─────────────────────────────────────────────────────
  const handleAddPoint = () => {
    if (currentPoint.trim()) {
      setPoints(prev => [...prev, currentPoint.trim()]);
      setCurrentPoint('');
    }
  };

  const handleRemovePoint = (i) => setPoints(prev => prev.filter((_, idx) => idx !== i));

  // ── Generate Summary ──────────────────────────────────────────────────────
  const generateSummary = () => {
    if (points.length === 0) { toast.warn('Add at least one discussion point first'); return; }
    const discussion = points.map((pt, i) => `${i + 1}. ${pt}`).join('\n');
    const actions = points
      .filter(pt => pt.toLowerCase().includes('action') || pt.toLowerCase().includes('to do') || pt.toLowerCase().includes('todo'))
      .map(pt => `• ${pt}`)
      .join('\n');
    setSummary({ discussion, actions });
    toast.success('Summary generated!');
  };

  // ── Save to Firestore ─────────────────────────────────────────────────────
  const saveToFirestore = async () => {
    if (!meetingName.trim()) { toast.error('Please enter a meeting name'); return; }
    if (points.length === 0) { toast.error('Add at least one discussion point'); return; }
    setSaving(true);
    try {
      const payload = {
        meetingName: meetingName.trim(),
        date,
        location,
        participants,
        manualParticipant,
        points,
        summary,
        image: image || null,
        timestamp: Timestamp.now(),
      };
      await addDoc(collection(db, 'demo_moms'), payload);
      toast.success('Minutes of Meeting saved! ✓');
      // Reset form
      setMeetingName(''); setParticipants([]); setManualParticipant('');
      setPoints([]); setSummary(null); setImage(null); setImagePreview(null);
      setDate(new Date().toISOString().split('T')[0]);
    } catch (e) {
      toast.error('Save failed: ' + e.message);
    }
    setSaving(false);
  };

  // ── Generate PDF ──────────────────────────────────────────────────────────
  const generatePDF = async (momData) => {
    // momData = past record, or null = use current form state
    const data = momData || {
      meetingName,
      date,
      location,
      participants,
      manualParticipant,
      points,
      summary,
      image,
    };

    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      let y = 16;

      // Header
      doc.setFillColor(13, 110, 253);
      doc.rect(0, 0, 210, 28, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Minutes of Meeting', 14, 18);
      y = 36;

      // Meeting Name
      doc.setTextColor(13, 110, 253);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(data.meetingName || 'Untitled Meeting', 14, y); y += 8;

      // Date & Location
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text(`Date: ${data.date || '-'}`, 14, y); y += 6;
      if (data.location?.lat) {
        doc.text(`Location: ${data.location.lat}, ${data.location.lng}`, 14, y); y += 6;
      }
      y += 3;

      // Divider line
      doc.setDrawColor(200, 200, 230);
      doc.line(14, y, 196, y); y += 6;

      // Participants
      const allP = [...(Array.isArray(data.participants) ? data.participants : []), data.manualParticipant]
        .filter(Boolean);
      if (allP.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(13, 110, 253);
        doc.setFontSize(11);
        doc.text(`Participants (${allP.length}):`, 14, y); y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50, 50, 50);
        doc.setFontSize(10);
        allP.forEach(p => {
          if (y > 272) { doc.addPage(); y = 15; }
          doc.text(`• ${p}`, 20, y); y += 5;
        });
        y += 3;
      }

      // Discussion Points
      if ((data.points || []).length > 0) {
        if (y > 250) { doc.addPage(); y = 15; }
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(13, 110, 253);
        doc.setFontSize(11);
        doc.text('Discussion Points:', 14, y); y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50, 50, 50);
        doc.setFontSize(10);
        data.points.forEach((pt, i) => {
          if (y > 272) { doc.addPage(); y = 15; }
          const lines = doc.splitTextToSize(`${i + 1}. ${pt}`, 174);
          doc.text(lines, 20, y);
          y += lines.length * 5 + 2;
        });
        y += 3;
      }

      // Summary
      if (data.summary?.discussion) {
        if (y > 250) { doc.addPage(); y = 15; }
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(22, 101, 52);
        doc.setFontSize(11);
        doc.text('Meeting Summary:', 14, y); y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50, 50, 50);
        doc.setFontSize(10);
        const sumLines = doc.splitTextToSize(data.summary.discussion, 174);
        sumLines.forEach(line => {
          if (y > 275) { doc.addPage(); y = 15; }
          doc.text(line, 20, y); y += 5;
        });
        y += 3;
      }

      // Action Items
      if (data.summary?.actions) {
        if (y > 250) { doc.addPage(); y = 15; }
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(185, 28, 28);
        doc.setFontSize(11);
        doc.text('Action Items:', 14, y); y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50, 50, 50);
        doc.setFontSize(10);
        const actLines = doc.splitTextToSize(data.summary.actions, 174);
        actLines.forEach(line => {
          if (y > 275) { doc.addPage(); y = 15; }
          doc.text(line, 20, y); y += 5;
        });
      }

      const fileName = `MoM_${(data.meetingName || 'meeting').replace(/\s+/g, '_')}_${data.date || ''}.pdf`;
      doc.save(fileName);
      toast.success('PDF exported! 📄');
    } catch (e) {
      console.error(e);
      toast.error('PDF export failed: ' + e.message);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <Navbar />
      <div style={{ padding: 'clamp(10px, 3vw, 24px)', background: '#f0f4ff', minHeight: '100vh' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>

          {/* ═══ PAGE HEADER ═══ */}
          <div style={{
            background: 'linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%)',
            borderRadius: '16px 16px 0 0', padding: '20px 24px',
            color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 0,
          }}>
            <div>
              <h2 style={{ margin: 0, fontWeight: 800, fontSize: '1.5rem' }}>📋 Minutes of Meeting</h2>
              <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: '0.88rem' }}>Create and manage meeting records</p>
            </div>
          </div>

          <div style={{ background: '#f7fafd', borderRadius: '0 0 16px 16px', border: '1px solid #d1e3f8', borderTop: 'none', boxShadow: '0 8px 32px rgba(13,110,253,0.08)', padding: 24 }}>

            {/* ═══ NEW MOM FORM ═══ */}
            <div style={S.card}>
              <h3 style={{ margin: '0 0 20px', color: '#174ea6', fontWeight: 800, fontSize: '1.05rem', borderBottom: '2px solid #e3f0fb', paddingBottom: 12 }}>
                ✏️ New MoM Entry
              </h3>

              {/* Meeting Name */}
              <div style={{ marginBottom: 18 }}>
                <label style={S.label}>
                  Meeting Name / Title <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={meetingName}
                  onChange={e => setMeetingName(e.target.value)}
                  placeholder="e.g. Weekly Sales Review, Monthly Planning..."
                  style={{ ...S.input, fontSize: '1rem', fontWeight: 500 }}
                />
              </div>

              {/* Date + Location */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 18 }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={S.label}>Date</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} style={S.input} />
                </div>
                <div style={{ flex: 2, minWidth: 200 }}>
                  <label style={S.label}>Location</label>
                  <div style={{ padding: '9px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', color: '#475569', fontSize: '0.9rem' }}>
                    {location.lat ? `📍 ${location.lat}, ${location.lng}` : '⏳ Fetching location...'}
                  </div>
                </div>
              </div>

              {/* Image Upload */}
              <div style={{ marginBottom: 20 }}>
                <label style={S.label}>📷 Meeting Photo</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                  {/* Circle preview */}
                  <div
                    onClick={() => document.getElementById('mom-img-input').click()}
                    style={{
                      width: 76, height: 76, borderRadius: '50%',
                      border: `2.5px ${imagePreview ? 'solid #3b82f6' : 'dashed #93c5fd'}`,
                      background: imagePreview ? 'transparent' : '#eff6ff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden', flexShrink: 0, cursor: 'pointer',
                      boxShadow: imagePreview ? '0 2px 10px rgba(59,130,246,0.3)' : 'none',
                      transition: 'box-shadow 0.2s',
                    }}
                  >
                    {imagePreview
                      ? <img src={imagePreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: '2rem' }}>📷</span>
                    }
                  </div>
                  <div>
                    <input id="mom-img-input" type="file" accept="image/*" capture="environment" onChange={handleImageChange} style={{ display: 'none' }} />
                    <button
                      type="button"
                      onClick={() => document.getElementById('mom-img-input').click()}
                      disabled={uploadingImage}
                      style={{ background: '#e0eaff', color: '#2563eb', border: '1.5px solid #93c5fd', borderRadius: 8, padding: '8px 18px', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem' }}
                    >
                      {uploadingImage ? '⏳ Processing...' : imagePreview ? '🔄 Change Photo' : '📷 Upload Photo'}
                    </button>
                    {imagePreview && (
                      <button
                        type="button"
                        onClick={() => { setImage(null); setImagePreview(null); }}
                        style={{ marginLeft: 8, background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: 8, padding: '8px 12px', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem' }}
                      >✕ Remove</button>
                    )}
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 5 }}>Auto-compressed • JPEG • Max 10MB</div>
                  </div>
                </div>
              </div>

              {/* Participants */}
              <div style={{ marginBottom: 18 }}>
                <label style={S.label}>👥 Participants <span style={{ fontWeight: 400, color: '#64748b' }}>(hold Ctrl/Cmd for multiple)</span></label>
                <select
                  multiple
                  value={participants}
                  onChange={handleParticipantChange}
                  style={{ ...S.input, minHeight: 110, padding: 8 }}
                >
                  {participantsList.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                {participants.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {participants.map(p => (
                      <span key={p} style={{ background: '#dbeafe', color: '#1d4ed8', borderRadius: 20, padding: '3px 10px', fontSize: '0.78rem', fontWeight: 700 }}>{p}</span>
                    ))}
                  </div>
                )}
                <input
                  type="text"
                  value={manualParticipant}
                  placeholder="Other participants (comma separated)..."
                  onChange={e => setManualParticipant(e.target.value)}
                  style={{ ...S.input, marginTop: 10 }}
                />
              </div>

              {/* Discussion Points */}
              <div style={{ marginBottom: 18 }}>
                <label style={S.label}>📌 Discussion Points</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <textarea
                    value={currentPoint}
                    onChange={e => setCurrentPoint(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddPoint(); } }}
                    placeholder="Type a discussion point... (press Enter to add)"
                    style={{ flex: 1, borderRadius: 8, padding: 10, border: '1.5px solid #b6c7e6', fontFamily: 'inherit', minHeight: 52, resize: 'vertical', fontSize: '0.9rem' }}
                  />
                  <button
                    onClick={handleAddPoint}
                    style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, padding: '0 20px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.9rem' }}
                  >+ Add</button>
                </div>

                {points.length > 0 && (
                  <div style={{ marginTop: 12, padding: '12px 16px', background: '#f0f7ff', borderRadius: 10, border: '1px solid #bfdbfe' }}>
                    <div style={{ fontWeight: 700, color: '#1d4ed8', marginBottom: 8, fontSize: '0.88rem' }}>
                      📌 {points.length} Discussion Point{points.length !== 1 ? 's' : ''} added
                    </div>
                    <ol style={{ margin: 0, paddingLeft: 18, color: '#334155' }}>
                      {points.map((pt, i) => (
                        <li key={i} style={{ marginBottom: 5, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, fontSize: '0.88rem' }}>
                          <span>{pt}</span>
                          <button onClick={() => handleRemovePoint(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem', flexShrink: 0, lineHeight: 1 }}>✕</button>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 24 }}>
                <button onClick={generateSummary} style={S.btn('#3b82f6')}>📊 Generate Summary</button>
                <button onClick={saveToFirestore} disabled={saving} style={{ ...S.btn('#8b5cf6'), opacity: saving ? 0.7 : 1 }}>
                  {saving ? '⏳ Saving...' : '💾 Save to Database'}
                </button>
                <button onClick={() => generatePDF(null)} style={S.btn('#ef4444')}>📄 Export as PDF</button>
              </div>

              {/* Summary Preview */}
              {summary && (
                <div style={{ marginTop: 20, padding: 18, background: '#f0fdf4', border: '2px solid #22c55e', borderRadius: 12 }}>
                  <h4 style={{ margin: '0 0 10px', color: '#166534', fontWeight: 700 }}>✅ Summary Preview</h4>
                  <pre style={{ whiteSpace: 'pre-wrap', color: '#15803d', fontSize: '0.88em', margin: 0, fontFamily: 'inherit' }}>{summary.discussion}</pre>
                  <h4 style={{ margin: '14px 0 8px', color: '#166534', fontWeight: 700 }}>⚡ Action Items</h4>
                  <pre style={{ whiteSpace: 'pre-wrap', color: '#b91c1c', fontSize: '0.88em', margin: 0, fontFamily: 'inherit', fontWeight: 600 }}>
                    {summary.actions || 'No specific action items found.'}
                  </pre>
                </div>
              )}
            </div>

            {/* MoM history has been moved to the History page → MoM History tab */}
            <div style={{ marginTop: 16, padding: '14px 18px', background: '#eff6ff', borderRadius: 10, border: '1px solid #bfdbfe', color: '#1e40af', fontSize: '0.88rem', fontWeight: 600 }}>
              📋 To view, manage or delete MoM records, go to the <strong>History</strong> page → <strong>🗒️ MoM History</strong> tab.
            </div>

          </div>
        </div>
      </div>
    </>
  );
};

export default MoMForm;
