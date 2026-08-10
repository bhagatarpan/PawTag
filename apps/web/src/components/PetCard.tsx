import { useState, useEffect } from 'react';
import {
  PawPrint, ShieldAlert, ShieldCheck, Clock, AlertTriangle,
  CheckCircle, Star, Skull, EyeOff, ChevronRight, ShoppingBag,
  Edit2, Activity, CreditCard, QrCode, MoreVertical,
  Stethoscope, Tag, Camera
} from 'lucide-react';

interface PetPhoto { url: string; caption?: string; isMain: boolean; }
interface PetTag {
  _id: string;
  tagId: string;
  tagType?: string;
  status: string;
  subscription?: {
    productName: string;
    status: string;
    price: number;
    autoRenew: boolean;
  };
}

interface PetCardProps {
  pet: any;
  index: number;
  foundTimer?: { display: string } | null;
  onEdit: (pet: any) => void;
  onHealth: (pet: any) => void;
  onMarkLost: (id: string) => void;
  onMarkFound: (id: string) => void;
  onMarkTerminal: (id: string, reason: string) => void;
  onDelete: (id: string) => void;
}

const STATUS_CONFIG: Record<string, { label: string; icon: any; gradient: string; badge: string; ring: string; bg: string; text: string; iconBg: string; pulse?: boolean; description?: string }> = {
  safe: { label: 'Safe', icon: ShieldCheck, gradient: 'from-emerald-500 to-green-500', badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', ring: 'ring-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-700', iconBg: 'bg-emerald-100', description: 'All good' },
  lost: { label: 'LOST', icon: ShieldAlert, gradient: 'from-red-500 to-rose-600', badge: 'bg-red-50 text-red-700 ring-1 ring-red-200', ring: 'ring-red-200', bg: 'bg-gradient-to-r from-red-500 to-rose-600', text: 'text-white', iconBg: 'bg-red-400/30', pulse: true, description: 'Actively searching' },
  found: { label: 'FOUND', icon: ShieldCheck, gradient: 'from-amber-400 to-orange-500', badge: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200', ring: 'ring-amber-200', bg: 'bg-gradient-to-r from-amber-400 to-orange-500', text: 'text-white', iconBg: 'bg-amber-300/30', description: 'Awaiting pickup' },
  deceased: { label: 'Deceased', icon: Skull, gradient: 'from-gray-500 to-gray-600', badge: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200', ring: 'ring-gray-200', bg: 'bg-gray-100', text: 'text-gray-600', iconBg: 'bg-gray-200' },
  stolen: { label: 'Stolen', icon: EyeOff, gradient: 'from-purple-500 to-violet-600', badge: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200', ring: 'ring-purple-200', bg: 'bg-gradient-to-r from-purple-500 to-violet-600', text: 'text-white', iconBg: 'bg-purple-400/30', pulse: true, description: 'Report to police' },
  transferred: { label: 'Transferred', icon: ChevronRight, gradient: 'from-blue-500 to-indigo-500', badge: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200', ring: 'ring-blue-200', bg: 'bg-blue-50', text: 'text-blue-700', iconBg: 'bg-blue-100' },
  donated: { label: 'Donated', icon: Star, gradient: 'from-teal-500 to-cyan-500', badge: 'bg-teal-50 text-teal-700 ring-1 ring-teal-200', ring: 'ring-teal-200', bg: 'bg-teal-50', text: 'text-teal-700', iconBg: 'bg-teal-100' },
  sold: { label: 'Sold', icon: ShoppingBag, gradient: 'from-amber-500 to-yellow-500', badge: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200', ring: 'ring-amber-200', bg: 'bg-amber-50', text: 'text-amber-700', iconBg: 'bg-amber-100' },
};

function getMainPhoto(pet: any): string | null {
  if (pet.photos?.length > 0) {
    const m = pet.photos.find((p: PetPhoto) => p.isMain);
    return m ? m.url : pet.photos[0].url;
  }
  return pet.photoUrl || null;
}

function formatBreed(pet: any): string {
  const origin = pet.breedOrigin || 'Purebred';
  const breed = pet.breed || '';
  const secondary = pet.secondaryBreed || '';
  if (origin === 'Unknown') return 'Unknown';
  if ((origin === 'Mixed Breed' || origin === 'Designer Breed') && secondary && secondary !== 'Unknown') {
    return `${origin === 'Designer Breed' ? 'Designer' : 'Mixed'} (${breed} × ${secondary})`;
  }
  if (origin === 'Landrace') return `${breed} (Landrace)`;
  return breed;
}

function genderLabel(g: string): string {
  return g === 'male' ? 'Male' : g === 'female' ? 'Female' : 'Unknown';
}

function formatAge(pet: any): string {
  if (pet.age != null) return `${pet.age} yr${pet.age !== 1 ? 's' : ''}`;
  if (pet.dateOfBirth) {
    const diff = Date.now() - new Date(pet.dateOfBirth).getTime();
    const years = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
    if (years > 0) return `${years} yr${years !== 1 ? 's' : ''}`;
    const months = Math.floor(diff / (30.44 * 24 * 60 * 60 * 1000));
    return `${months} mo`;
  }
  return '';
}

export default function PetCard({
  pet, index, foundTimer, onEdit, onHealth, onMarkLost, onMarkFound, onMarkTerminal, onDelete
}: PetCardProps) {
  const [imgError, setImgError] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const mainPhoto = getMainPhoto(pet);
  const status = STATUS_CONFIG[pet.status] || STATUS_CONFIG.safe;
  const StatusIcon = status.icon;
  const age = formatAge(pet);

  useEffect(() => {
    const handler = () => setShowMenu(false);
    if (showMenu) document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showMenu]);

  return (
    <div
      className={`pet-card bg-white rounded-2xl overflow-hidden border border-gray-100 animate-stagger-in relative group ${
        pet.status === 'lost' ? `ring-2 ${status.ring} border-red-200` :
        pet.status === 'found' ? `ring-2 ${status.ring} border-amber-200` : ''
      }`}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Photo Section */}
      <div className="relative h-56 bg-gray-100 overflow-hidden">
        {mainPhoto && !imgError ? (
          <>
            <img
              src={mainPhoto}
              alt={pet.name}
              className="pet-card-photo w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-teal-50 via-cyan-50 to-blue-50 flex flex-col items-center justify-center gap-2">
            <div className="w-16 h-16 rounded-2xl bg-white/80 flex items-center justify-center shadow-sm">
              <PawPrint size={32} className="text-teal-400" />
            </div>
            <button
              onClick={() => onEdit(pet)}
              className="text-xs text-teal-600 font-medium hover:text-teal-800 transition-colors flex items-center gap-1"
            >
              <Camera size={12} /> Add photo
            </button>
          </div>
        )}

        {/* Photo count */}
        {pet.photos?.length > 1 && (
          <div className="absolute top-3 right-3 glass rounded-full px-2.5 py-1 text-xs font-medium text-gray-700 flex items-center gap-1">
            <Camera size={11} />
            {pet.photos.length}
          </div>
        )}

        {/* Lost count badge */}
        {pet.status === 'lost' && pet.lostCount > 0 && (
          <div className="absolute bottom-3 right-3 bg-red-600/90 text-white text-xs font-bold px-2.5 py-1 rounded-full">
            Lost {pet.lostCount}×
          </div>
        )}

        {/* Found timer */}
        {pet.status === 'found' && foundTimer?.display && (
          <div className="absolute bottom-3 left-3 glass rounded-full px-3 py-1.5 text-xs font-medium text-gray-800 flex items-center gap-1.5">
            <Clock size={12} className="text-amber-600" />
            <span className="font-mono">{foundTimer.display}</span>
          </div>
        )}
      </div>

      {/* Status Management Banner */}
      {pet.status !== 'safe' && (
        <div className={`flex items-center gap-3 px-4 py-3 ${status.bg} ${status.pulse ? 'animate-status-pulse' : ''}`}>
          <div className={`w-9 h-9 rounded-xl ${status.iconBg} flex items-center justify-center flex-shrink-0`}>
            <StatusIcon size={18} className={status.text} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold ${status.text}`}>{status.label}</span>
              {pet.status === 'lost' && pet.lostCount > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${status.text} bg-white/20`}>
                  Lost {pet.lostCount}×
                </span>
              )}
            </div>
            {status.description && (
              <p className={`text-[11px] ${status.text} opacity-80`}>{status.description}</p>
            )}
          </div>
          {pet.status === 'found' && foundTimer?.display && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/20 ${status.text}`}>
              <Clock size={12} />
              <span className="text-xs font-mono font-bold">{foundTimer.display}</span>
            </div>
          )}
        </div>
      )}

      {/* Content Section */}
      <div className="p-5">
        {/* Name & ID */}
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0">
            <h3 className="text-xl font-bold text-gray-900 truncate">{pet.name}</h3>
            {pet.petId && (
              <p className="text-xs text-gray-400 font-mono mt-0.5">ID: {pet.petId}</p>
            )}
          </div>
          <div className="relative flex-shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <MoreVertical size={16} />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-20 animate-fade-in">
                <button onClick={() => { onEdit(pet); setShowMenu(false); }} className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5">
                  <Edit2 size={14} className="text-gray-400" /> Edit Pet
                </button>
                <button onClick={() => { onHealth(pet); setShowMenu(false); }} className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5">
                  <Stethoscope size={14} className="text-gray-400" /> Health Records
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button onClick={() => { onDelete(pet._id); setShowMenu(false); }} className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2.5">
                  Delete Pet
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Info Chips */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-50 text-xs font-medium text-gray-600">
            {pet.petType || pet.species}
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-50 text-xs font-medium text-gray-600">
            {formatBreed(pet)}
          </span>
          {age && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-50 text-xs font-medium text-gray-600">
              {genderLabel(pet.gender)} · {age}
            </span>
          )}
          {pet.color && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-50 text-xs font-medium text-gray-600">
              {pet.color}{pet.pattern ? ` · ${pet.pattern}` : ''}
            </span>
          )}
        </div>

        {/* Medical Alerts */}
        {pet.medicalAlerts && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-gradient-to-r from-red-50 to-rose-50 border border-red-100 mb-3">
            <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <AlertTriangle size={14} className="text-red-600" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-red-400 tracking-wider mb-0.5">Medical Alerts</p>
              <p className="text-xs text-red-700 font-medium leading-relaxed">{pet.medicalAlerts}</p>
            </div>
          </div>
        )}

        {/* Tag & Subscription */}
        {pet.linkedTag ? (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-100 mb-3">
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-sm flex-shrink-0">
              <QrCode size={18} className="text-teal-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-gray-800 font-mono">{pet.linkedTag.tagId}</span>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-teal-100 text-teal-700">
                  {pet.linkedTag.tagType || 'QR'}
                </span>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  pet.linkedTag.status === 'active' ? 'bg-green-500' :
                  pet.linkedTag.status === 'lost' ? 'bg-red-500 animate-pulse' : 'bg-gray-400'
                }`} />
              </div>
              {pet.linkedTag.subscription ? (
                <div className="flex items-center gap-1.5 mt-1">
                  <CreditCard size={11} className="text-teal-600" />
                  <span className="text-[11px] text-teal-700 font-medium">{pet.linkedTag.subscription.productName}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    pet.linkedTag.subscription.status === 'active' ? 'bg-green-100 text-green-700' :
                    pet.linkedTag.subscription.status === 'grace_period' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {pet.linkedTag.subscription.status === 'active' ? 'Active' :
                     pet.linkedTag.subscription.status === 'grace_period' ? 'Expiring' : 'Expired'}
                  </span>
                  <span className="text-[11px] text-teal-500">${pet.linkedTag.subscription.price}/mo</span>
                </div>
              ) : (
                <p className="text-[11px] text-teal-500 mt-0.5 italic">No subscription</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 border border-dashed border-gray-200 mb-3">
            <Tag size={16} className="text-gray-400" />
            <span className="text-xs text-gray-400">No tag linked</span>
          </div>
        )}

        {/* Quick Info Row */}
        {pet.favouriteFood && (
          <p className="text-xs text-gray-500 mb-3 flex items-center gap-1.5">
            <span className="text-gray-400">Fav food:</span>
            <span className="font-medium">{pet.favouriteFood}</span>
          </p>
        )}

        {/* Actions */}
        <div className="pet-card-actions pt-3 border-t border-gray-100 flex flex-wrap gap-2">
          <button
            onClick={() => onEdit(pet)}
            className="flex-1 min-w-0 bg-teal-50 text-teal-700 hover:bg-teal-100 px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-teal-100 transition-all hover:shadow-sm"
          >
            <Edit2 size={13} /> Edit
          </button>
          <button
            onClick={() => onHealth(pet)}
            className="flex-1 min-w-0 bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-blue-100 transition-all hover:shadow-sm"
          >
            <Activity size={13} /> Health
          </button>
          {pet.status === 'safe' ? (
            <button
              onClick={() => onMarkLost(pet._id)}
              className="flex-1 min-w-0 bg-red-50 text-red-700 hover:bg-red-100 px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-red-100 transition-all hover:shadow-sm"
            >
              <ShieldAlert size={13} /> Mark Lost
            </button>
          ) : pet.status === 'lost' || pet.status === 'found' ? (
            <button
              onClick={() => onMarkFound(pet._id)}
              className="flex-1 min-w-0 bg-green-50 text-green-700 hover:bg-green-100 px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-green-100 transition-all hover:shadow-sm"
            >
              <CheckCircle size={13} /> Mark Found
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function PetCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
      <div className="h-56 animate-shimmer" />
      <div className="p-5 space-y-3">
        <div className="flex justify-between">
          <div className="space-y-2">
            <div className="h-6 w-28 animate-shimmer rounded-lg" />
            <div className="h-3 w-20 animate-shimmer rounded-lg" />
          </div>
          <div className="h-8 w-8 animate-shimmer rounded-lg" />
        </div>
        <div className="flex gap-1.5">
          <div className="h-6 w-16 animate-shimmer rounded-lg" />
          <div className="h-6 w-20 animate-shimmer rounded-lg" />
          <div className="h-6 w-14 animate-shimmer rounded-lg" />
        </div>
        <div className="h-14 w-full animate-shimmer rounded-xl" />
        <div className="flex gap-2 pt-3 border-t border-gray-100">
          <div className="h-9 flex-1 animate-shimmer rounded-xl" />
          <div className="h-9 flex-1 animate-shimmer rounded-xl" />
          <div className="h-9 flex-1 animate-shimmer rounded-xl" />
        </div>
      </div>
    </div>
  );
}
