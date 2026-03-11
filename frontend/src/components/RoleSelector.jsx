import React from 'react';
import { toast } from 'react-toastify';

const RoleSelector = ({ onRoleSelect }) => {
  const roles = [
    {
      id: 'patient',
      title: 'Data Principal (Patient)',
      description: 'Manage your health data consents and records',
      icon: '👤',
      color: '#2563EB'
    },
    {
      id: 'hospital',
      title: 'Data Fiduciary (Hospital)',
      description: 'Request consent and manage patient data',
      icon: '🏥',
      color: '#0EA5E9'
    },
    {
      id: 'lab',
      title: 'Data Processor (Lab)',
      description: 'Upload lab results and access authorized data',
      icon: '🔬',
      color: '#22C55E'
    },
    {
      id: 'regulator',
      title: 'Regulator (DPB)',
      description: 'Monitor compliance and audit logs',
      icon: '🛡️',
      color: '#F59E0B'
    }
  ];

  const handleRoleSelect = (roleId) => {
    onRoleSelect(roleId);
    toast.success(`Selected ${roleId} role`);
  };

  return (
    <div className="role-selector">
      <div className="role-selector-header">
        <h2>Select Your Role</h2>
        <p>Choose your role to access the appropriate dashboard</p>
      </div>
      
      <div className="role-grid">
        {roles.map((role) => (
          <div
            key={role.id}
            className="role-card"
            onClick={() => handleRoleSelect(role.id)}
            style={{ borderColor: role.color }}
          >
            <div className="role-icon" style={{ backgroundColor: role.color + '20', color: role.color }}>
              {role.icon}
            </div>
            <h3>{role.title}</h3>
            <p>{role.description}</p>
            <button 
              className="role-select-btn"
              style={{ backgroundColor: role.color }}
            >
              Select
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RoleSelector;
