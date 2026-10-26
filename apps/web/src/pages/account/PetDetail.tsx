import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, QrCode, Edit2, ShieldAlert, CheckCircle, Clock,
  Stethoscope, Heart, FileText, MapPin, Copy, PawPrint, Bone,
} from 'lucide-react';
import {
  StatusBadge, CopyButton, InfoCard, PhotoHero, Button, buttonClassName, toast, ConfirmDialog,
} from '@pawtag/ui';
import { API } from '@pawtag/shared/api';
import api from '../../lib/api';
import {
  petStatusBadgeLabel, petStatusBadgeVariant, petAgeLabel, petMainPhoto, timeAgo,
} from '../../lib/pet-display';
import PetHistorySection from './PetHistorySection';

function tagStatusVariant(status?: string): 'success' | 'danger' | 'warning' | 'info' | 'neutral' {
  switch (status) {
    case 'active': return 'success';
    case 'lost': return 'danger';
    case 'expired': return 'warning';
    case 'replaced': return 'info';
    default: return 'neutral';
  }
}

export default function PetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [pet, setPet] = useState<any>(null);
  const [tag, setTag] = useState<any>(null);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [foundTimer, setFoundTimer] = useState<any>(null);
  const [canAccessHealthRecords, setCanAccessHealthRecords] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Explicit owner confirmation gates both status transitions (business rule):
  // a pet enters/leaves Lost Mode only through a deliberate dialog, never on
  // the first button tap.
  const [confirmLostOpen, setConfirmLostOpen] = useState(false);
  const [confirmFoundOpen, setConfirmFoundOpen] = useState(false);

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
      const linked = (tagsRes.data.data || []).find((t: any) => t.petId?._id === petRes.data.data._id || t.petId === petRes.data.data._id);
      setTag(linked || null);
      // Locations + found timer are best-effort context, never blockers.
      api.get(API.customer.pets.section(id, 'locations'))
        .then((r) => setLastSeen(r.data.data?.[0]?.timestamp || null))
        .catch(() => {});
      if (petRes.data.data.status === 'found') {
        api.get(API.customer.pets.foundTimer(id))
          .then((r) => { if (r.data.data.active) setFoundTimer(r.data.data); })
          .catch(() => {});
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load this pet.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get(API.customer.membership.entitlements)
      .then((r) => setCanAccessHealthRecords(r.data?.data?.entitlements?.pet_health_records?.enabled === true && r.data?.data?.entitlements?.pet_health_records?.value === true))
      .catch(() => setCanAccessHealthRecords(false));
  }, []);

  const markLost = async (): Promise<boolean> => {
    if (!pet) return false;
    setBusy(true);
    try {
      await api.post(API.customer.pets.markLost(pet._id));
      toast.success(`${pet.name} is now in Lost Mode`);
      navigate(`/account/pets/${pet._id}/lost`);
      return true;
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Could not start Lost Mode. Please try again.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const markFound = async (): Promise<boolean> => {
    if (!pet) return false;
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
      await load();
      return true;
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Could not update status. Please try again.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in" aria-busy="true">
        <div className="h-4 w-40 bg-gray-200 rounded animate-shimmer" />
        <div className="aspect-[16/9] rounded-2xl bg-gray-200 animate-shimmer" />
        <div className="h-28 bg-gray-200 rounded-2xl animate-shimmer" />
        <div className="h-24 bg-gray-200 rounded-2xl animate-shimmer" />
        <span className="sr-only">Loading pet…</span>
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

  const photo = petMainPhoto(pet);
  const statusLabel = petStatusBadgeLabel(pet.status);
  const statusVariant = petStatusBadgeVariant(pet.status);
  const age = petAgeLabel(pet);
  const subtitle = [pet.breed, age].filter(Boolean).join(' · ') || 'Pet';

  const vaccinated = (pet.vaccinations || []).length;
  const allergies = (pet.allergies || []).length;
  const conditions = (pet.healthConditions || []).length;
  const healthy = allergies === 0 && conditions === 0 && !pet.medicalAlerts;

  return (
    // Lost Mode light-red surface: driven purely by persisted pet.status, so
    // reunion (status → safe) restores the normal theme automatically and
    // only this pet's page is affected in multi-pet accounts.
    <div className={`space-y-4 animate-fade-in ${pet.status === 'lost' ? 'bg-red-50 border border-red-200 rounded-2xl p-3 sm:p-5' : ''}`}>
      {/* Back + Edit overlaid on the photo hero (board 1) */}
      <div className="relative">
        <div className="absolute top-3 inset-x-3 z-10 flex items-center justify-between gap-3">
          <Link
            to="/account/pets"
            aria-label="Back to My Pets"
            className="w-9 h-9 rounded-full bg-white/90 shadow-sm text-gray-700 hover:text-primary-700 flex items-center justify-center"
          >
            <ArrowLeft size={18} />
          </Link>
          <Link
            to={`/account/pets?edit=${pet._id}`}
            className={buttonClassName({ variant: 'secondary', size: 'md', className: 'bg-white/90 shadow-sm' })}
          >
            <Edit2 size={14} /> Edit
          </Link>
        </div>

        {photo ? (
          <PhotoHero
            src={photo}
            alt={pet.name}
            title={pet.name}
            subtitle={subtitle}
            className="rounded-2xl"
            aspectClassName="aspect-[16/9] sm:aspect-[21/7]"
          />
        ) : (
          <div className="rounded-2xl bg-gradient-to-br from-primary-600 to-primary-700 p-5 pt-14 sm:p-6 sm:pt-14 text-white">
            <h1 className="text-xl font-bold text-white sm:text-2xl">{pet.name}</h1>
            <div className="mt-1 text-sm text-white/90">{subtitle}</div>
          </div>
        )}
      </div>

      {/* Current state */}
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={statusLabel} variant={statusVariant} size="md" />
        {pet.status === 'lost' && pet.lostCount > 0 && (
          <StatusBadge label={`Lost ${pet.lostCount}×`} variant="danger" />
        )}
        {foundTimer?.foundAt && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
            <Clock size={12} /> Found {timeAgo(foundTimer.foundAt)}
          </span>
        )}
      </div>

      {pet.status === 'lost' && (
        <InfoCard
          tone="danger"
          icon={<ShieldAlert size={18} />}
          title={`${pet.name} is in Lost Mode`}
          trailing={
            <Link to={`/account/pets/${pet._id}/lost`} className={buttonClassName({ variant: 'secondary' })}>
              Open
            </Link>
          }
        >
          Finders can scan the tag to notify you and share where they saw {pet.name}.
        </InfoCard>
      )}

      {/* Tag status card (board 1) */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 shrink-0 rounded-2xl bg-primary-50 flex items-center justify-center">
            <QrCode size={30} className="text-primary-600" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-900">Tag status</p>
              {tag ? (
                <StatusBadge label={tag.status} variant={tagStatusVariant(tag.status)} />
              ) : (
                <StatusBadge label="No tag" variant="neutral" />
              )}
            </div>
            {tag ? (
              <>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="text-sm font-mono text-gray-800 truncate">PawTag #{tag.tagId}</span>
                  <CopyButton text={tag.tagId} size={12} />
                </div>
                <p className="mt-1 text-xs text-gray-500 inline-flex items-center gap-1">
                  <MapPin size={12} aria-hidden="true" />
                  {lastSeen ? `Last seen ${timeAgo(lastSeen)}` : 'No shared locations yet'}
                </p>
              </>
            ) : (
              <Link to="/account/redeem-tag" className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium">
                <Copy size={13} /> Activate a tag for {pet.name}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Health summary (board 1) — display gated by pet_health_records */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold text-gray-900 inline-flex items-center gap-2">
            <Heart size={15} className="text-primary-500" aria-hidden="true" /> Health summary
          </h2>
          {canAccessHealthRecords ? (
            <StatusBadge label={healthy ? 'All good' : 'On file'} variant={healthy ? 'success' : 'info'} />
          ) : null}
        </div>

        {canAccessHealthRecords ? (
          <>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-50 text-xs font-medium text-primary-700">
                <PawPrint size={13} aria-hidden="true" />
                {vaccinated > 0 ? `${vaccinated} vaccination${vaccinated > 1 ? 's' : ''} on file` : 'No vaccinations on file'}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-50 text-xs font-medium text-primary-700">
                <Bone size={13} aria-hidden="true" />
                {allergies === 0 ? 'No known allergies' : `${allergies} allerg${allergies > 1 ? 'ies' : 'y'} noted`}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-50 text-xs font-medium text-primary-700">
                <FileText size={13} aria-hidden="true" />
                {conditions === 0 ? 'No known conditions' : `${conditions} condition${conditions > 1 ? 's' : ''} noted`}
              </span>
            </div>
            {pet.medicalAlerts && (
              <div className="mt-3">
                <InfoCard tone="danger" icon={<ShieldAlert size={16} />} title="Medical alerts">
                  {pet.medicalAlerts}
                </InfoCard>
              </div>
            )}
          </>
        ) : (
          <InfoCard tone="primary" icon={<Stethoscope size={16} />} title="Health summary is a membership benefit ✦"
            trailing={<Link to="/membership" className={buttonClassName({ variant: 'secondary' })}>View plans</Link>}>
            Vaccinations, allergies, conditions and vet history unlock with PawTag Health.
          </InfoCard>
        )}
      </div>

      {/* Care rows → Health records surface (board 1, real data only) */}
      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
        <button
          type="button"
          onClick={() => (canAccessHealthRecords ? navigate(`/account/pets/${pet._id}/health`) : navigate('/membership'))}
          className="w-full text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3 px-5 py-4">
            <span className="w-9 h-9 shrink-0 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
              <Stethoscope size={16} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">Health records</p>
              <p className="text-xs text-gray-500 truncate">
                {canAccessHealthRecords
                  ? `${(pet.vetDetails || []).length} vet visit${(pet.vetDetails || []).length === 1 ? '' : 's'}, vaccinations, medications${pet.favouriteFood ? ` · Fav food: ${pet.favouriteFood}` : ''}`
                  : 'Vaccinations, allergies, vet visits'}
              </p>
            </div>
            <span className="text-xs font-medium text-primary-600">
              {canAccessHealthRecords ? 'View' : 'Unlock ✦'}
            </span>
          </div>
        </button>
        {canAccessHealthRecords && (pet.vetDetails || []).length > 0 && (
          <div className="flex items-center gap-3 px-5 py-4">
            <span className="w-9 h-9 shrink-0 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
              <FileText size={16} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">Vet information</p>
              <p className="text-xs text-gray-500 truncate">{pet.vetDetails.map((v: any) => v.clinicName).filter(Boolean).join(', ')}</p>
            </div>
          </div>
        )}
      </div>

      {/* Primary actions (board 1) — both transitions gated by confirmation */}
      <div className="space-y-3">
        {pet.status === 'safe' && (
          <Button variant="danger" size="lg" full icon={<ShieldAlert size={18} />} disabled={busy} onClick={() => setConfirmLostOpen(true)}>
            Mark as Lost
          </Button>
        )}
        {(pet.status === 'lost' || pet.status === 'found') && (
          <Button variant="success" size="lg" full icon={<CheckCircle size={18} />} disabled={busy} onClick={() => setConfirmFoundOpen(true)}>
            Mark as Found
          </Button>
        )}
      </div>

      {/* Lost-and-found timeline (scan → finder → alerts → reunion) */}
      <PetHistorySection petId={pet._id} />

      <ConfirmDialog
        open={confirmLostOpen}
        onClose={() => setConfirmLostOpen(false)}
        onConfirm={async () => {
          const ok = await markLost();
          if (ok) setConfirmLostOpen(false);
        }}
        loading={busy}
        variant="danger"
        title="Are you sure your pet is lost?"
        message="Activating Lost Mode helps you manage scan alerts, review possible sightings, and coordinate with people who may have found your pet."
        confirmLabel="Yes, Activate Lost Mode"
        cancelLabel="Cancel"
      />
      <ConfirmDialog
        open={confirmFoundOpen}
        onClose={() => setConfirmFoundOpen(false)}
        onConfirm={async () => {
          const ok = await markFound();
          if (ok) setConfirmFoundOpen(false);
        }}
        loading={busy}
        variant="primary"
        title="Has your pet been safely reunited with you?"
        message="Confirm only when your pet is back in your care. This will end Lost Mode, but your pet's lost-and-found history will remain available."
        confirmLabel="Yes, My Pet Is Reunited"
        cancelLabel="Not Yet"
      />
    </div>
  );
}
