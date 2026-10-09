import { Routes, Route } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { EscrowListPage } from './pages/EscrowListPage';
import { EscrowDetailPage } from './pages/EscrowDetailPage';

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/escrows" element={<EscrowListPage />} />
        <Route path="/escrows/:id" element={<EscrowDetailPage />} />
      </Routes>
    </AppShell>
  );
}
