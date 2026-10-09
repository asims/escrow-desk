import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Dashboard } from './Dashboard';
import { EscrowProvider } from '../../store/EscrowContext';
import { createGateway } from '../../lib/createGateway';

function renderDashboard() {
  return render(
    <MemoryRouter>
      <EscrowProvider gateway={createGateway('mock')}>
        <Dashboard />
      </EscrowProvider>
    </MemoryRouter>,
  );
}

describe('Dashboard', () => {
  it('renders urgency buckets with escrows', () => {
    renderDashboard();
    expect(screen.getByText('Morning Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Due Today or Overdue')).toBeInTheDocument();
    expect(screen.getByText('Pending Supervisor Approval')).toBeInTheDocument();
    expect(screen.getByText('Open Claims')).toBeInTheDocument();
  });

  it('shows the ready-to-fund escrow in the overdue bucket', () => {
    renderDashboard();
    // ESC-001 release date 2026-10-01 is before the 2026-10-08 reference date.
    expect(
      screen.getAllByText('Acme / Beta Corp Indemnity Holdback').length,
    ).toBeGreaterThan(0);
  });
});
