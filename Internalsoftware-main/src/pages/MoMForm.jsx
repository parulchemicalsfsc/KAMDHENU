import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { db } from "../firebase";
import { collection, addDoc, getDocs, Timestamp, updateDoc, doc, deleteDoc } from "firebase/firestore";
import Navbar from "../components/Navbar";
import useAuth from "../hooks/useAuth";
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
  const [searchParams] = useSearchParams();
  const { role } = useAuth();

  // Refs
  const meetingInputRef = useRef(null);

  // Form state
  const [meetingName, setMeetingName] = useState('');
  const [allMoms, setAllMoms] = useState([]);
  const [collectionName, setCollectionName] = useState('');
  const [existingCollections, setExistingCollections] = useState([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState('new');
  const [editingDocId, setEditingDocId] = useState(null);
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

  // Modal dialog state
  const [isNewMeetingModalOpen, setIsNewMeetingModalOpen] = useState(false);
  const [newMeetingNameInput, setNewMeetingNameInput] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // ── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude.toFixed(5), lng: pos.coords.longitude.toFixed(5) }),
      () => {}
    );
    setDate(new Date().toISOString().split('T')[0]);

    // Fetch existing unique collectionNames from demo_moms and mom_collections
    const fetchCollections = async () => {
      try {
        const snap = await getDocs(collection(db, 'demo_moms'));
        const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllMoms(docs);

        const snapCols = await getDocs(collection(db, 'mom_collections'));
        const docsCols = snapCols.docs.map(doc => doc.data().name?.trim()).filter(Boolean);

        const cols = new Set();
        // Add existing collections from meetings
        docs.forEach(d => {
          if (d.collectionName) {
            cols.add(d.collectionName.trim());
          }
        });
        // Add collections from mom_collections
        docsCols.forEach(name => cols.add(name));

        const list = Array.from(cols).sort();

        // Pre-select/pre-fill after collection list has finished loading
        const colParam = searchParams.get('collection');
        const meetParam = searchParams.get('meeting');

        let activeCol = '';
        if (colParam) {
          activeCol = colParam.trim();
          if (activeCol && !list.includes(activeCol)) {
            list.push(activeCol);
            list.sort();
          }
          setCollectionName(activeCol);
        }
        setExistingCollections(list);

        if (activeCol) {
          const matchingMeetings = docs.filter(m => m.collectionName?.trim().toLowerCase() === activeCol.toLowerCase());
          
          if (meetParam && meetParam.trim()) {
            const trimmedMeet = meetParam.trim();
            // Check if there is an existing meeting matching this name
            const existingMeet = matchingMeetings.find(m => m.meetingName?.trim().toLowerCase() === trimmedMeet.toLowerCase());
            if (existingMeet) {
              setSelectedMeetingId(existingMeet.id);
              setMeetingName(existingMeet.meetingName || '');
              setDate(existingMeet.date || new Date().toISOString().split('T')[0]);
              setParticipants(existingMeet.participants || []);
              setManualParticipant(existingMeet.manualParticipant || '');
              setPoints(existingMeet.points || []);
              setSummary(existingMeet.summary || null);
              setImage(existingMeet.image || null);
              setImagePreview(existingMeet.image || null);
              setEditingDocId(existingMeet.id);
            } else {
              setSelectedMeetingId('new');
              setMeetingName(trimmedMeet);
              setEditingDocId(null);
            }
          } else {
            setSelectedMeetingId('new');
            const count = matchingMeetings.length;
            setMeetingName(`Meeting ${count + 1}`);
            setEditingDocId(null);
          }
        } else {
          setMeetingName("Meeting 1");
          setSelectedMeetingId('new');
          setEditingDocId(null);
        }
      } catch (err) {
        console.error("Error fetching collections:", err);
      }
    };
    fetchCollections();
  }, []);



  // Handlers for dynamic dropdown changes
  const handleCollectionChange = (newCol) => {
    setCollectionName(newCol);
    setSelectedMeetingId('');
    setEditingDocId(null);

    // Reset meeting details to start fresh
    setDate(new Date().toISOString().split('T')[0]);
    setParticipants([]);
    setManualParticipant('');
    setPoints([]);
    setSummary(null);
    setImage(null);
    setImagePreview(null);
    setMeetingName('');
  };

  const handleMeetingIdChange = (meetingId) => {
    setSelectedMeetingId(meetingId);

    if (!meetingId) {
      setMeetingName('');
      setEditingDocId(null);
      setDate(new Date().toISOString().split('T')[0]);
      setParticipants([]);
      setManualParticipant('');
      setPoints([]);
      setSummary(null);
      setImage(null);
      setImagePreview(null);
      return;
    }

    // Load existing meeting details
    const mom = allMoms.find(m => m.id === meetingId);
    if (mom) {
      setMeetingName(mom.meetingName || '');
      setDate(mom.date || new Date().toISOString().split('T')[0]);
      setParticipants(mom.participants || []);
      setManualParticipant(mom.manualParticipant || '');
      setPoints(mom.points || []);
      setSummary(mom.summary || null);
      setImage(mom.image || null);
      setImagePreview(mom.image || null);
      setEditingDocId(mom.id);

      // Focus and select input text so they can quickly rename or view
      setTimeout(() => {
        if (meetingInputRef.current) {
          meetingInputRef.current.focus();
          meetingInputRef.current.select();
        }
      }, 50);
    }
  };

  const handleOpenNewMeetingModal = () => {
    if (!collectionName) {
      toast.warn("Please select a collection first.");
      return;
    }
    // Determine the next sequential meeting name
    const matchingMeetings = allMoms.filter(m => m.collectionName?.trim().toLowerCase() === collectionName.trim().toLowerCase());
    const count = matchingMeetings.length;
    setNewMeetingNameInput(`Meeting ${count + 1}`);
    setIsNewMeetingModalOpen(true);
  };

  const handleCreateMeetingSubmit = async (e) => {
    e.preventDefault();
    const newName = newMeetingNameInput.trim();
    if (!newName) {
      toast.error("Please enter a meeting name.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        meetingName: newName,
        collectionName: collectionName,
        date: new Date().toISOString().split('T')[0],
        location: location,
        participants: [],
        manualParticipant: '',
        points: [],
        summary: null,
        image: null,
        timestamp: Timestamp.now()
      };
      
      const docRef = await addDoc(collection(db, 'demo_moms'), payload);
      toast.success(`Meeting "${newName}" created successfully! ✓`);
      
      // Re-fetch all moms
      const snap = await getDocs(collection(db, 'demo_moms'));
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllMoms(docs);
      
      // Select the newly created meeting in the dropdown
      setSelectedMeetingId(docRef.id);
      setMeetingName(newName);
      setEditingDocId(docRef.id);
      
      // Reset form states for the new meeting details
      setDate(payload.date);
      setParticipants([]);
      setManualParticipant('');
      setPoints([]);
      setSummary(null);
      setImage(null);
      setImagePreview(null);
      
      setIsNewMeetingModalOpen(false);
    } catch (err) {
      toast.error("Failed to create meeting: " + err.message);
    }
    setSaving(false);
  };

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
    const finalCollection = collectionName.trim();
    const finalMeeting = meetingName.trim();
    if (!finalMeeting) { toast.error('Please enter a meeting name'); return; }
    if (!finalCollection) { toast.error('Please select or enter a collection name'); return; }
    if (points.length === 0) { toast.error('Add at least one discussion point'); return; }
    setSaving(true);
    try {
      const payload = {
        meetingName: finalMeeting,
        collectionName: finalCollection,
        date,
        location,
        participants,
        manualParticipant,
        points,
        summary,
        image: image || null,
        timestamp: Timestamp.now(),
      };

      if (editingDocId) {
        await updateDoc(doc(db, 'demo_moms', editingDocId), payload);
        toast.success('Minutes of Meeting updated successfully! ✓');
      } else {
        await addDoc(collection(db, 'demo_moms'), payload);
        toast.success('New Minutes of Meeting saved! ✓');
      }

      // Form data is preserved after saving so the user can continue editing if they want.

      // Re-fetch existing collectionNames to update suggestions
      const snap = await getDocs(collection(db, 'demo_moms'));
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllMoms(docs);

      const snapCols = await getDocs(collection(db, 'mom_collections'));
      const docsCols = snapCols.docs.map(doc => doc.data().name?.trim()).filter(Boolean);

      const cols = new Set();
      docs.forEach(d => {
        if (d.collectionName) {
          cols.add(d.collectionName.trim());
        }
      });
      docsCols.forEach(name => cols.add(name));
      setExistingCollections(Array.from(cols).sort());
    } catch (e) {
      toast.error('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMeeting = (e) => {
    if (e) e.preventDefault();
    if (!editingDocId) return;
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteMeeting = async () => {
    setIsDeleteModalOpen(false);
    try {
      await deleteDoc(doc(db, 'demo_moms', editingDocId));
      toast.success('Meeting deleted successfully!');
      
      // Re-fetch all moms
      const snap = await getDocs(collection(db, 'demo_moms'));
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllMoms(docs);
      
      // Reset form
      setMeetingName('');
      setSelectedMeetingId('');
      setEditingDocId(null);
      setParticipants([]);
      setManualParticipant('');
      setPoints([]);
      setSummary(null);
      setImage(null);
      setImagePreview(null);
    } catch (e) {
      toast.error('Failed to delete: ' + e.message);
    }
  };


  // ── Generate PDF ──────────────────────────────────────────────────────────
  const generatePDF = async (momData) => {
    // momData = past record, or null = use current form state
    const data = momData || {
      meetingName: meetingName.trim(),
      collectionName: collectionName.trim(),
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

      // Collection Name
      if (data.collectionName) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(80, 80, 80);
        doc.text(`Collection: ${data.collectionName}`, 14, y); y += 6;
      }

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

              {/* Meeting Collection / Project Name */}
              <div style={{ marginBottom: 18 }}>
                <label style={S.label}>
                  Meeting Collection / List Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={collectionName}
                  onChange={e => handleCollectionChange(e.target.value)}
                  style={{ ...S.input, color: collectionName ? '#334155' : '#94a3b8', fontWeight: 500 }}
                >
                  <option value="">-- Select Collection / List Name --</option>
                  {existingCollections.map(c => (
                    <option key={c} value={c} style={{ color: '#334155' }}>{c}</option>
                  ))}
                </select>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 5 }}>
                  Select an existing collection. To create a new one, use the "➕ New Collection Flow" button on the History page.
                </div>
              </div>

              {/* Meeting Name / Title Selection */}
              {collectionName && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ marginBottom: 14 }}>
                    <label style={S.label}>
                      Enter New Meeting Name <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <select
                        value={selectedMeetingId}
                        onChange={e => handleMeetingIdChange(e.target.value)}
                        style={{ ...S.input, color: '#334155', fontWeight: 500, flex: 1, minWidth: '200px' }}
                      >
                        <option value="">-- Select Meeting --</option>
                        {allMoms
                          .filter(m => m.collectionName?.trim().toLowerCase() === collectionName.trim().toLowerCase())
                          .map((mom, idx) => (
                            <option key={mom.id} value={mom.id}>
                              {idx + 1}. {mom.meetingName || 'Untitled Meeting'}
                            </option>
                          ))
                        }
                      </select>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={handleOpenNewMeetingModal}
                          style={{ ...S.button, background: '#10b981', padding: '0 16px', whiteSpace: 'nowrap' }}
                        >
                          ➕ Create New Meeting
                        </button>
                        {editingDocId && (
                          <button
                            type="button"
                            onClick={handleDeleteMeeting}
                            style={{ ...S.button, background: '#ef4444', padding: '0 16px', whiteSpace: 'nowrap' }}
                            title="Delete this meeting"
                          >
                            🗑️ Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    Select an existing meeting to edit/view its details, or choose "Create New Meeting" to start a new record.
                  </div>
                </div>
              )}

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
                <button onClick={() => generatePDF(null)} style={S.btn('#10b981')}>📄 Export as PDF</button>
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

      {/* ── CREATE NEW MEETING MODAL ── */}
      {isNewMeetingModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: '#fff', padding: '24px', borderRadius: '12px',
            width: '90%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 16px', color: '#1e293b' }}>Create New Meeting</h3>
            <div style={{ marginBottom: '16px' }}>
              <label style={S.label}>Meeting Name</label>
              <input
                type="text"
                value={newMeetingNameInput}
                onChange={(e) => setNewMeetingNameInput(e.target.value)}
                style={{ ...S.input, fontSize: '1rem' }}
                placeholder="Enter meeting name..."
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setIsNewMeetingModalOpen(false)}
                style={{ ...S.button, background: '#e2e8f0', color: '#475569' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateMeetingSubmit}
                disabled={saving}
                style={{ ...S.button, background: '#10b981' }}
              >
                {saving ? 'Creating...' : 'Add Meeting'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ── */}
      {isDeleteModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: '#fff', padding: '24px', borderRadius: '12px',
            width: '90%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 16px', color: '#ef4444' }}>⚠️ Delete Meeting</h3>
            <p style={{ color: '#475569', marginBottom: '20px', lineHeight: '1.5' }}>
              Are you sure you want to permanently delete <strong>{meetingName}</strong>? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                style={{ ...S.button, background: '#e2e8f0', color: '#475569' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteMeeting}
                style={{ ...S.button, background: '#ef4444' }}
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MoMForm;
