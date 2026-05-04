import React from 'react';

// A mapping to get the color class for the pill based on status
const getStatusClass = (status) => {
  switch (status.toUpperCase()) {
    case 'COMPLETED': return 'status-completed';
    case 'IN REVIEW': return 'status-in-review';
    case 'PENDING': return 'status-pending';
    default: return 'status-default';
  }
};

export default function HistoryTable({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="history-empty-state">
        <div className="empty-icon">📋</div>
        <h3>No Reports Found</h3>
        <p>Try adjusting your search or filter criteria.</p>
      </div>
    );
  }

  return (
    <div className="history-table-wrapper">
      <table className="history-table-component">
        <thead>
          <tr>
            <th>Date & Time</th>
            <th>Officer</th>
            <th>Activity</th>
            <th>Punch In / Out</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.id} className="history-table-row">
              <td className="col-datetime">
                <div className="bold-text">{row.reportId}</div>
                <div className="sub-text">{row.date} • {row.time}</div>
              </td>
              <td className="col-officer">
                <div className="officer-profile">
                  <div className="officer-avatar">{row.initials}</div>
                  <div className="officer-name">{row.officerName}</div>
                </div>
              </td>
              <td className="col-activity">
                {row.workingType}
              </td>
              <td className="col-punch">
                {row.punchIn} — {row.punchOut}
              </td>
              <td className="col-status">
                <span className={`status-pill ${getStatusClass(row.status)}`}>
                  {row.status}
                </span>
              </td>
              <td className="col-actions">
                <button className="action-btn" title="View details">👁</button>
                <button className="action-btn" title="Edit">✏️</button>
                <button className="download-btn">📥 PDF</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
