import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/AuthContext';
import { Toaster } from 'sonner';
import './index.css';

// Layout & Pages
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AppsPage from './pages/AppsPage';
import CreateAppPage from './pages/CreateAppPage';
import AppDetailPage from './pages/AppDetailPage';
import DatabasesPage from './pages/DatabasesPage';
import CronPage from './pages/CronPage';
import SettingsPage from './pages/SettingsPage';
import GitHubCallbackPage from './pages/GitHubCallbackPage';
import DomainsPage from './pages/DomainsPage';
import EmailPage from './pages/EmailPage';

// App entry point config
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Toaster richColors closeButton position="top-right" />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/apps" element={<AppsPage />} />
            <Route path="/apps/create" element={<CreateAppPage />} />
            <Route path="/apps/:id" element={<AppDetailPage />} />
            <Route path="/databases" element={<DatabasesPage />} />
            <Route path="/domains" element={<DomainsPage />} />
            <Route path="/email" element={<EmailPage />} />
            <Route path="/cron-jobs" element={<CronPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/github/callback" element={<GitHubCallbackPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
