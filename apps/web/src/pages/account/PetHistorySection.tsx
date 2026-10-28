import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ScanLine, Eye, CheckCircle2, MessageSquare, MapPin, BellRing, ShieldAlert, PartyPopper,
} from 'lucide-react';
import { formatDateTime } from '@pawtag/shared';
import { API } from '@pawtag/shared/api';
import api from '../../lib/api';
import { mapsUrl } from '../../lib/maps';

/**
 * Owner-facing lost-and-found timeline (`PetHistoryEvent`). Approximate and
 * precise locations are labelled distinctly, and notification channels show
 * the real per-channel outcome recorded by the server (nothing is claimed as
 * "delivered" unless the server observed it).
 */
export const PET_HISTORY_LABELS: Record<string, string> = {
  scan_received: 'PawTag scanned',
  owner_prompted: 'You were asked: is your pet safe?',
  owner_prompt_dismissed: 'You confirmed your pet is safe',
  finder_notified: 'Finder contacted you',
  finder_location_shared: 'Finder shared precise location',
  finder_location_declined: 'Finder declined location sharing',
  notification_attempted: 'Owner alerts dispatched',
  sighting_alerted: 'Possible sighting alert sent',
  lost_activated: 'Lost Mode activated',
  reunion_confirmed: 'Pet reunited',
};

const TYPE_ICONS: Record<string, typeof ScanLine> = {
  scan_received: ScanLine,
  owner_prompted: Eye,
  owner_prompt_dismissed: CheckCircle2,
  finder_notified: MessageSquare,
  finder_location_shared: MapPin,
  finder_location_declined: MapPin,
  notification_attempted: BellRing,
  lost_activated: ShieldAlert,
  reunion_confirmed: PartyPopper,
};

const CHANNEL_WORDS: Record<string, string> = {
  sent: 'sent',
  created: 'created',
  failed: 'failed',
  skipped_not_entitled: 'not in plan',
  skipped_no_email: 'no email on file',
};

function formatChannels(channels: Record<string, string>): string {
  const order: Array<[string, string]> = [
    ['inApp', 'In-app'],
    ['push', 'Push'],
    ['email', 'Email'],
  ];
  return order
    .filter(([key]) => channels?.[key])
    .map(([key, label]) => `${label}: ${CHANNEL_WORDS[channels[key]] || channels[key]}`)
    .join(' · ');
}

function historyMeta(event: any): string | null {
  const meta = event.metadata || {};
  switch (event.type) {
    case 'scan_received':
      return meta.area ? `Around ${meta.area} — approximate area` : 'Location not available';
    case 'owner_prompted':
      return meta.area ? `Scanned around ${meta.area}` : null;
    case 'finder_notified': {
      const contact = [meta.finderName, meta.finderPhone, meta.finderEmail].filter(Boolean).join(' · ');
      return contact || null;
    }
    case 'finder_location_shared':
      return meta.accuracy ? `±${Math.round(meta.accuracy)}m accuracy` : 'Precise location';
    case 'finder_location_declined':
      return meta.consent ? `Consent: ${String(meta.consent)}` : null;
    case 'notification_attempted':
      return formatChannels(meta.channels || {});
    default:
      return null;
  }
}

interface PetHistorySectionProps {
  petId: string;
}

export function PetHistorySection({ petId }: PetHistorySectionProps) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.get(`${API.customer.pets.history(petId)}?limit=50`);
      setEvents(r.data.data || []);
    } catch {
      setError('Could not load history. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [petId]);

  useEffect(() => { load(); }, [load]);

  const loadMore = async () => {
    const oldest = events[events.length - 1];
    if (!oldest?.at || loadingMore) return;
    setLoadingMore(true);
    try {
      const r = await api.get(`${API.customer.pets.history(petId)}?limit=50&before=${encodeURIComponent(oldest.at)}`);
      const more = r.data.data || [];
      setEvents((prev) => [...prev, ...more]);
    } catch {
      // Keep what we have; the next explicit load-more retries.
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <section id="pet-history" className="bg-white rounded-2xl border border-gray-200 p-5" aria-label="Lost and found history">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-bold text-gray-900">History</h2>
        <Link to="/account/notifications" className="text-xs font-medium text-primary-600 hover:text-primary-800">
          All notifications
        </Link>
      </div>
      <p className="text-xs text-gray-500 mb-4">Scans, finder contact, alerts, Lost Mode and reunions — newest first.</p>

      {loading ? (
        <div className="space-y-3 animate-pulse" aria-busy="true">
          <div className="h-10 bg-gray-100 rounded-lg" />
          <div className="h-10 bg-gray-100 rounded-lg" />
          <div className="h-10 bg-gray-100 rounded-lg" />
        </div>
      ) : error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}{' '}
          <button type="button" onClick={load} className="font-medium underline underline-offset-2">Try again</button>
        </p>
      ) : events.length === 0 ? (
        <p className="text-sm text-gray-500 py-4">No activity recorded yet. Scans and recovery updates will appear here.</p>
      ) : (
        <>
          <ol className="relative border-l border-gray-200 ml-2">
            {events.map((event) => {
              const Icon = TYPE_ICONS[event.type] || ScanLine;
              const meta = historyMeta(event);
              return (
                <li key={event._id} className="ml-4 pb-4 last:pb-0">
                  <span className="absolute -left-[9px] mt-1 w-4 h-4 rounded-full bg-white border-2 border-primary-500 flex items-center justify-center">
                    <Icon size={9} className="text-primary-600" aria-hidden="true" />
                  </span>
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <p className="text-sm font-medium text-gray-900">
                      {PET_HISTORY_LABELS[event.type] || 'Activity'}
                    </p>
                    <time className="text-xs text-gray-400" dateTime={event.at}>
                      {formatDateTime(event.at)}
                    </time>
                  </div>
                  {meta && <p className="text-xs text-gray-500 mt-0.5">{meta}</p>}
                  {event.precision === 'precise' && (
                    <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wide text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
                      Precise location
                    </span>
                  )}
                  {event.precision === 'approximate' && (
                    <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-600 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5">
                      Approximate area
                    </span>
                  )}
                  {event.type === 'finder_location_shared' && mapsUrl(event.metadata?.latitude, event.metadata?.longitude) && (
                    <a
                      href={mapsUrl(event.metadata?.latitude, event.metadata?.longitude)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-800"
                    >
                      <MapPin size={11} aria-hidden="true" /> Open in Maps
                    </a>
                  )}
                </li>
              );
            })}
          </ol>
          {events.length >= 50 && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="mt-3 w-full min-h-11 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {loadingMore ? 'Loading…' : 'Load older activity'}
            </button>
          )}
        </>
      )}
    </section>
  );
}

export default PetHistorySection;
