import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import PlansPage from '@/pages/Admin/PlansPage';
import ApproveRegistrationsPage from '@/pages/Admin/ApproveRegistrationsPage';
import ApproveRequestedPlanPage from '@/pages/Admin/ApproveRequestedPlanPage';
import RegistrationForm from '@/pages/RegistrationForm';
import Plans from '@/pages/User/Plans';
import LoginPage from '@/pages/LoginPage';
import ProtectedRoute from '@/router/ProtectedRoute';
import AuthGuard from './router/AuthGuard';

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/register" element={<RegistrationForm />} />
          <Route path="/" element={<Navigate to="/register" />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Protected routes */}
          <Route path="/admin-plans" element={
            <AuthGuard>
              <ProtectedRoute component={PlansPage} permission="view_plans" />
            </AuthGuard>
          } />
          <Route path="/approve-registrations" element={
            <AuthGuard>
              <ProtectedRoute component={ApproveRegistrationsPage} permission="approve_registrations" />
            </AuthGuard>
          } />
          <Route path="/approve-requested-plan" element={
            <AuthGuard>
              <ProtectedRoute component={ApproveRequestedPlanPage} permission="approve_requested_plan" />
            </AuthGuard>
          } />
          <Route path="/user-plans" element={
            <AuthGuard>
              <ProtectedRoute component={Plans} permission="view_plans" />
            </AuthGuard>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;