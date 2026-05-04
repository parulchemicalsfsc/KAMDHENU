import React from 'react';

export default function FilterBar({
  officers,
  officerFilter,
  setOfficerFilter,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  searchQuery,
  setSearchQuery
}) {
  return (
    <div className="history-filter-bar">
      <div className="filter-group">
        <label className="filter-label">OFFICER</label>
        <select 
          className="filter-input-select"
          value={officerFilter}
          onChange={(e) => setOfficerFilter(e.target.value)}
        >
          <option value="All">All</option>
          {officers.map(off => (
            <option key={off} value={off}>{off}</option>
          ))}
        </select>
      </div>
      
      <div className="filter-group">
        <label className="filter-label">DATE FROM</label>
        <div className="input-with-icon">
          <input 
            type="date"
            className="filter-input"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
      </div>
      
      <div className="filter-group">
        <label className="filter-label">DATE TO</label>
        <div className="input-with-icon">
          <input 
            type="date"
            className="filter-input"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      <div className="filter-group" style={{ flex: 1 }}>
        <label className="filter-label">SEARCH</label>
        <div className="input-with-icon">
           <input 
            type="text" 
            placeholder="Search by name, ID, or activity..."
            className="filter-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
