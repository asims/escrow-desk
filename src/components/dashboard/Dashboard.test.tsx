import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
  it('renders urgency buckets by default', () => {
    renderDashboard();
    expect(screen.getByText('Morning Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Due Today or Overdue')).toBeInTheDocument();
  });

  it('does not show the removed open-claim / pending-approval sections', () => {
    renderDashboard();
    // These section headings were removed; their condition is now a filter
    // toggle. (The 'Open Claims' *filter button* still exists, so match the
    // old section description text instead.)
    expect(
      screen.queryByText('Funds reserved against open or disputed claims'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Pending Supervisor Approval'),
    ).not.toBeInTheDocument();
  });

  it('shows the ready-to-fund escrow in the overdue bucket', () => {
    renderDashboard();
    // ESC-001 release date 2026-10-01 is before the 2026-10-08 reference date.
    expect(
      screen.getAllByText('Acme / Beta Corp Indemnity Holdback').length,
    ).toBeGreaterThan(0);
  });

  it('collapses to a flat table when a non-All filter is active', () => {
    renderDashboard();
    // Clicking the Open Claims filter toggle removes urgency grouping.
    fireEvent.click(screen.getByRole('button', { name: 'Open Claims' }));
    expect(screen.queryByText('Due Today or Overdue')).not.toBeInTheDocument();
    expect(screen.queryByText('Due Within 7 Days')).not.toBeInTheDocument();
  });
});
