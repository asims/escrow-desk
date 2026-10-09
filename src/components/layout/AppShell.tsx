import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useEscrow } from '../../store/EscrowContext';
import { useBusinessDay } from '../../hooks/useBusinessDay';
import type { Role } from '../../types';
import { toIsoDate } from '../../lib/dates';

const TODAY = new Date();

function navClass({ isActive }: { isActive: boolean }): string {
  return [
    'px-3 py-2 text-sm font-medium border-b-2',
    isActive
      ? 'border-blue-600 text-blue-700'
      : 'border-transparent text-gray-600 hover:text-gray-900',
  ].join(' ');
}

export function AppShell({ children }: { children: ReactNode }) {
  const { store, dispatch } = useEscrow();
  const { result, loading } = useBusinessDay(TODAY);

  const showBanner =
    !loading && result && (!result.isBusinessDay || result.source === 'fallback');

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center bg-blue-600 text-xs font-bold text-white">
                ED
              </div>
              <span className="text-sm font-semibold">Escrow Desk</span>
            </div>
            <nav className="flex items-center gap-1">
              <NavLink to="/" end className={navClass}>
                Dashboard
              </NavLink>
              <NavLink to="/escrows" className={navClass}>
                All Escrows
              </NavLink>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-gray-500">Today</div>
              <div className="text-sm font-medium">{toIsoDate(TODAY)}</div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-xs text-gray-500">Role</span>
              <select
                value={store.currentRole}
                onChange={(e) =>
                  dispatch({ type: 'SET_ROLE', role: e.target.value as Role })
                }
                className="border border-gray-300 bg-white px-2 py-1 text-sm"
              >
                <option value="officer">Escrow Officer</option>
                <option value="supervisor">Supervisor</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => dispatch({ type: 'RESET' })}
              className="border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            >
              Reset Data
            </button>
          </div>
        </div>

        {showBanner && result && (
          <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
            <div className="mx-auto max-w-6xl">
              {!result.isBusinessDay ? (
                <>
                  <strong>
                    {result.holidayName === 'Weekend'
                      ? 'Today is a weekend.'
                      : `Today is a federal holiday (${result.holidayName}).`}
                  </strong>{' '}
                  Wires cannot settle — releases are blocked until the next
                  business day.
                </>
              ) : (
                <>
                  <strong>Holiday check unavailable.</strong> The Fed holiday API
                  could not be reached; assuming today is a valid business day
                  (fail-open). Verify before releasing.
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
