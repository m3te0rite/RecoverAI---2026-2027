import { useState } from 'react';
import Login from './components/Login/Login.jsx';
import DoctorPortal from './components/DoctorPortal/DoctorPortal.jsx';
import PatientPortal from './components/PatientPortal/PatientPortal.jsx';
import TestModelIntegration from './components/TestModelIntegration';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);

  const handleLogin = (user) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  return (
    <>
      {/* Main UI */}
      {!currentUser && <Login onLogin={handleLogin} />}
      {currentUser && currentUser.role === 'doctor' && (
        <DoctorPortal user={currentUser} onLogout={handleLogout} />
      )}
      {currentUser && currentUser.role === 'patient' && (
        <PatientPortal user={currentUser} onLogout={handleLogout} />
      )}
      {/* Test component – always rendered */}
      <TestModelIntegration />
    </>
  );
}

