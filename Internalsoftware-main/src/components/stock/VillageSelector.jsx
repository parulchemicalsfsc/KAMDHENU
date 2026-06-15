import React, { useState, useMemo, useRef, useEffect } from "react";
import { db } from "../../firebase";
import { addDoc, collection } from "firebase/firestore";
import { toast } from "react-toastify";

/**
 * VillageSelector Component
 * Compact village search with fuzzy matching and keyboard navigation
 */

// Fuzzy search function - finds matches even with typos
const fuzzySearch = (searchTerm, villages) => {
  if (!searchTerm.trim()) return [];
  
  const term = searchTerm.toLowerCase();
  
  return villages
    .map((village) => {
      const name = village?.name?.toLowerCase() || "";
      let score = 0;
      
      // Exact match at start = highest score
      if (name.startsWith(term)) score = 1000;
      // Exact match anywhere = high score
      else if (name.includes(term)) score = 500;
      // Fuzzy match
      else {
        let searchIdx = 0;
        for (let i = 0; i < name.length && searchIdx < term.length; i++) {
          if (name[i] === term[searchIdx]) {
            score += 100 - i; // Earlier matches score higher
            searchIdx++;
          }
        }
        if (searchIdx < term.length) return null; // Doesn't match
      }
      
      return { ...village, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
};

export const VillageSelector = ({ villageOptions, selectedVillageId, onVillageChange, label = "Select Village", showLabel = true }) => {
  const [addNewInput, setAddNewInput] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [newlyAddedVillageName, setNewlyAddedVillageName] = useState(null);
  const searchInputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Filter villages with fuzzy search
  const filteredVillages = useMemo(() => {
    return fuzzySearch(searchInput, villageOptions);
  }, [searchInput, villageOptions]);

  // Get the name of selected village for display
  const selectedVillageName = newlyAddedVillageName || villageOptions.find((v) => v.id === selectedVillageId)?.name || "";

  // Reset highlight when results change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [filteredVillages]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) && 
          searchInputRef.current && !searchInputRef.current.contains(event.target)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleVillageSelect = (villageId) => {
    onVillageChange(villageId);
    setSearchInput("");
    setShowSearchResults(false);
    setHighlightedIndex(-1);
    setNewlyAddedVillageName(null);
  };

  const handleCreateNewVillage = async () => {
    if (addNewInput.trim()) {
      const newVillageName = addNewInput.trim();
      try {
        // Save to Firebase villages collection
        const docRef = await addDoc(collection(db, "villages"), {
          name: newVillageName,
          createdAt: new Date(),
        });
        
        // Use the actual Firebase document ID
        onVillageChange(docRef.id);
        setNewlyAddedVillageName(newVillageName);
        setAddNewInput("");
        toast.success(`Village "${newVillageName}" added successfully! ✓`);
      } catch (err) {
        console.error("Error creating village:", err);
        toast.error("Could not add village. Please try again.");
      }
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!showSearchResults) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setShowSearchResults(true);
        setHighlightedIndex(0);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => 
          prev < filteredVillages.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0) {
          handleVillageSelect(filteredVillages[highlightedIndex].id);
        }
        break;
      case "Escape":
        e.preventDefault();
        setShowSearchResults(false);
        setHighlightedIndex(-1);
        break;
      default:
        break;
    }
  };
  return (
    <div style={{ 
      marginBottom: "30px", 
      padding: "24px", 
      backgroundColor: "#ffffff", 
      borderRadius: "16px",
      boxShadow: "0 10px 30px rgba(0, 0, 0, 0.05)",
      border: "1px solid rgba(226, 232, 240, 0.8)",
      position: "relative"
    }}>
      {/* Decorative gradient background element wrapped to contain overflow */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: "16px",
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 0
      }}>
        <div style={{
          position: "absolute",
          top: "-50%",
          left: "-50%",
          width: "200%",
          height: "200%",
          background: "radial-gradient(circle at 50% 0%, rgba(37, 99, 235, 0.03) 0%, transparent 50%)"
        }} />
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>
        {showLabel && (
          <h2 style={{ 
            fontWeight: "700", 
            fontSize: "1.25rem",
            color: "#1e293b",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            <span style={{ fontSize: "1.4rem" }}>📍</span> {label}
          </h2>
        )}

        {/* Selected Village Display - Prominent */}
        {selectedVillageId && (
          <div style={{ 
            marginBottom: "24px", 
            padding: "16px 20px", 
            background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)", 
            borderRadius: "12px", 
            fontSize: "16px", 
            color: "#fff", 
            fontWeight: "600",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 4px 15px rgba(37, 99, 235, 0.3)",
            animation: "fadeIn 0.3s ease-out"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ 
                background: "rgba(255,255,255,0.2)", 
                padding: "6px", 
                borderRadius: "50%", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center" 
              }}>
                ✅
              </div>
              <span>{selectedVillageName}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                onVillageChange(null);
                setSearchInput("");
                setShowSearchResults(false);
              }}
              style={{
                padding: "8px 16px",
                background: "rgba(255,255,255,0.15)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "13px",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                backdropFilter: "blur(4px)"
              }}
              onMouseEnter={(e) => {
                e.target.style.background = "rgba(255,255,255,0.25)";
                e.target.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.target.style.background = "rgba(255,255,255,0.15)";
                e.target.style.transform = "translateY(0)";
              }}
            >
              Change Selection
            </button>
          </div>
        )}
        
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", 
          gap: "24px" 
        }}>
          {/* Search Village Section */}
          <div style={{ position: "relative" }}>
            <label style={{ 
              fontSize: "0.875rem", 
              fontWeight: "600", 
              color: "#475569", 
              marginBottom: "8px",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}>
              <span style={{ color: "#3b82f6" }}>🔍</span> Search Existing Village
            </label>
            <div style={{ position: "relative" }}>
              <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
                <span style={{ position: "absolute", left: 16, color: "#94a3b8", fontSize: "1.1rem" }}>🔍</span>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Type village name..."
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    setShowSearchResults(true);
                  }}

                  onKeyDown={handleKeyDown}
                  style={{
                    width: "100%",
                    padding: "14px 16px 14px 44px",
                    fontSize: "0.95rem",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    boxSizing: "border-box",
                    backgroundColor: "#f8fafc",
                    transition: "all 0.3s ease",
                    outline: "none",
                    minHeight: "48px",
                    color: "#1e293b"
                  }}
                  onMouseEnter={(e) => {
                    if (!searchInput) e.target.style.backgroundColor = "#fff";
                  }}
                  onMouseLeave={(e) => {
                    if (!searchInput) e.target.style.backgroundColor = "#f8fafc";
                  }}
                  onFocus={(e) => {
                    if (searchInput) setShowSearchResults(true);
                    e.target.style.borderColor = "#3b82f6";
                    e.target.style.boxShadow = "0 0 0 4px rgba(59, 130, 246, 0.1)";
                    e.target.style.backgroundColor = "#fff";
                  }}
                  onBlur={(e) => {
                    if (!searchInput) {
                      e.target.style.borderColor = "#cbd5e1";
                      e.target.style.boxShadow = "none";
                      e.target.style.backgroundColor = "#f8fafc";
                    }
                  }}
                />
                {searchInput && (
                  <button
                    onClick={() => {
                      setSearchInput("");
                      setShowSearchResults(false);
                    }}
                    style={{
                      position: "absolute",
                      right: 12,
                      background: "#f1f5f9",
                      border: "none",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      color: "#64748b",
                      borderRadius: "50%",
                      width: "24px",
                      height: "24px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.2s"
                    }}
                    onMouseOver={(e) => {
                      e.target.style.background = "#e2e8f0";
                      e.target.style.color = "#0f172a";
                    }}
                    onMouseOut={(e) => {
                      e.target.style.background = "#f1f5f9";
                      e.target.style.color = "#64748b";
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
              
              {/* Search Results Dropdown */}
              {showSearchResults && searchInput.trim() && (
                <div
                  ref={dropdownRef}
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    left: 0,
                    right: 0,
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    backgroundColor: "#fff",
                    maxHeight: "280px",
                    overflowY: "auto",
                    zIndex: 20,
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                    animation: "slideDown 0.2s ease-out"
                  }}
                >
                  {filteredVillages.length === 0 ? (
                    <div style={{ padding: "16px", color: "#b45309", textAlign: "center", fontSize: "0.95rem", background: "#fefce8", borderBottom: "1px solid #fef08a" }}>
                      <div style={{ fontSize: "1.8rem", marginBottom: "8px" }}>🗺️</div>
                      No villages found matching "{searchInput}"
                    </div>
                  ) : (
                    <>
                      <div style={{ 
                        fontSize: "0.75rem", 
                        color: "#64748b", 
                        padding: "8px 16px", 
                        backgroundColor: "#f8fafc", 
                        fontWeight: "600", 
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        borderBottom: "1px solid #e2e8f0", 
                        position: "sticky", 
                        top: 0,
                        zIndex: 2
                      }}>
                        Matches ({filteredVillages.length})
                      </div>
                      {filteredVillages.map((village, index) => (
                        <div
                          key={village.id}
                          onClick={() => handleVillageSelect(village.id)}
                          style={{
                            padding: "12px 16px",
                            cursor: "pointer",
                            backgroundColor: 
                              highlightedIndex === index ? "#eff6ff" : 
                              selectedVillageId === village.id ? "#f8fafc" : 
                              "#fff",
                            borderBottom: "1px solid #f1f5f9",
                            fontWeight: highlightedIndex === index || selectedVillageId === village.id ? "600" : "400",
                            color: highlightedIndex === index ? "#1d4ed8" : "#334155",
                            transition: "all 0.2s",
                            minHeight: "48px",
                            display: "flex",
                            alignItems: "center",
                            fontSize: "0.95rem"
                          }}
                          onMouseEnter={(e) => {
                            setHighlightedIndex(index);
                            e.currentTarget.style.background = "#eff6ff";
                            e.currentTarget.style.color = "#1d4ed8";
                            e.currentTarget.style.paddingLeft = "20px";
                          }}
                          onMouseLeave={(e) => {
                            if (highlightedIndex === index) {
                              e.currentTarget.style.background = "#eff6ff";
                              e.currentTarget.style.color = "#1d4ed8";
                              e.currentTarget.style.paddingLeft = "16px";
                            } else {
                              e.currentTarget.style.background = selectedVillageId === village.id ? "#f8fafc" : "#fff";
                              e.currentTarget.style.color = "#334155";
                              e.currentTarget.style.paddingLeft = "16px";
                            }
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ opacity: 0.5 }}>📍</span>
                              {village.name}
                            </div>
                            {selectedVillageId === village.id && (
                              <span style={{ 
                                background: "#dcfce7", 
                                color: "#166534", 
                                padding: "2px 8px", 
                                borderRadius: "12px",
                                fontSize: "0.75rem",
                                fontWeight: "700" 
                              }}>
                                Selected
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "8px", paddingLeft: "4px", display: "none" }}>
              💡 Type to search • ↓↑ to navigate • Enter to select • Esc to close
            </div>
          </div>

          {/* Add New Village Section */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <label style={{ 
              fontSize: "0.875rem", 
              fontWeight: "600", 
              color: "#475569", 
              marginBottom: "8px",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}>
              <span style={{ color: "#10b981" }}>➕</span> Add New Village
            </label>
            <div style={{ display: "flex", gap: "10px", alignItems: "stretch" }}>
              <div style={{ position: "relative", flex: 1 }}>
                <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: "1.1rem" }}>🏡</span>
                <input
                  type="text"
                  placeholder="Enter village name"
                  value={addNewInput}
                  onChange={(e) => setAddNewInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && addNewInput.trim()) {
                      handleCreateNewVillage();
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "14px 16px 14px 44px",
                    fontSize: "0.95rem",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    boxSizing: "border-box",
                    backgroundColor: "#f8fafc",
                    transition: "all 0.3s ease",
                    outline: "none",
                    minHeight: "48px",
                    color: "#1e293b",
                    height: "100%"
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#10b981";
                    e.target.style.boxShadow = "0 0 0 4px rgba(16, 185, 129, 0.1)";
                    e.target.style.backgroundColor = "#fff";
                  }}
                  onBlur={(e) => {
                    if (!addNewInput) {
                      e.target.style.borderColor = "#cbd5e1";
                      e.target.style.boxShadow = "none";
                      e.target.style.backgroundColor = "#f8fafc";
                    }
                  }}
                  onMouseEnter={(e) => {
                    if (!addNewInput) e.target.style.backgroundColor = "#fff";
                  }}
                  onMouseLeave={(e) => {
                    if (!addNewInput) e.target.style.backgroundColor = "#f8fafc";
                  }}
                />
              </div>
              <button
                type="button"
                onClick={handleCreateNewVillage}
                disabled={!addNewInput.trim()}
                style={{
                  padding: "0 24px",
                  background: addNewInput.trim() ? "linear-gradient(135deg, #10b981 0%, #059669 100%)" : "#e2e8f0",
                  color: addNewInput.trim() ? "#fff" : "#94a3b8",
                  border: "none",
                  borderRadius: "10px",
                  cursor: addNewInput.trim() ? "pointer" : "not-allowed",
                  fontWeight: "700",
                  fontSize: "0.95rem",
                  transition: "all 0.3s ease",
                  boxShadow: addNewInput.trim() ? "0 4px 12px rgba(16, 185, 129, 0.3)" : "none",
                  whiteSpace: "nowrap"
                }}
                onMouseEnter={(e) => {
                  if (addNewInput.trim()) {
                    e.target.style.transform = "translateY(-2px)";
                    e.target.style.boxShadow = "0 6px 15px rgba(16, 185, 129, 0.4)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (addNewInput.trim()) {
                    e.target.style.transform = "translateY(0)";
                    e.target.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.3)";
                  }
                }}
              >
                Add Village
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VillageSelector;
