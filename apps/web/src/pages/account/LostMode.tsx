import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MapPin, ShieldAlert, ScanLine, Bell, Share2, CheckCircle,
  Clock, Users, Navigation,
} from 'lucide-react';
import { InfoCard, Button, buttonClassName, StatusBadge, toast } from '@pawtag/ui';
import { API } from '@pawtag/shared/api';
import api from '../../lib/api';
import { timeAgo } from '../../lib/pet-display';

interface LocationRow {
  _id: string;
  timestamp: string;
  location: { latitude: number; longitude: number; accuracy?: number; source: 'gps' | 'qr_scan' | 'manual' };
  notes?: string;
}

interface EscalationRow {
  _id: string;
  petId: { _id?: string; name?: string; petId?: string; photos?: Array<{ url: string }> };
  status: string;
  escalationDeadline: string;
  finderName?: string;
  finderPhone?: string;
}

const LOCATION_SOURCE_LABELS: Record<string, string> = {
  gps: 'Location shared',
  qr_scan: 'Shared on tag scan',
  manual: 'Added manually',
};

/**
 * Finder portal link for a tag — mirrors the origin logic the customer app
 * already uses for its emergency Finder entry (EmergencyLostPet) and the
 * `/finder/:tagId` convention written to NFC tags by admin tooling.
 */
function finderShareUrl(tagId: string): string {
  const configured = import.meta.env.VITE_FINDER_URL;
  if (configured) return `${String(configured).replace(/\/$/, '')}/${tagId}`;
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return `http://localhost:3003/${tagId}`;
  }
  return `${window.location.origin}/finder/${tagId}`;
}

export default function LostMode() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [pet, setPet] = useState<any>(null);
  const [tagId, setTagId] = useState<string | null>(null);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [escalations, setEscalations] = useState<EscalationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [petRes, tagsRes] = await Promise.all([
        api.get(API.customer.pets.detail(id)),
        api.get(API.customer.tags.list),
      ]);
      setPet(petRes.data.data);
      const linked = (tagsRes.data.data || []).find(
        (t: any) => t.petId?._id === petRes.data.data._id || t.petId === petRes.data.data._id,
      );
      setTagId(linked?.tagId || null);

      api.get(API.customer.pets.section(id, 'locations'))
        .then((r) => setLocations(r.data.data || []))
        .catch(() => {});

      // Escalation feed has no petId server filter — fetch scoped by status
      // and narrow client-side to this pet (display only).
      api.get(`${API.customer.escalations.list}?status=pending`)
        .then((r) => {
          const all: EscalationRow[] = r.data.data || [];
          setEscalations(
            all.filter((e) => e.petId?._id === petRes.data.data._id || e.petId?.petId === petRes.data.data.petId),
          );
        })
        .catch(() => {});
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load Lost Mode.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const markFound = async () => {
    if (!pet) return;
    setBusy(true);
    try {
      const res = await api.post(API.customer.pets.markFound(pet._id));
      const timeMs = res.data.data.timeToFoundMs;
      if (timeMs) {
        const hours = Math.floor(timeMs / (1000 * 60 * 60));
        const mins = Math.floor((timeMs % (1000 * 60 * 60)) / (1000 * 60));
        toast.success(`Reunited! ${hours}h ${mins}m to bring ${pet.name} home`);
      } else {
        toast.success(`${pet.name} is marked safe`);
      }
      navigate(`/account/pets/${pet._id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Could not update status. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const shareProfile = async () => {
    if (!tagId) return;
    const url = finderShareUrl(tagId);
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Recovery link copied — share it anywhere');
    } catch {
      toast.info(url);
    }
  };

  const resolveEscalation = async (escId: string) => {
    if (!confirm('Mark as resolved? This means you have made contact with the finder.')) return;
    try {
      await api.post(API.customer.escalations.resolve(escId));
      setEscalations((prev) => prev.filter((e) => e._id !== escId));
      toast.success('Marked resolved — thank you');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Could not update this alert.');
    }
  };

  const forwardEscalation = async (escId: string) => {
    if (!confirm('Forward this alert to your emergency contact now?')) return;
    try {
      await api.post(API.customer.escalations.forward(escId));
      toast.success('Forwarded to your emergency contact');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Could not forward this alert.');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in" aria-busy="true">
        <div className="h-4 w-40 bg-gray-200 rounded animate-shimmer" />
        <div className="h-48 bg-gray-200 rounded-2xl animate-shimmer" />
        <div className="h-32 bg-gray-200 rounded-2xl animate-shimmer" />
        <span className="sr-only">Loading Lost Mode…</span>
      </div>
    );
  }

  if (error || !pet) {
    return (
      <div className="space-y-4">
        <InfoCard tone="danger" icon={<ShieldAlert size={18} />} title={error || 'Pet not found'}>
          It may have been removed.
        </InfoCard>
        <Link to="/account/pets" className={buttonClassName({ variant: 'secondary' })}>
          <ArrowLeft size={16} /> Back to My Pets
        </Link>
      </div>
    );
  }

  // Guard: this screen describes an active lost state — a pet that is not
  // lost gets a calm redirect target instead of a false "Lost Mode" view.
  if (pet.status !== 'lost') {
    return (
      <div className="space-y-4 animate-fade-in">
        <InfoCard tone="primary" icon={<CheckCircle size={18} />} title={`${pet.name} is not in Lost Mode`}>
          Lost Mode is only shown while a pet is actively missing.
        </InfoCard>
        <Link to={`/account/pets/${pet._id}`} className={buttonClassName({ variant: 'secondary' })}>
          <ArrowLeft size={16} /> Back to {pet.name}
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Calm lost-state hero (board 1) — restrained, never alarming */}
      <div className="rounded-2xl bg-red-50 border border-red-100 p-6 text-center">
        <div className="flex justify-between items-start mb-3">
          <Link
            to={`/account/pets/${pet._id}`}
            className="inline-flex items-center gap-1 text-sm text-red-700 hover:text-red-900 transition-colors -mt-1 -ml-1"
          >
            <ArrowLeft size={16} /> {pet.name}
          </Link>
          <StatusBadge label="Lost Mode Active" variant="danger" />
        </div>
        <div className="mx-auto w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center mb-3">
          <span className="relative flex w-9 h-9 items-center justify-center">
            <span className="absolute inline-flex h-full w-full rounded-full bg-red-200 animate-ping opacity-60" aria-hidden="true" />
            <MapPin size={28} className="relative text-red-500" aria-hidden="true" />
          </span>
        </div>
        <h1 className="text-xl font-bold text-gray-900">{pet.name} is in Lost Mode</h1>
        <p className="text-sm text-gray-600 mt-1">We're helping to bring {pet.name} home.</p>
      </div>

      <div className="space-y-4 mt-4">
        {/* Found-pet contact (time-critical, mirrors dashboard priority) */}
        {escalations.map((esc) => {
          const timeLeft = Math.max(0, Math.floor((new Date(esc.escalationDeadline).getTime() - Date.now()) / 60000));
          return (
            <InfoCard
              key={esc._id}
              tone="amber"
              icon={<Users size={18} />}
              title={`${esc.finderName ? esc.finderName : 'A finder'} made contact with ${pet.name}!`}
            >
              <span className="block">{esc.finderPhone ? `Call ${esc.finderPhone} to arrange pickup.` : 'Open your Activity feed to respond.'}</span>
              <span className="mt-1 block font-medium text-amber-700">
                <Clock size={11} className="inline -mt-0.5 mr-1" aria-hidden="true" />
                {timeLeft > 0 ? `${timeLeft} min until your emergency contact is notified` : 'Your emergency contact is being notified'}
              </span>
              <span className="mt-2 flex flex-wrap gap-2">
                <Button variant="success" size="md" icon={<CheckCircle size={14} />} onClick={() => resolveEscalation(esc._id)}>
                  I Made Contact
                </Button>
                <Button variant="secondary" size="md" onClick={() => forwardEscalation(esc._id)}>
                  Forward to EC
                </Button>
              </span>
            </InfoCard>
          );
        })}

        {/* What finders can do — truthful capabilities only (no GPS claims) */}
        <InfoCard tone="danger" icon={<ScanLine size={18} />} title="Finders can scan the tag">
          Anyone who scans {pet.name}'s PawTag can share their location and send you a message — no app or account needed on their side.
        </InfoCard>

        {/* What happens next (board 1) */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">What happens next?</h2>
          <ol className="space-y-4">
            {[
              { icon: ScanLine, title: 'Nearby people can scan the tag', body: `Share the recovery link — every scan lets a finder reach you.` },
              { icon: Navigation, title: 'Sightings appear here', body: 'Locations finders share are listed below in real time.' },
              { icon: Bell, title: "You're notified of every update", body: 'Messages and sightings show up in your Activity feed.' },
            ].map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span className="w-7 h-7 shrink-0 rounded-full bg-primary-600 text-white text-sm font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{step.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Shared locations (real LocationEvents) */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-semibold text-gray-900 inline-flex items-center gap-2">
              <MapPin size={15} className="text-red-500" aria-hidden="true" /> Shared locations
            </h2>
            <span className="text-xs text-gray-400">{locations.length}</span>
          </div>
          {locations.length === 0 ? (
            <p className="text-sm text-gray-500">
              No shared locations yet — they'll appear here the moment a finder shares one.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {locations.slice(0, 10).map((loc) => (
                <li key={loc._id} className="py-3 flex items-start gap-3">
                  <span className="w-8 h-8 shrink-0 rounded-lg bg-red-50 text-red-500 flex items-center justify-center mt-0.5">
                    <MapPin size={15} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {LOCATION_SOURCE_LABELS[loc.location?.source] || 'Location shared'}
                    </p>
                    {loc.notes && <p className="text-xs text-gray-500 truncate">{loc.notes}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">{timeAgo(loc.timestamp)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recovery link + mark found (board 1 CTAs) */}
        <div className="space-y-3">
          <Button variant="primary" size="lg" full icon={<Share2 size={18} />} onClick={shareProfile} disabled={!tagId}>
            Share {pet.name}'s recovery link
          </Button>
          <Button variant="success" size="lg" full icon={<CheckCircle size={18} />} disabled={busy} onClick={markFound}>
            Mark {pet.name} as Found
          </Button>
        </div>
      </div>
    </div>
  );
}
