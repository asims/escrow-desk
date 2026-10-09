import { Link, useParams } from 'react-router-dom';
import { useEscrow } from '../store/EscrowContext';
import { EscrowDetail } from '../components/escrows/EscrowDetail';

export function EscrowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { store } = useEscrow();
  const escrow = store.escrows.find((e) => e.id === id);

  if (!escrow) {
    return (
      <div className="border border-gray-200 bg-white p-6 text-sm text-gray-600">
        <p className="mb-2 font-medium text-gray-900">Escrow not found</p>
        <p>
          No escrow with id <code>{id}</code>.{' '}
          <Link to="/escrows" className="text-blue-600 hover:underline">
            Back to all escrows
          </Link>
        </p>
      </div>
    );
  }

  return <EscrowDetail escrow={escrow} />;
}
