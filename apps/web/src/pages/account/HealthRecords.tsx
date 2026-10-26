import { useState, useEffect, FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { API } from '@pawtag/shared/api';
import api from '../../lib/api';
import { ArrowLeft, Plus, Trash2, Syringe, Cpu, Pill, AlertTriangle, Stethoscope, Scissors, Weight, Heart, Activity, Edit2, PawPrint, ShieldAlert } from 'lucide-react';
import { toast, Button, InfoCard, buttonClassName } from '@pawtag/ui';
import { petMainPhoto, petAgeLabel } from '../../lib/pet-display';

const CORE_DOG_VACCINES = ['Canine Distemper (CDV)', 'Canine Parvovirus (CPV-2)', 'Canine Adenovirus (CAV-2)'];
const NON_CORE_DOG_VACCINES = ['Leptospirosis', 'Canine Influenza', 'Bordetella (Kennel Cough)', 'Canine Parainfluenza'];
const CORE_CAT_VACCINES = ['Feline Panleukopenia (FPV)', 'Feline Calicivirus (FCV)', 'Feline Herpesvirus-1 (FHV-1)'];
const NON_CORE_CAT_VACCINES = ['Feline Leukaemia Virus (FeLV)', 'Feline Immunodeficiency Virus (FIV)', 'Chlamydia', 'Feline Bordetella'];

function getVaccineOptions(petType: string) {
  if (petType === 'Cat') return { core: CORE_CAT_VACCINES, nonCore: NON_CORE_CAT_VACCINES };
  if (petType === 'Dog') return { core: CORE_DOG_VACCINES, nonCore: NON_CORE_DOG_VACCINES };
  return { core: [], nonCore: [] };
}

interface Pet {
  _id: string; name: string; petType: string; breed: string;
  vaccinations: any[]; microchips: any[]; medications: any[]; allergies: any[]; vetDetails: any[];
  surgeries: any[]; weightHistory: any[]; healthConditions: any[]; desexing: any;
  // Consumed only by the shared display helpers (petMainPhoto / petAgeLabel);
  // present on the real pets.detail payload.
  photos?: { url: string; isMain?: boolean }[]; mainPhoto?: string; photoUrl?: string;
  age?: number | null; dateOfBirth?: string | null;
}

const TABS = [
  { key: 'vaccinations', label: 'Vaccinations', icon: Syringe },
  { key: 'microchips', label: 'Microchips', icon: Cpu },
  { key: 'medications', label: 'Medications', icon: Pill },
  { key: 'allergies', label: 'Allergies', icon: AlertTriangle },
  { key: 'vetDetails', label: 'Vet Details', icon: Stethoscope },
  { key: 'surgeries', label: 'Surgeries', icon: Scissors },
  { key: 'weightHistory', label: 'Weight', icon: Weight },
  { key: 'healthConditions', label: 'Conditions', icon: Heart },
  { key: 'desexing', label: 'Desexing', icon: Activity },
];

/** Section → API segment, one source (was duplicated in three handlers). */
function sectionApiName(section: string): string {
  return section === 'vetDetails' ? 'vet-details' : section === 'healthConditions' ? 'health-conditions' : section === 'weightHistory' ? 'weight-history' : section;
}

/** Primary display field per category — used for accessible edit/delete names. */
const PRIMARY_FIELD: Record<string, string> = {
  vaccinations: 'vaccine', microchips: 'chipNumber', medications: 'name', allergies: 'allergen',
  vetDetails: 'clinicName', surgeries: 'procedure', weightHistory: 'weight', healthConditions: 'condition',
};

function recordName(category: string, item: any): string {
  const value = item?.[PRIMARY_FIELD[category] || ''];
  return value === undefined || value === null || value === '' ? 'record' : String(value);
}

/**
 * Pet Health Records — now a durable ACCOUNT PAGE at /account/pets/:id/health
 * (implementation-package Phase 2; the owner rejected the old modal design).
 * Renders inside AccountLayout; the category selector replaces the old
 * horizontally-scrolling tab strip. Data layer is unchanged: same pet payload
 * seed, same per-section fetch/save/delete endpoints, same entitlement gate
 * PetDetail uses — presentation only.
 */
export default function HealthRecords() {
  const { id: petId } = useParams<{ id: string }>();
  const [pet, setPet] = useState<Pet | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [canAccess, setCanAccess] = useState(false);
  const [tab, setTab] = useState('vaccinations');
  const [data, setData] = useState<Record<string, any[]>>({});
  const [desexing, setDesexing] = useState<any>({ isDesexed: false });
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Pet payload seeds all nine sections — same endpoint PetDetail calls.
  useEffect(() => {
    if (!petId) return;
    setLoading(true);
    api.get(API.customer.pets.detail(petId))
      .then((r) => {
        const loaded = r.data.data as Pet;
        setPet(loaded);
        setData({
          vaccinations: loaded.vaccinations || [], microchips: loaded.microchips || [], medications: loaded.medications || [],
          allergies: loaded.allergies || [], vetDetails: loaded.vetDetails || [], surgeries: loaded.surgeries || [],
          weightHistory: loaded.weightHistory || [], healthConditions: loaded.healthConditions || [],
        });
        setDesexing(loaded.desexing || { isDesexed: false });
      })
      .catch((err: any) => setLoadError(err.response?.data?.error || 'Failed to load this pet.'))
      .finally(() => setLoading(false));
  }, [petId]);

  // Same entitlement gate as PetDetail (pet_health_records); failure = locked,
  // mirroring the detail page's behavior exactly.
  useEffect(() => {
    api.get(API.customer.membership.entitlements)
      .then((r) => setCanAccess(r.data?.data?.entitlements?.pet_health_records?.enabled === true && r.data?.data?.entitlements?.pet_health_records?.value === true))
      .catch(() => setCanAccess(false));
  }, []);

  const fetchData = async (section: string) => {
    if (!petId) return;
    try {
      const res = await api.get(API.customer.pets.section(petId, sectionApiName(section)));
      if (section === 'desexing') setDesexing(res.data.data);
      else setData((prev) => ({ ...prev, [section]: res.data.data }));
    } catch {}
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!petId) return;
    setSaving(true); setSaveError('');
    try {
      const isDesexing = tab === 'desexing';
      const apiSection = sectionApiName(tab);
      if (editing?._id) {
        if (isDesexing) await api.put(API.customer.pets.desexing(petId), editing);
        else await api.put(API.customer.pets.sectionItem(petId, apiSection, editing._id), editing);
      } else {
        if (isDesexing) await api.put(API.customer.pets.desexing(petId), editing);
        else await api.post(API.customer.pets.section(petId, apiSection), editing);
      }
      await fetchData(isDesexing ? 'desexing' : tab);
      setShowForm(false); setEditing(null); toast.success('Record saved successfully');
    } catch (err: any) { setSaveError(err.response?.data?.error || 'Failed to save record'); }
    setSaving(false);
  };

  const handleDelete = async (section: string, id: string) => {
    if (!petId) return;
    if (!confirm('Delete this record?')) return;
    try {
      await api.delete(API.customer.pets.sectionItem(petId, sectionApiName(section), id));
      await fetchData(section);
    } catch (err: any) { setSaveError(err.response?.data?.error || 'Failed to delete record'); }
  };

  const selectCategory = (key: string) => {
    setTab(key); setShowForm(false); setEditing(null);
  };

  const severityColor = (s: string) => s === 'severe' || s === 'chronic' ? 'bg-red-100 text-red-700' : s === 'moderate' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700';

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in" aria-busy="true">
        <div className="h-4 w-40 bg-gray-200 rounded animate-shimmer" />
        <div className="h-24 bg-gray-200 rounded-2xl animate-shimmer" />
        <div className="h-12 bg-gray-200 rounded-2xl animate-shimmer" />
        <div className="h-64 bg-gray-200 rounded-2xl animate-shimmer" />
        <span className="sr-only">Loading health records…</span>
      </div>
    );
  }

  if (loadError || !pet) {
    return (
      <div className="space-y-4">
        <InfoCard tone="danger" icon={<ShieldAlert size={18} />} title={loadError || 'Pet not found'}>
          It may have been removed.
        </InfoCard>
        <Link to="/account/pets" className={buttonClassName({ variant: 'secondary' })}>
          <ArrowLeft size={16} /> Back to My Pets
        </Link>
      </div>
    );
  }

  // Entitlement gate — same pet_health_records check as PetDetail; direct
  // URLs without the benefit show the same membership lock, never data.
  if (!canAccess) {
    return (
      <div className="space-y-4">
        <Link
          to={`/account/pets/${pet._id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Back to {pet.name}
        </Link>
        <InfoCard
          tone="primary"
          icon={<Stethoscope size={16} />}
          title="Health records are a membership benefit ✦"
          trailing={<Link to="/membership" className={buttonClassName({ variant: 'secondary' })}>View plans</Link>}
        >
          Vaccinations, allergies, conditions and vet history unlock with PawTag Health.
        </InfoCard>
      </div>
    );
  }

  const photo = petMainPhoto(pet);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Visible return path (plan §5.4) — browser back works too */}
      <Link
        to={`/account/pets/${pet._id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700"
      >
        <ArrowLeft size={16} aria-hidden="true" /> Back to {pet.name}
      </Link>

      {/* Pet identity retained from the modal header */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
        {photo ? (
          <img src={photo} alt="" className="w-14 h-14 shrink-0 rounded-2xl object-cover" />
        ) : (
          <span aria-hidden="true" className="w-14 h-14 shrink-0 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center">
            <PawPrint size={26} />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">
            {pet.name}
            <span className="sr-only"> health records</span>
          </h1>
          <p className="text-sm text-gray-500 truncate">
            {[pet.petType, pet.breed, petAgeLabel(pet)].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      {/* Category selector — a wrapped grid on every width; no horizontal
          swiping through an ambiguous strip (plan §5.4). Selected state is
          exposed via aria-current, matching the Profile tabs pattern. */}
      <nav aria-label="Health record categories" className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => selectCategory(key)}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-medium transition-colors ${
                active
                  ? 'bg-primary-50 border-primary-200 text-primary-700'
                  : 'bg-white border-gray-100 text-gray-500 hover:text-gray-700 hover:border-gray-200'
              }`}
            >
              <Icon size={18} aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Records workspace — inline add/edit (the modal is gone) */}
      <section aria-labelledby="health-section-heading" className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6">
        {saveError && (
          <div role="alert" className="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-4">{saveError}</div>
        )}
        {tab === 'desexing' && showForm ? (
          <DesexingForm
            value={editing}
            onChange={setEditing}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditing(null); }}
            saving={saving}
            title={desexing.isDesexed ? 'Edit desexing' : 'Record desexing'}
          />
        ) : tab === 'desexing' ? (
          <DesexingSection desexing={desexing} onEdit={() => { setEditing({ ...desexing, isDesexed: true }); setShowForm(true); }} />
        ) : showForm ? (
          <FormSection tab={tab} petType={pet.petType} editing={editing} onChange={setEditing} onSave={handleSave} onCancel={() => { setShowForm(false); setEditing(null); }} saving={saving} />
        ) : (
          <ListSection tab={tab} items={data[tab] || []} petType={pet.petType} onAdd={() => { setEditing(getDefaults(tab)); setShowForm(true); }} onEdit={(item: any) => { setEditing(item); setShowForm(true); }} onDelete={(id: string) => handleDelete(tab, id)} severityColor={severityColor} />
        )}
      </section>
    </div>
  );
}

function getDefaults(tab: string) {
  const d: Record<string, any> = {
    vaccinations: { vaccine: '', vaccineType: 'core', dateGiven: new Date().toISOString().split('T')[0], nextDueDate: '', vetClinic: '', batchLotNumber: '', veterinarian: '', notes: '' },
    microchips: { chipNumber: '', brand: '', implantDate: '', implantLocation: '', implantedBy: '', notes: '' },
    medications: { name: '', dosage: '', frequency: '', startDate: '', endDate: '', prescribedBy: '', reason: '', notes: '' },
    allergies: { allergen: '', severity: 'mild', reaction: '', diagnosedBy: '', notes: '' },
    vetDetails: { clinicName: '', address: '', phone: '', email: '', veterinarian: '', isPrimary: false, notes: '' },
    surgeries: { procedure: '', date: new Date().toISOString().split('T')[0], performedBy: '', clinic: '', reason: '', recoveryNotes: '', notes: '' },
    weightHistory: { weight: 0, date: new Date().toISOString().split('T')[0], notes: '' },
    healthConditions: { condition: '', severity: 'mild', diagnosedDate: '', diagnosedBy: '', treatment: '', notes: '' },
  };
  return d[tab] || {};
}

function ListSection({ tab, items, petType, onAdd, onEdit, onDelete, severityColor }: any) {
  const vaccineOptions = getVaccineOptions(petType);
  return (
    <div>
      <div className="flex justify-between items-center gap-3 mb-4">
        <div className="min-w-0">
          <h3 id="health-section-heading" className="text-lg font-bold text-gray-900 capitalize">{tab.replace(/([A-Z])/g, ' $1')}</h3>
          {items.length > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">{items.length} {items.length === 1 ? 'record' : 'records'}</p>
          )}
        </div>
        <Button size="md" icon={<Plus size={16} />} onClick={onAdd}>Add record</Button>
      </div>
      {items.length === 0 ? <p className="text-gray-500 text-sm py-8 text-center">No records yet. Add one above.</p> : (
        <div className="space-y-3">
          {items.map((item: any, i: number) => (
            <div key={item._id || i} className="border border-gray-100 rounded-xl p-4">
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  {tab === 'vaccinations' && <div><p className="font-medium">{item.vaccine} <span className={`text-xs px-2 py-0.5 rounded-full ml-1 ${item.vaccineType === 'core' ? 'bg-blue-100 text-blue-700' : item.vaccineType === 'non-core' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>{item.vaccineType}</span></p><p className="text-sm text-gray-600">Given: {formatDate(item.dateGiven)}{item.nextDueDate ? ` · Next due: ${formatDate(item.nextDueDate)}` : ''}</p>{item.vetClinic && <p className="text-sm text-gray-500">Clinic: {item.vetClinic}</p>}{item.veterinarian && <p className="text-sm text-gray-500">Vet: {item.veterinarian}</p>}{item.batchLotNumber && <p className="text-sm text-gray-500">Batch: {item.batchLotNumber}</p>}{item.notes && <p className="text-sm text-gray-500 italic mt-1">{item.notes}</p>}</div>}
                  {tab === 'microchips' && <div><p className="font-medium">{item.chipNumber} {item.brand && <span className="text-sm text-gray-500">({item.brand})</span>}</p>{item.implantDate && <p className="text-sm text-gray-600">Implanted: {formatDate(item.implantDate)}</p>}{item.implantLocation && <p className="text-sm text-gray-500">Location: {item.implantLocation}</p>}{item.implantedBy && <p className="text-sm text-gray-500">By: {item.implantedBy}</p>}</div>}
                  {tab === 'medications' && <div><p className="font-medium">{item.name} {item.dosage && <span className="text-sm text-gray-500">— {item.dosage}</span>}</p>{item.frequency && <p className="text-sm text-gray-600">Frequency: {item.frequency}</p>}{item.startDate && <p className="text-sm text-gray-500">{formatDate(item.startDate)}{item.endDate ? ` — ${formatDate(item.endDate)}` : ' — ongoing'}</p>}{item.reason && <p className="text-sm text-gray-500">Reason: {item.reason}</p>}</div>}
                  {tab === 'allergies' && <div><p className="font-medium">{item.allergen} <span className={`text-xs px-2 py-0.5 rounded-full ml-1 ${severityColor(item.severity)}`}>{item.severity}</span></p>{item.reaction && <p className="text-sm text-gray-600">Reaction: {item.reaction}</p>}{item.diagnosedBy && <p className="text-sm text-gray-500">Diagnosed by: {item.diagnosedBy}</p>}</div>}
                  {tab === 'vetDetails' && <div><p className="font-medium">{item.clinicName} {item.isPrimary && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full ml-1">Primary</span>}</p>{item.veterinarian && <p className="text-sm text-gray-600">Vet: {item.veterinarian}</p>}{item.phone && <p className="text-sm text-gray-500">Phone: {item.phone}</p>}{item.email && <p className="text-sm text-gray-500">Email: {item.email}</p>}{item.address && <p className="text-sm text-gray-500">Address: {item.address}</p>}</div>}
                  {tab === 'surgeries' && <div><p className="font-medium">{item.procedure}</p><p className="text-sm text-gray-600">{formatDate(item.date)}</p>{item.performedBy && <p className="text-sm text-gray-500">By: {item.performedBy}</p>}{item.clinic && <p className="text-sm text-gray-500">Clinic: {item.clinic}</p>}{item.reason && <p className="text-sm text-gray-500">Reason: {item.reason}</p>}{item.recoveryNotes && <p className="text-sm text-gray-500 italic mt-1">Recovery: {item.recoveryNotes}</p>}</div>}
                  {tab === 'weightHistory' && <div><p className="font-medium">{item.weight} kg <span className="text-sm text-gray-500">— {formatDate(item.date)}</span></p>{item.notes && <p className="text-sm text-gray-500 italic">{item.notes}</p>}</div>}
                  {tab === 'healthConditions' && <div><p className="font-medium">{item.condition} <span className={`text-xs px-2 py-0.5 rounded-full ml-1 ${severityColor(item.severity)}`}>{item.severity}</span></p>{item.diagnosedDate && <p className="text-sm text-gray-600">Diagnosed: {formatDate(item.diagnosedDate)}</p>}{item.diagnosedBy && <p className="text-sm text-gray-500">By: {item.diagnosedBy}</p>}{item.treatment && <p className="text-sm text-gray-500">Treatment: {item.treatment}</p>}</div>}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button type="button" aria-label={`Edit ${recordName(tab, item)}`} onClick={() => onEdit(item)} className="w-11 h-11 flex items-center justify-center rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"><Edit2 size={16} /></button>
                  <button type="button" aria-label={`Delete ${recordName(tab, item)}`} onClick={() => onDelete(item._id)} className="w-11 h-11 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={16} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FormSection({ tab, petType, editing, onChange, onSave, onCancel, saving }: any) {
  const vaccineOptions = getVaccineOptions(petType);
  const set = (field: string, value: any) => onChange({ ...editing, [field]: value });
  return (
    <form onSubmit={onSave} className="space-y-4">
      <h3 id="health-section-heading" className="text-lg font-bold text-gray-900">{editing?._id ? 'Edit' : 'Add'} {tab.replace(/([A-Z])/g, ' $1')}</h3>
      {tab === 'vaccinations' && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div className="sm:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-vaccine">Vaccine *</label><input id="hr-vaccine" list={`vaccine-list-${tab}`} value={editing.vaccine} onChange={(e) => set('vaccine', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" required /><datalist id={`vaccine-list-${tab}`}>{[...vaccineOptions.core, ...vaccineOptions.nonCore].map((v) => <option key={v} value={v} />)}</datalist></div><div><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-vaccine-type">Vaccine Type *</label><select id="hr-vaccine-type" value={editing.vaccineType} onChange={(e) => set('vaccineType', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"><option value="core">Core</option><option value="non-core">Non-Core / Lifestyle</option><option value="other">Other</option></select></div><div><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-date-given">Date Given *</label><input id="hr-date-given" type="date" value={editing.dateGiven} onChange={(e) => set('dateGiven', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" required /></div><div><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-next-due-date">Next Due Date</label><input id="hr-next-due-date" type="date" value={editing.nextDueDate || ''} onChange={(e) => set('nextDueDate', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" /></div><div><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-vet-clinic">Vet Clinic</label><input id="hr-vet-clinic" value={editing.vetClinic || ''} onChange={(e) => set('vetClinic', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" /></div><div><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-batch-lot-number">Batch/Lot Number</label><input id="hr-batch-lot-number" value={editing.batchLotNumber || ''} onChange={(e) => set('batchLotNumber', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" /></div><div><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-veterinarian">Veterinarian</label><input id="hr-veterinarian" value={editing.veterinarian || ''} onChange={(e) => set('veterinarian', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" /></div><div className="sm:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-notes">Notes</label><textarea id="hr-notes" value={editing.notes || ''} onChange={(e) => set('notes', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" rows={2} /></div></div>}
      {tab === 'microchips' && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-chip-number">Chip Number *</label><input id="hr-chip-number" value={editing.chipNumber} onChange={(e) => set('chipNumber', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" required /></div><div><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-brand">Brand</label><input id="hr-brand" value={editing.brand || ''} onChange={(e) => set('brand', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" /></div><div><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-implant-date">Implant Date</label><input id="hr-implant-date" type="date" value={editing.implantDate || ''} onChange={(e) => set('implantDate', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" /></div><div><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-implant-location">Implant Location</label><input id="hr-implant-location" value={editing.implantLocation || ''} onChange={(e) => set('implantLocation', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="e.g. Between shoulder blades" /></div><div><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-implanted-by">Implanted By</label><input id="hr-implanted-by" value={editing.implantedBy || ''} onChange={(e) => set('implantedBy', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" /></div><div className="sm:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-notes">Notes</label><textarea id="hr-notes" value={editing.notes || ''} onChange={(e) => set('notes', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" rows={2} /></div></div>}
      {tab === 'medications' && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-name">Name *</label><input id="hr-name" value={editing.name} onChange={(e) => set('name', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" required /></div><div><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-dosage">Dosage</label><input id="hr-dosage" value={editing.dosage || ''} onChange={(e) => set('dosage', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="e.g. 250mg" /></div><div><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-frequency">Frequency</label><input id="hr-frequency" value={editing.frequency || ''} onChange={(e) => set('frequency', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="e.g. Twice daily" /></div><div><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-reason">Reason</label><input id="hr-reason" value={editing.reason || ''} onChange={(e) => set('reason', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" /></div><div><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-start-date">Start Date</label><input id="hr-start-date" type="date" value={editing.startDate || ''} onChange={(e) => set('startDate', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" /></div><div><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-end-date">End Date</label><input id="hr-end-date" type="date" value={editing.endDate || ''} onChange={(e) => set('endDate', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" /><p className="text-xs text-gray-400 mt-1">Leave blank if ongoing</p></div><div><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-prescribed-by">Prescribed By</label><input id="hr-prescribed-by" value={editing.prescribedBy || ''} onChange={(e) => set('prescribedBy', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" /></div><div className="sm:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-notes">Notes</label><textarea id="hr-notes" value={editing.notes || ''} onChange={(e) => set('notes', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" rows={2} /></div></div>}
      {tab === 'allergies' && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-allergen">Allergen *</label><input id="hr-allergen" value={editing.allergen} onChange={(e) => set('allergen', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" required /></div><div><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-severity">Severity *</label><select id="hr-severity" value={editing.severity} onChange={(e) => set('severity', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"><option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option></select></div><div><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-reaction">Reaction</label><input id="hr-reaction" value={editing.reaction || ''} onChange={(e) => set('reaction', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="e.g. Swelling, hives" /></div><div><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-diagnosed-by">Diagnosed By</label><input id="hr-diagnosed-by" value={editing.diagnosedBy || ''} onChange={(e) => set('diagnosedBy', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" /></div><div className="sm:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-notes">Notes</label><textarea id="hr-notes" value={editing.notes || ''} onChange={(e) => set('notes', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" rows={2} /></div></div>}
      {tab === 'vetDetails' && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-clinic-name">Clinic Name *</label><input id="hr-clinic-name" value={editing.clinicName} onChange={(e) => set('clinicName', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" required /></div><div><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-veterinarian">Veterinarian</label><input id="hr-veterinarian" value={editing.veterinarian || ''} onChange={(e) => set('veterinarian', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" /></div><div><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-phone">Phone</label><input id="hr-phone" value={editing.phone || ''} onChange={(e) => set('phone', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" /></div><div><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-email">Email</label><input id="hr-email" type="email" value={editing.email || ''} onChange={(e) => set('email', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" /></div><div className="sm:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-address">Address</label><input id="hr-address" value={editing.address || ''} onChange={(e) => set('address', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" /></div><div className="sm:col-span-2 flex items-center gap-2"><input type="checkbox" checked={editing.isPrimary} onChange={(e) => set('isPrimary', e.target.checked)} id="isPrimary" className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500" /><label htmlFor="isPrimary" className="text-sm text-gray-600">Primary vet</label></div><div className="sm:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-notes">Notes</label><textarea id="hr-notes" value={editing.notes || ''} onChange={(e) => set('notes', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" rows={2} /></div></div>}
      {tab === 'surgeries' && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div className="sm:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-procedure">Procedure *</label><input id="hr-procedure" value={editing.procedure} onChange={(e) => set('procedure', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" required /></div><div><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-date">Date *</label><input id="hr-date" type="date" value={editing.date} onChange={(e) => set('date', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" required /></div><div><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-performed-by">Performed By</label><input id="hr-performed-by" value={editing.performedBy || ''} onChange={(e) => set('performedBy', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" /></div><div><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-clinic">Clinic</label><input id="hr-clinic" value={editing.clinic || ''} onChange={(e) => set('clinic', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" /></div><div><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-reason">Reason</label><input id="hr-reason" value={editing.reason || ''} onChange={(e) => set('reason', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" /></div><div className="sm:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-recovery-notes">Recovery Notes</label><textarea id="hr-recovery-notes" value={editing.recoveryNotes || ''} onChange={(e) => set('recoveryNotes', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" rows={2} /></div></div>}
      {tab === 'weightHistory' && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-weight-kg">Weight (kg) *</label><input id="hr-weight-kg" type="number" step="0.1" min="0" value={editing.weight} onChange={(e) => set('weight', parseFloat(e.target.value) || 0)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" required /></div><div><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-date">Date *</label><input id="hr-date" type="date" value={editing.date} onChange={(e) => set('date', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" required /></div><div className="sm:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-notes">Notes</label><input id="hr-notes" value={editing.notes || ''} onChange={(e) => set('notes', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" /></div></div>}
      {tab === 'healthConditions' && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div className="sm:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-condition">Condition *</label><input id="hr-condition" value={editing.condition} onChange={(e) => set('condition', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" required /></div><div><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-severity">Severity *</label><select id="hr-severity" value={editing.severity} onChange={(e) => set('severity', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"><option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option><option value="chronic">Chronic</option></select></div><div><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-diagnosed-date">Diagnosed Date</label><input id="hr-diagnosed-date" type="date" value={editing.diagnosedDate || ''} onChange={(e) => set('diagnosedDate', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" /></div><div><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-diagnosed-by">Diagnosed By</label><input id="hr-diagnosed-by" value={editing.diagnosedBy || ''} onChange={(e) => set('diagnosedBy', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" /></div><div><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-treatment">Treatment</label><input id="hr-treatment" value={editing.treatment || ''} onChange={(e) => set('treatment', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" /></div><div className="sm:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hr-notes">Notes</label><textarea id="hr-notes" value={editing.notes || ''} onChange={(e) => set('notes', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" rows={2} /></div></div>}
      {/* Save/Cancel live inline at the end of the form — reachable while the
          software keyboard is open (no fixed bar to fall behind it) */}
      <div className="flex flex-col gap-2 pt-2">
        <Button type="submit" size="lg" full disabled={saving}>
          {saving ? 'Saving…' : 'Save record'}
        </Button>
        <button type="button" onClick={onCancel} disabled={saving} className="w-full py-3 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50">
          Cancel
        </button>
      </div>
    </form>
  );
}

function DesexingSection({ desexing, onEdit }: any) {
  if (!desexing.isDesexed) {
    return (
      <div className="text-center py-8">
        <Activity size={40} className="mx-auto text-gray-300 mb-3" aria-hidden="true" />
        <p className="text-gray-500 mb-4">Not desexed yet</p>
        <Button icon={<Edit2 size={16} />} onClick={onEdit}>Record Desexing</Button>
      </div>
    );
  }
  return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Activity size={18} className="text-green-600" aria-hidden="true" />
            <h3 id="health-section-heading" className="font-semibold text-green-800">Desexed</h3>
          </div>
          <div className="space-y-1 text-sm text-green-700">{desexing.date && <p>Date: {formatDate(desexing.date)}</p>}{desexing.performedBy && <p>Performed by: {desexing.performedBy}</p>}{desexing.clinic && <p>Clinic: {desexing.clinic}</p>}{desexing.notes && <p className="italic">Notes: {desexing.notes}</p>}</div>
        </div>
        <Button variant="secondary" size="md" onClick={onEdit}>Edit</Button>
      </div>
    </div>
  );
}

/**
 * Desexing add/edit form. This RESTORES intended behavior: the old modal set
 * `editing`/`showForm` from DesexingSection's Edit button, but the
 * `tab === 'desexing'` render branch always won, so no form ever appeared
 * (and no desexing form existed in FormSection). Fields mirror exactly the
 * record shape the existing PUT /pets/:id/desexing endpoint accepts — no
 * endpoint, payload or validation-contract change.
 */
function DesexingForm({ value, onChange, onSave, onCancel, saving, title }: {
  value: any;
  onChange: (v: any) => void;
  onSave: (e: FormEvent) => void;
  onCancel: () => void;
  saving: boolean;
  title: string;
}) {
  const set = (field: string, v: any) => onChange({ ...value, [field]: v });
  return (
    <form onSubmit={onSave} className="space-y-4">
      <h3 id="health-section-heading" className="text-lg font-bold text-gray-900">{title}</h3>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="desexedToggle"
          checked={value?.isDesexed === true}
          onChange={(e) => set('isDesexed', e.target.checked)}
          className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
        />
        <label htmlFor="desexedToggle" className="text-sm font-medium text-gray-700">Desexed</label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="desexing-date" className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input id="desexing-date" type="date" value={value?.date || ''} onChange={(e) => set('date', e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
        </div>
        <div>
          <label htmlFor="desexing-performedBy" className="block text-sm font-medium text-gray-700 mb-1">Performed by</label>
          <input id="desexing-performedBy" value={value?.performedBy || ''} onChange={(e) => set('performedBy', e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="desexing-clinic" className="block text-sm font-medium text-gray-700 mb-1">Clinic</label>
          <input id="desexing-clinic" value={value?.clinic || ''} onChange={(e) => set('clinic', e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="desexing-notes" className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea id="desexing-notes" value={value?.notes || ''} onChange={(e) => set('notes', e.target.value)} rows={3}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
        </div>
      </div>
      <div className="flex flex-col gap-2 pt-2">
        <Button type="submit" size="lg" full disabled={saving}>
          {saving ? 'Saving…' : 'Save record'}
        </Button>
        <button type="button" onClick={onCancel} disabled={saving} className="w-full py-3 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50">
          Cancel
        </button>
      </div>
    </form>
  );
}

function formatDate(d: string) { if (!d) return ''; return new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }); }
