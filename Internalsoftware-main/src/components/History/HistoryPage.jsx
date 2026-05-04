import React, { useState } from 'react';
import Navbar from '../../Navbar';
import FilterBar from './FilterBar';
import HistoryTable from './HistoryTable';
import './History.css';

const MOCK_DATA = [
  { id: 'rf-90231', reportId: '#RF-90231', date: '2023-10-24', time: '14:30', officerName: 'Jonathan Doe', initials: 'JD', workingType: 'North Sector Surveillance', punchIn: '14:30', punchOut: '17:00', status: 'COMPLETED' },
  { id: 'rf-90235', reportId: '#RF-90235', date: '2023-10-24', time: '12:15', officerName: 'Sarah Mitchell', initials: 'SM', workingType: 'Central Logistics Unit', punchIn: '12:15', punchOut: '--', status: 'IN REVIEW' },
  { id: 'rf-90238', reportId: '#RF-90238', date: '2023-10-23', time: '09:00', officerName: 'Robert Lane', initials: 'RL', workingType: 'East Boundary Patrol', punchIn: '09:00', punchOut: '--', status: 'PENDING' },
  { id: 'rf-90239', reportId: '#RF-90239', date: '2023-10-23', time: '10:00', officerName: 'Alice Green', initials: 'AG', workingType: 'West Zone Survey', punchIn: '10:00', punchOut: '14:30', status: 'COMPLETED' },
  { id: 'rf-90240', reportId: '#RF-90240', date: '2023-10-22', time: '08:30', officerName: 'David Wong', initials: 'DW', workingType: 'HQ Maintenance', punchIn: '08:30', punchOut: '11:00', status: 'COMPLETED' },
];

export default function HistoryPage() {
  const [data, setData] = useState(MOCK_DATA);
  const [officerFilter, setOfficerFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Extract unique officers for the dropdown
  const officers = Array.from(new Set(MOCK_DATA.map(d => d.officerName)));

  const handleFilter = () => {
    // Basic frontend filtering logic
    let filtered = MOCK_DATA;
    
    if (officerFilter && officerFilter !== 'All') {
      filtered = filtered.filter(d => d.officerName === officerFilter);
    }
    
    if (dateFrom) {
      filtered = filtered.filter(d => d.date >= dateFrom);
    }
    
    if (dateTo) {
      filtered = filtered.filter(d => d.date <= dateTo);
    }
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(d => 
        d.officerName.toLowerCase().includes(q) || 
        d.reportId.toLowerCase().includes(q) ||
        d.workingType.toLowerCase().includes(q)
      );
    }
    
    setData(filtered);
  };

  // Run filter logic whenever a filter state changes
  React.useEffect(() => {
    handleFilter();
  }, [officerFilter, dateFrom, dateTo, searchQuery]);

  return (
    <div className="history-page-root">
      <Navbar />
      <div className="history-page-container">
        <div className="history-header">
          <h1 className="history-title">History</h1>
        </div>
        
        <div className="history-content-wrapper">
          <FilterBar 
            officers={officers}
            officerFilter={officerFilter}
            setOfficerFilter={setOfficerFilter}
            dateFrom={dateFrom}
            setDateFrom={setDateFrom}
            dateTo={dateTo}
            setDateTo={setDateTo}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
          
          <div className="history-table-section">
            <div className="table-header-row">
              <h2 className="table-title">Recent Reports</h2>
            </div>
            <HistoryTable data={data} />
          </div>
        </div>
      </div>
    </div>
  );
}
