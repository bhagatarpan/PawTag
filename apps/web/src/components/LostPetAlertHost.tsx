import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronRight, Phone, Mail, ShieldAlert } from 'lucide-react';
import { ConfirmDialog, toast } from '@pawtag/ui';
import { formatDateTime } from '@pawtag/shared';
import { API } from '@pawtag/shared/api';
import api from '../lib/api';

export interface ActiveAlertRow {
  id: string;
  type: 'finder_scan' | 'pet_found';
  petId: string | null;
  petName: string | null;
  area: string | null;
  title: string;
  message: string;
  actionUrl: string | null;
  createdAt: string;
  /** Present only on Level-2 (finder submitted contact) alerts. */
  finderName?: string | null;
  finderPhone?: string | null;
  finderEmail?: string | null;
}

export interface ActiveAlertState {
  alerts: ActiveAlertRow[];
  lostPets: Array<{ id: string; name: string }>;
}

const PRIMARY_BTN =
  'inline-flex min-h-11 items-center justify-center px-4 rounded-lg text-sm font-semibold transition-colors';
const SECONDARY_BTN =
  'inline-flex min-h-11 items-center justify-center px-4 rounded-lg border text-sm font-semibold bg-white transition-colors';

/**
 * App-wide lost-pet surfaces (scan→reunification flow), rendered at the top
 * of every account screen from AccountLayout:
 *
 * 1. Persistent "PET IS LOST" status banner while any pet is in Lost Mode
 *    (server-derived → survives refresh, navigation, and other devices).
 * 2. The strongest unacknowledged alert — Level-2 finder contact outranks the
 *    Level-1 bare-scan "is your pet safe?" prompt — with the three founder
 *    actions. Nothing here ever changes pet status without explicit
 *    confirmation (ConfirmPetIsLost opens a dialog; "safe" only acks).
 */
export function LostPetAlertHost({
  state,
  onChanged,
}: {
  state: ActiveAlertState | null;
  onChanged: () => void;
}) {
  const navigate = useNavigate();
  const [confirmLost, setConfirmLost] = useState<ActiveAlertRow | null>(null);
  const [busy, setBusy] = useState(false);

  if (!state || (state.lostPets.length === 0 && state.alerts.length === 0)) return null;

  const { alerts, lostPets } = state;
  const strongest = alerts[0];

  const confirmPetLost = async () => {
    if (!confirmLost?.petId) return;
    setBusy(true);
    try {
      // Existing owner-scoped endpoint — status change stays server-authoritative.
      await api.post(API.customer.pets.markLost(confirmLost.petId));
      toast.success('Lost Mode activated');
      setConfirmLost(null);
      onChanged();
      navigate(`/account/pets/${confirmLost.petId}/lost`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Could not start Lost Mode. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const markSafe = async (alert: ActiveAlertRow) => {
    try {
      await api.put(API.customer.notifications.ack(alert.id));
      toast.info('Alert dismissed — no changes were made to your pet.');
      onChanged();
    } catch {
      toast.error('Could not dismiss the alert. Please try again.');
    }
  };

  // Viewing details is a plain navigation (a Link in the card) — never a
  // decision, never an API write; only ack / confirm-lost resolve a prompt.

  const contactParts = [
    strongest?.finderName,
    strongest?.finderPhone,
    strongest?.finderEmail,
  ].filter(Boolean) as string[];

  const lostLink =
    lostPets.length === 1 ? `/account/pets/${lostPets[0].id}/lost` : '/account/pets';

  return (
    <div className="space-y-3 pb-4">
      {/* Persistent status banner — reflects persisted pet.status after any refresh */}
      {lostPets.length > 0 && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-red-600 px-4 py-3 text-white"
        >
          <span className="flex items-center gap-2 text-sm font-bold">
            <ShieldAlert size={18} aria-hidden="true" />
            {lostPets.length === 1
              ? `PET IS LOST — ${lostPets[0].name}`
              : `PET IS LOST — ${lostPets.length} pets`}
          </span>
          <Link
            to={lostLink}
            className="inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-white underline-offset-2 hover:underline"
          >
            Review scan activity <ChevronRight size={14} aria-hidden="true" />
          </Link>
        </div>
      )}

      {/* Strongest unacknowledged alert */}
      {strongest && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 animate-fade-in"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-red-600" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-red-900">{strongest.title}</p>
              <p className="mt-1 text-sm text-red-800">{strongest.message}</p>
              <p className="mt-1.5 text-xs text-red-700/80">
                Received {formatDateTime(strongest.createdAt)}
              </p>
              {/* Finder contact (Level-2 only) — name/phone/email exactly as submitted */}
              {contactParts.length > 0 && (
                <p className="mt-2 text-xs text-red-800">
                  <span className="font-semibold">Finder:</span> {contactParts.join(' · ')}
                </p>
              )}
              {alerts.length > 1 && (
                <button
                  type="button"
                  onClick={() => navigate('/account/notifications')}
                  className="mt-2 text-xs font-medium text-red-700 underline-offset-2 hover:underline"
                >
                  {alerts.length - 1} more alert{alerts.length > 2 ? 's' : ''} in Notifications
                </button>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {/* Decision first (dominant), contact actions alongside as secondary */}
                <button
                  type="button"
                  onClick={() => setConfirmLost(strongest)}
                  disabled={!strongest.petId}
                  className={`${PRIMARY_BTN} bg-red-600 text-white hover:bg-red-700 disabled:opacity-50`}
                >
                  Confirm Pet Is Lost
                </button>
                <button
                  type="button"
                  onClick={() => markSafe(strongest)}
                  className={`${SECONDARY_BTN} border-red-300 text-red-700 hover:bg-red-100`}
                >
                  My Pet Is Safe
                </button>
                {strongest.finderPhone && (
                  <a
                    href={`tel:${strongest.finderPhone}`}
                    className={`${SECONDARY_BTN} border-red-300 text-red-700 hover:bg-red-100`}
                  >
                    <Phone size={14} className="mr-1.5" aria-hidden="true" />
                    Call{strongest.finderName ? ` ${strongest.finderName}` : ' finder'}
                  </a>
                )}
                {strongest.finderEmail && (
                  <a
                    href={`mailto:${strongest.finderEmail}`}
                    className={`${SECONDARY_BTN} border-red-300 text-red-700 hover:bg-red-100`}
                  >
                    <Mail size={14} className="mr-1.5" aria-hidden="true" />
                    Email finder
                  </a>
                )}
                {/* Viewing is NOT a decision — a plain link, no API write */}
                <Link
                  to={`/account/pets/${strongest.petId}#pet-history`}
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-red-700 underline underline-offset-2 hover:text-red-900"
                >
                  View Scan Details
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmLost}
        onClose={() => setConfirmLost(null)}
        onConfirm={confirmPetLost}
        loading={busy}
        variant="danger"
        title="Are you sure your pet is lost?"
        message="Activating Lost Mode helps you manage scan alerts, review possible sightings, and coordinate with people who may have found your pet."
        confirmLabel="Yes, Activate Lost Mode"
        cancelLabel="Cancel"
      />
    </div>
  );
}

export default LostPetAlertHost;
