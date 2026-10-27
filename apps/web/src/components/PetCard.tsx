import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  PawPrint, Heart, ChevronRight, Edit2, Stethoscope, QrCode,
  MoreVertical, Trash2, Unlink,
} from 'lucide-react';
import { CopyButton, ConfirmDialog, toast, StatusBadge } from '@pawtag/ui';
import { API } from '@pawtag/shared/api';
import api from '../lib/api';
import { petStatusBadgeLabel, petStatusBadgeVariant, petMainPhoto } from '../lib/pet-display';

interface PetCardProps {
  pet: any;
  index: number;
  /**
   * Registry-driven pet_health_records access (paid tier or free 3-month
   * activation window) — fetched once by MyPets and passed down; the card
   * never fetches entitlements itself (docs/ACTIVATION-ENTITLEMENTS.md).
   */
  canAccessHealthRecords: boolean;
  onEdit: (pet: any) => void;
  onHealth: (pet: any) => void;
  onDelete: (id: string) => void;
}

export default function PetCard({
  pet, index, canAccessHealthRecords, onEdit, onHealth, onDelete,
}: PetCardProps) {
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);
  const [unlinkReason, setUnlinkReason] = useState('');
  const [unlinking, setUnlinking] = useState(false);

  // ONE gate for both Health surfaces (quick action + menu item):
  // entitled → open records; locked → premium upsell to /membership.
  // Server stays authoritative (403 + upgradeUrl) — this is display only.
  const handleHealthClick = () => {
    if (canAccessHealthRecords) {
      onHealth(pet);
    } else {
      navigate('/membership');
    }
  };

  const mainPhoto = petMainPhoto(pet);
  const statusLabel = petStatusBadgeLabel(pet.status);
  const statusVariant = petStatusBadgeVariant(pet.status);

  useEffect(() => {
    const handler = () => setShowMenu(false);
    if (showMenu) document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showMenu]);

  const handleUnlink = async () => {
    if (!unlinkReason || !pet.linkedTag) return;
    setUnlinking(true);
    try {
      await api.delete(API.customer.tags.unlinkPet(pet.linkedTag._id), { data: { reason: unlinkReason } });
      setShowUnlinkConfirm(false);
      setUnlinkReason('');
      // Refresh the page to show updated state
      window.location.reload();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to unlink tag');
    } finally {
      setUnlinking(false);
    }
  };

  const hasAlert = Boolean(pet.medicalAlerts);

  return (
    <>
      <div
        className={`pet-card relative bg-white rounded-2xl overflow-hidden border border-gray-100 animate-stagger-in ${
          pet.status === 'lost' ? 'ring-2 ring-red-200 border-red-200' :
          pet.status === 'found' ? 'ring-2 ring-amber-200 border-amber-200' :
          pet.status === 'safe' ? 'ring-1 ring-emerald-200' : ''
        }`}
        style={{ animationDelay: `${index * 80}ms` }}
      >
        {/* Whole-card navigation (menu stays independently clickable) */}
        <Link
          to={`/account/pets/${pet._id}`}
          aria-label={`View ${pet.name}`}
          className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
        />

        <div className="relative z-20 flex gap-3 p-3 pointer-events-none">
          {/* Photo — board 1: square photo left */}
          <div className="w-24 h-24 shrink-0 rounded-xl bg-primary-50 overflow-hidden flex items-center justify-center">
            {mainPhoto && !imgError ? (
              <img
                src={mainPhoto}
                alt={pet.name}
                className="pet-card-photo w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <PawPrint size={28} className="text-primary-400" aria-hidden="true" />
            )}
          </div>

          {/* Details */}
          <div className="min-w-0 flex-1 py-0.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-gray-900 truncate">{pet.name}</h3>
                <p className="text-xs text-gray-500 truncate">
                  {[pet.petType || pet.species, pet.breed].filter(Boolean).join(' · ') || 'Pet'}
                </p>
              </div>
              <StatusBadge label={statusLabel} variant={statusVariant} />
            </div>

            {/* Meta rows (board 1) — text-sm, comfortable spacing */}
            <div className="mt-2.5 space-y-1.5">
              {pet.linkedTag ? (
                <div className="flex items-center gap-2 text-sm text-gray-600 min-w-0">
                  <QrCode size={14} className="text-primary-500 shrink-0" aria-hidden="true" />
                  <span className="font-mono truncate">PawTag #{pet.linkedTag.tagId}</span>
                  <span
                    aria-hidden="true"
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      pet.linkedTag.status === 'active' ? 'bg-green-500' :
                      pet.linkedTag.status === 'lost' ? 'bg-red-500' :
                      pet.linkedTag.status === 'expired' ? 'bg-amber-500' :
                      'bg-gray-400'
                    }`}
                  />
                  <span className="sr-only">Tag status: {pet.linkedTag.status}</span>
                  <ChevronRight size={14} className="text-gray-400 shrink-0 ml-auto" aria-hidden="true" />
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <QrCode size={14} className="shrink-0" aria-hidden="true" />
                  No tag linked — tap to activate
                </div>
              )}
              <div className={`flex items-center gap-2 text-sm ${hasAlert ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                <Heart size={14} className={hasAlert ? 'text-red-500 shrink-0' : 'text-primary-500 shrink-0'} aria-hidden="true" />
                {hasAlert ? 'Medical alert on file' : 'No known conditions'}
              </div>
              {/* Lost count survives reunions (responsibility history): red
                  only while the pet is actually lost; neutral once recovered. */}
              {pet.lostCount > 0 && (
                <div className={`text-sm font-semibold ${pet.status === 'lost' ? 'text-red-600' : 'text-gray-500'}`}>
                  Lost {pet.lostCount}×
                </div>
              )}
            </div>
          </div>

          {/* Overflow menu */}
          <div className="pointer-events-auto self-start">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
              aria-label={`Options for ${pet.name}`}
              aria-expanded={showMenu}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <MoreVertical size={16} />
            </button>
            {showMenu && (
              <div className="absolute right-3 top-3 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-30 animate-fade-in">
                <button onClick={() => { onEdit(pet); setShowMenu(false); }} className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5">
                  <Edit2 size={14} className="text-gray-400" /> Edit Pet
                </button>
                <button onClick={() => { handleHealthClick(); setShowMenu(false); }} className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2.5 ${canAccessHealthRecords ? 'text-gray-700 hover:bg-gray-50' : 'text-primary-600 hover:bg-primary-50'}`}>
                  <Stethoscope size={14} className={canAccessHealthRecords ? 'text-gray-400' : ''} />
                  Health Records{canAccessHealthRecords ? '' : ' ✦'}
                </button>
                {pet.linkedTag && (
                  <button onClick={() => { setShowMenu(false); setShowUnlinkConfirm(true); }} className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5">
                    <Unlink size={14} className="text-gray-400" /> Unlink tag
                  </button>
                )}
                <div className="border-t border-gray-100 my-1" />
                <button onClick={() => { onDelete(pet._id); setShowMenu(false); }} className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2.5">
                  <Trash2 size={14} /> Delete Pet
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Unlink Tag Confirmation Dialog */}
      {showUnlinkConfirm && (
        <ConfirmDialog
          open={showUnlinkConfirm}
          onClose={() => { setShowUnlinkConfirm(false); setUnlinkReason(''); }}
          onConfirm={handleUnlink}
          title="Unlink Tag from Pet"
          message={`This will remove tag ${pet.linkedTag?.tagId || ''} from ${pet.name}. The tag can be linked to a different pet later.`}
          confirmLabel={unlinking ? 'Unlinking...' : 'Unlink Tag'}
          variant="warning"
          reasons={['customer_mistake', 'wrong_pet', 'technical_issue']}
          selectedReason={unlinkReason}
          onReasonChange={setUnlinkReason}
          showNotes={false}
        />
      )}
    </>
  );
}

export function PetCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
      <div className="flex gap-3 p-3">
        <div className="w-24 h-24 shrink-0 rounded-xl animate-shimmer bg-gray-200" />
        <div className="flex-1 py-1 space-y-2">
          <div className="h-4 w-28 animate-shimmer rounded" />
          <div className="h-3 w-20 animate-shimmer rounded" />
          <div className="h-3 w-32 animate-shimmer rounded" />
          <div className="h-3 w-24 animate-shimmer rounded" />
        </div>
        <div className="h-7 w-7 animate-shimmer rounded-lg" />
      </div>
    </div>
  );
}
