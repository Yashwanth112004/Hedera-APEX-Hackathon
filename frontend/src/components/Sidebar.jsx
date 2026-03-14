import React from 'react';

const Sidebar = ({ role, activeTab, onTabChange }) => {
  const patientMenu = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'audit', label: 'Audit Logs', icon: '🔍' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  const hospitalMenu = [
    { id: 'dashboard', label: 'Dashboard', icon: '🏥' },
    { id: 'audit', label: 'Access Logs', icon: '🔍' },
  ];

  const doctorMenu = [
    { id: 'dashboard', label: 'Physician Portal', icon: '🩺' },
    { id: 'audit', label: 'Verified Logs', icon: '🔍' },
  ];

  const pharmacyMenu = [
    { id: 'dashboard', label: 'Pharmacy Desk', icon: '💊' },
    { id: 'audit', label: 'Dispense Logs', icon: '🔍' },
  ];

  const insuranceMenu = [
    { id: 'dashboard', label: 'Claims Desk', icon: '🏢' },
    { id: 'audit', label: 'Payout Logs', icon: '🔍' },
  ];

  const labMenu = [
    { id: 'dashboard', label: 'Lab Reports', icon: '🧪' },
    { id: 'audit', label: 'Query Logs', icon: '🔍' },
  ];

  const adminMenu = [
    { id: 'dashboard', label: 'Management', icon: '🛡️' },
    { id: 'audit', label: 'System Logs', icon: '🔍' },
  ];

  const getMenuItems = () => {
    switch (role?.toLowerCase()) {
      case 'patient': return patientMenu;
      case 'hospital': return hospitalMenu;
      case 'doctor': return doctorMenu;
      case 'pharmacy': return pharmacyMenu;
      case 'insurance': return insuranceMenu;
      case 'lab': return labMenu;
      case 'admin': return adminMenu;
      default: return patientMenu;
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h3>{role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Select'} Portal</h3>
      </div>

      <div className="sidebar-menu">
        {getMenuItems().map((item) => (
          <button
            key={item.id}
            className={`sidebar-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => onTabChange(item.id)}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span className="sidebar-label">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Sidebar;
