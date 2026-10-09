import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEffect } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EscrowProvider, useEscrow } from '../../store/EscrowContext';
import { createGateway } from '../../lib/createGateway';
import { EscrowDetail } from './EscrowDetail';
import type { Role } from '../../types';

// The holiday API is not available in jsdom; mock it to fail open deterministically.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('offline'))),
  );
});

function Harness({ id, role }: { id: string; role: Role }) {
  const { store, dispatch } = useEscrow();
  const escrow = store.escrows.find((e) => e.id === id)!;
  useEffect(() => {
    dispatch({ type: 'SET_ROLE', role });
  }, [dispatch, role]);
  return <EscrowDetail escrow={escrow} />;
}

function renderDetail(id: string, role: Role = 'officer') {
  return render(
    <MemoryRouter>
      <EscrowProvider gateway={createGateway('mock')}>
        <Harness id={id} role={role} />
      </EscrowProvider>
    </MemoryRouter>,
  );
}

describe('EscrowDetail release tab', () => {
  it('ESC-001 shows an enabled Prepare Release button for the officer', async () => {
    renderDetail('ESC-001', 'officer');
    fireEvent.click(screen.getByRole('button', { name: 'Release' }));
    const prepare = await screen.findByRole('button', {
      name: 'Prepare Release',
    });
    await waitFor(() => expect(prepare).toBeEnabled());
  });

  it('ESC-003 fully blocked claim disables Prepare Release', async () => {
    renderDetail('ESC-003', 'officer');
    fireEvent.click(screen.getByRole('button', { name: 'Release' }));
    const prepare = await screen.findByRole('button', {
      name: 'Prepare Release',
    });
    expect(prepare).toBeDisabled();
  });

  it('ESC-007 shows pending approval and an Approve button for the supervisor', async () => {
    renderDetail('ESC-007', 'supervisor');
    fireEvent.click(screen.getByRole('button', { name: 'Release' }));
    expect(
      await screen.findByText('Pending supervisor approval'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Approve Release' }),
    ).toBeInTheDocument();
  });

  it('ESC-008 wire-pending shows the lock notice and a Confirm button for the supervisor', async () => {
    renderDetail('ESC-008', 'supervisor');
    fireEvent.click(screen.getByRole('button', { name: 'Release' }));
    expect(
      await screen.findByText(/second release cannot be initiated/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Confirm Wire Received' }),
    ).toBeInTheDocument();
  });

  it('ESC-003 Claims tab shows the fully-blocked alert', async () => {
    renderDetail('ESC-003', 'officer');
    fireEvent.click(screen.getByRole('button', { name: /Claims/ }));
    expect(await screen.findByText(/full balance reserved/i)).toBeInTheDocument();
  });
});
