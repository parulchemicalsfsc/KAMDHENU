import React from "react";

/**
 * SummaryCard Component
 * Individual card displaying a stock metric with animation
 */
const SummaryCard = ({ title, value, backgroundColor, borderColor, textColor, subtitle }) => {
  return (
    <div
      style={{
        padding: "clamp(16px, 4vw, 20px)",
        backgroundColor,
        borderRadius: "12px",
        border: `3px solid ${borderColor}`,
        transition: "all 0.3s ease",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
        minHeight: "140px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow = `0 8px 16px ${borderColor}40`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Animated background accent */}
      <div
        style={{
          position: "absolute",
          top: "-50%",
          right: "-10%",
          width: "120%",
          height: "120%",
          backgroundColor: borderColor,
          opacity: "0.05",
          borderRadius: "50%",
          animation: "float 6s ease-in-out infinite",
        }}
      />
      
      <div style={{ position: "relative", zIndex: 1 }}>
        <h3 style={{ 
          margin: "0 0 10px 0", 
          color: textColor,
          fontSize: "clamp(14px, 3.5vw, 16px)",
          fontWeight: "600",
        }}>
          {title}
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: "clamp(24px, 6vw, 32px)",
            fontWeight: "bold",
            color: textColor,
            lineHeight: "1.2",
          }}
        >
          {value}
        </p>
      </div>
      
      <p style={{ 
        margin: "8px 0 0 0", 
        fontSize: "clamp(11px, 2.5vw, 12px)", 
        color: "#666",
        position: "relative",
        zIndex: 1,
      }}>
        {subtitle}
      </p>
    </div>
  );
};

/**
 * SummaryCards Component
 * Dashboard summary showing key stock metrics with animations
 */
export const SummaryCards = ({ totalTaken, totalSold, totalDairy, totalRemaining, isLoading }) => {
  return (
    <>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(5deg); }
        }
        @keyframes fadeInScale {
          from { opacity: 0; transform: translateY(15px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .summary-card-container > div {
          animation: fadeInScale 0.6s cubic-bezier(0.16, 1, 0.3, 1) backwards;
        }
      `}</style>
      
      <div
        className="summary-card-container"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(clamp(240px, 100%, 280px), 1fr))",
          gap: "clamp(16px, 3vw, 24px)",
          marginBottom: "30px",
        }}
      >
        <SummaryCard
          title="📦 Stock Taken to Demo"
          value={totalTaken.toFixed(2)}
          backgroundColor="linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)"
          borderColor="#38bdf8"
          textColor="#0284c7"
          subtitle="Total units out"
        />

        <SummaryCard
          title="💰 Stock Sold"
          value={totalSold.toFixed(2)}
          backgroundColor="linear-gradient(135deg, #f5d0fe 0%, #e879f9 100%)"
          borderColor="#d946ef"
          textColor="#a21caf"
          subtitle="Total units sold"
        />

        <SummaryCard
          title="🏪 Stock at Dairy"
          value={totalDairy.toFixed(2)}
          backgroundColor="linear-gradient(135deg, #fef08a 0%, #fde047 100%)"
          borderColor="#eab308"
          textColor="#ca8a04"
          subtitle="Left at dairy"
        />

        <SummaryCard
          title="✅ Stock Remaining"
          value={totalRemaining.toFixed(2)}
          backgroundColor={totalRemaining >= 0 ? "linear-gradient(135deg, #dcfce7 0%, #86efac 100%)" : "linear-gradient(135deg, #fee2e2 0%, #fca5a5 100%)"}
          borderColor={totalRemaining >= 0 ? "#22c55e" : "#ef4444"}
          textColor={totalRemaining >= 0 ? "#166534" : "#991b1b"}
          subtitle={totalRemaining < 0 ? "⚠️ Oversold!" : "Actual units left"}
        />
      </div>
    </>
  );
};

export default SummaryCards;
