import { useState, useEffect, FormEvent } from 'react';
import api from '../lib/api';
import { X, Plus, Trash2, Syringe, Cpu, Pill, AlertTriangle, Stethoscope, Scissors, Weight, Heart, Activity } from 'lucide-react';

// --- NZ Vaccines ---
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
  _id: string;
  name: string;
  petType: string;
  breed: string;
  vaccinations: any[];
  microchips: any[];
  medications: any[];
  allergies: any[];
  vetDetails: any[];
  surgeries: any[];
  weightHistory: any[];
  healthConditions: any[];
  desexing: any;
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

export default function HealthRecords({ pet, onClose }: { pet: Pet; onClose: () => void }) {
  const [tab, setTab] = useState('vaccinations');
  const [data, setData] = useState<Record<string, any[]>>({
    vaccinations: pet.vaccinations || [],
    microchips: pet.microchips || [],
    medications: pet.medications || [],
    allergies: pet.allergies || [],
    vetDetails: pet.vetDetails || [],
    surgeries: pet.surgeries || [],
    weightHistory: pet.weightHistory || [],
    healthConditions: pet.healthConditions || [],
  });
  const [desexing, setDesexing] = useState(pet.desexing || { isDesexed: false });
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchData = async (section: string) => {
    try {
      const res = await api.get(`/customer/pets/${pet._id}/${section === 'vetDetails' ? 'vet-details' : section === 'healthConditions' ? 'health-conditions' : section === 'weightHistory' ? 'weight-history' : section}`);
      if (section === 'desexing') { setDesexing(res.data.data); }
      else { setData((prev) => ({ ...prev, [section]: res.data.data })); }
    } catch {}
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const section = tab;
      const isDesexing = section === 'desexing';
      const apiSection = section === 'vetDetails' ? 'vet-details' : section === 'healthConditions' ? 'health-conditions' : section === 'weightHistory' ? 'weight-history' : section;
      if (editing?._id) {
        if (isDesexing) {
          await api.put(`/customer/pets/${pet._id}/${apiSection}`, editing);
        } else {
          await api.put(`/customer/pets/${pet._id}/${apiSection}/${editing._id}`, editing);
        }
      } else {
        if (isDesexing) {
          await api.put(`/customer/pets/${pet._id}/${apiSection}`, editing);
        } else {
          await api.post(`/customer/pets/${pet._id}/${apiSection}`, editing);
        }
      }
      await fetchData(isDesexing ? 'desexing' : section);
      setShowForm(false); setEditing(null);
    } catch {}
    setSaving(false);
  };

  const handleDelete = async (section: string, id: string) => {
    if (!confirm('Delete this record?')) return;
    const apiSection = section === 'vetDetails' ? 'vet-details' : section === 'healthConditions' ? 'health-conditions' : section === 'weightHistory' ? 'weight-history' : section;
    await api.delete(`/customer/pets/${pet._id}/${apiSection}/${id}`);
    await fetchData(section);
  };

  const severityColor = (s: string) => s === 'severe' || s === 'chronic' ? 'bg-red-100 text-red-700' : s === 'moderate' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-xl font-bold">{pet.name} — Health Records</h2>
            <p className="text-sm text-gray-500">{pet.petType} · {pet.breed}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
        </div>
        <div className="flex border-b overflow-x-auto">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => { setTab(key); setShowForm(false); setEditing(null); }} className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition ${tab === key ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'desexing' ? (
            <DesexingSection desexing={desexing} onEdit={() => { setEditing({ ...desexing }); setShowForm(true); }} onSave={async (val: any) => { setSaving(true); await api.put(`/customer/pets/${pet._id}/desexing`, val); setDesexing(val); setSaving(false); }} saving={saving} />
          ) : showForm ? (
            <FormSection tab={tab} petType={pet.petType} editing={editing} onChange={setEditing} onSave={handleSave} onCancel={() => { setShowForm(false); setEditing(null); }} saving={saving} />
          ) : (
            <ListSection tab={tab} items={data[tab] || []} petType={pet.petType} onAdd={() => { setEditing(getDefaults(tab)); setShowForm(true); }} onEdit={(item: any) => { setEditing(item); setShowForm(true); }} onDelete={(id: string) => handleDelete(tab, id)} severityColor={severityColor} />
          )}
        </div>
      </div>
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
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold capitalize">{tab.replace(/([A-Z])/g, ' $1')}</h3>
        <button onClick={onAdd} className="bg-primary-600 text-white px-3 py-1.5 rounded-md text-sm flex items-center gap-1 hover:bg-primary-700"><Plus size={14} /> Add</button>
      </div>
      {items.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">No records yet. Add one above.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item: any, i: number) => (
            <div key={item._id || i} className="bg-gray-50 border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  {tab === 'vaccinations' && (
                    <div>
                      <p className="font-medium">{item.vaccine} <span className={`text-xs px-2 py-0.5 rounded-full ml-1 ${item.vaccineType === 'core' ? 'bg-blue-100 text-blue-700' : item.vaccineType === 'non-core' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>{item.vaccineType}</span></p>
                      <p className="text-sm text-gray-600">Given: {formatDate(item.dateGiven)}{item.nextDueDate ? ` · Next due: ${formatDate(item.nextDueDate)}` : ''}</p>
                      {item.vetClinic && <p className="text-sm text-gray-500">Clinic: {item.vetClinic}</p>}
                      {item.veterinarian && <p className="text-sm text-gray-500">Vet: {item.veterinarian}</p>}
                      {item.batchLotNumber && <p className="text-sm text-gray-500">Batch: {item.batchLotNumber}</p>}
                      {item.notes && <p className="text-sm text-gray-500 italic mt-1">{item.notes}</p>}
                    </div>
                  )}
                  {tab === 'microchips' && (
                    <div>
                      <p className="font-medium">{item.chipNumber} {item.brand && <span className="text-sm text-gray-500">({item.brand})</span>}</p>
                      {item.implantDate && <p className="text-sm text-gray-600">Implanted: {formatDate(item.implantDate)}</p>}
                      {item.implantLocation && <p className="text-sm text-gray-500">Location: {item.implantLocation}</p>}
                      {item.implantedBy && <p className="text-sm text-gray-500">By: {item.implantedBy}</p>}
                    </div>
                  )}
                  {tab === 'medications' && (
                    <div>
                      <p className="font-medium">{item.name} {item.dosage && <span className="text-sm text-gray-500">— {item.dosage}</span>}</p>
                      {item.frequency && <p className="text-sm text-gray-600">Frequency: {item.frequency}</p>}
                      {item.startDate && <p className="text-sm text-gray-500">{formatDate(item.startDate)}{item.endDate ? ` — ${formatDate(item.endDate)}` : ' — ongoing'}</p>}
                      {item.reason && <p className="text-sm text-gray-500">Reason: {item.reason}</p>}
                    </div>
                  )}
                  {tab === 'allergies' && (
                    <div>
                      <p className="font-medium">{item.allergen} <span className={`text-xs px-2 py-0.5 rounded-full ml-1 ${severityColor(item.severity)}`}>{item.severity}</span></p>
                      {item.reaction && <p className="text-sm text-gray-600">Reaction: {item.reaction}</p>}
                      {item.diagnosedBy && <p className="text-sm text-gray-500">Diagnosed by: {item.diagnosedBy}</p>}
                    </div>
                  )}
                  {tab === 'vetDetails' && (
                    <div>
                      <p className="font-medium">{item.clinicName} {item.isPrimary && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full ml-1">Primary</span>}</p>
                      {item.veterinarian && <p className="text-sm text-gray-600">Vet: {item.veterinarian}</p>}
                      {item.phone && <p className="text-sm text-gray-500">Phone: {item.phone}</p>}
                      {item.email && <p className="text-sm text-gray-500">Email: {item.email}</p>}
                      {item.address && <p className="text-sm text-gray-500">Address: {item.address}</p>}
                    </div>
                  )}
                  {tab === 'surgeries' && (
                    <div>
                      <p className="font-medium">{item.procedure}</p>
                      <p className="text-sm text-gray-600">{formatDate(item.date)}</p>
                      {item.performedBy && <p className="text-sm text-gray-500">By: {item.performedBy}</p>}
                      {item.clinic && <p className="text-sm text-gray-500">Clinic: {item.clinic}</p>}
                      {item.reason && <p className="text-sm text-gray-500">Reason: {item.reason}</p>}
                      {item.recoveryNotes && <p className="text-sm text-gray-500 italic mt-1">Recovery: {item.recoveryNotes}</p>}
                    </div>
                  )}
                  {tab === 'weightHistory' && (
                    <div>
                      <p className="font-medium">{item.weight} kg <span className="text-sm text-gray-500">— {formatDate(item.date)}</span></p>
                      {item.notes && <p className="text-sm text-gray-500 italic">{item.notes}</p>}
                    </div>
                  )}
                  {tab === 'healthConditions' && (
                    <div>
                      <p className="font-medium">{item.condition} <span className={`text-xs px-2 py-0.5 rounded-full ml-1 ${severityColor(item.severity)}`}>{item.severity}</span></p>
                      {item.diagnosedDate && <p className="text-sm text-gray-600">Diagnosed: {formatDate(item.diagnosedDate)}</p>}
                      {item.diagnosedBy && <p className="text-sm text-gray-500">By: {item.diagnosedBy}</p>}
                      {item.treatment && <p className="text-sm text-gray-500">Treatment: {item.treatment}</p>}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 ml-2">
                  <button onClick={() => onEdit(item)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-gray-100 rounded"><Edit2 size={14} /></button>
                  <button onClick={() => onDelete(item._id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
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
      <h3 className="text-lg font-semibold">{editing?._id ? 'Edit' : 'Add'} {tab.replace(/([A-Z])/g, ' $1')}</h3>
      {tab === 'vaccinations' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Vaccine *</label>
            <input list={`vaccine-list-${tab}`} value={editing.vaccine} onChange={(e) => set('vaccine', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" required />
            <datalist id={`vaccine-list-${tab}`}>
              {[...vaccineOptions.core, ...vaccineOptions.nonCore].map((v) => <option key={v} value={v} />)}
            </datalist>
          </div>
          <div><label className="block text-xs text-gray-500 mb-1">Vaccine Type *</label><select value={editing.vaccineType} onChange={(e) => set('vaccineType', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm"><option value="core">Core</option><option value="non-core">Non-Core / Lifestyle</option><option value="other">Other</option></select></div>
          <div><label className="block text-xs text-gray-500 mb-1">Date Given *</label><input type="date" value={editing.dateGiven} onChange={(e) => set('dateGiven', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" required /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Next Due Date</label><input type="date" value={editing.nextDueDate || ''} onChange={(e) => set('nextDueDate', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Vet Clinic</label><input value={editing.vetClinic || ''} onChange={(e) => set('vetClinic', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Batch/Lot Number</label><input value={editing.batchLotNumber || ''} onChange={(e) => set('batchLotNumber', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Veterinarian</label><input value={editing.veterinarian || ''} onChange={(e) => set('veterinarian', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
          <div className="col-span-2"><label className="block text-xs text-gray-500 mb-1">Notes</label><textarea value={editing.notes || ''} onChange={(e) => set('notes', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" rows={2} /></div>
        </div>
      )}
      {tab === 'microchips' && (
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-xs text-gray-500 mb-1">Chip Number *</label><input value={editing.chipNumber} onChange={(e) => set('chipNumber', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" required /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Brand</label><input value={editing.brand || ''} onChange={(e) => set('brand', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Implant Date</label><input type="date" value={editing.implantDate || ''} onChange={(e) => set('implantDate', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Implant Location</label><input value={editing.implantLocation || ''} onChange={(e) => set('implantLocation', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="e.g. Between shoulder blades" /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Implanted By</label><input value={editing.implantedBy || ''} onChange={(e) => set('implantedBy', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
          <div className="col-span-2"><label className="block text-xs text-gray-500 mb-1">Notes</label><textarea value={editing.notes || ''} onChange={(e) => set('notes', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" rows={2} /></div>
        </div>
      )}
      {tab === 'medications' && (
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-xs text-gray-500 mb-1">Name *</label><input value={editing.name} onChange={(e) => set('name', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" required /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Dosage</label><input value={editing.dosage || ''} onChange={(e) => set('dosage', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="e.g. 250mg" /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Frequency</label><input value={editing.frequency || ''} onChange={(e) => set('frequency', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="e.g. Twice daily" /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Reason</label><input value={editing.reason || ''} onChange={(e) => set('reason', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Start Date</label><input type="date" value={editing.startDate || ''} onChange={(e) => set('startDate', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs text-gray-500 mb-1">End Date</label><input type="date" value={editing.endDate || ''} onChange={(e) => set('endDate', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" /><p className="text-xs text-gray-400 mt-1">Leave blank if ongoing</p></div>
          <div><label className="block text-xs text-gray-500 mb-1">Prescribed By</label><input value={editing.prescribedBy || ''} onChange={(e) => set('prescribedBy', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
          <div className="col-span-2"><label className="block text-xs text-gray-500 mb-1">Notes</label><textarea value={editing.notes || ''} onChange={(e) => set('notes', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" rows={2} /></div>
        </div>
      )}
      {tab === 'allergies' && (
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-xs text-gray-500 mb-1">Allergen *</label><input value={editing.allergen} onChange={(e) => set('allergen', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" required /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Severity *</label><select value={editing.severity} onChange={(e) => set('severity', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm"><option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option></select></div>
          <div><label className="block text-xs text-gray-500 mb-1">Reaction</label><input value={editing.reaction || ''} onChange={(e) => set('reaction', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="e.g. Swelling, hives" /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Diagnosed By</label><input value={editing.diagnosedBy || ''} onChange={(e) => set('diagnosedBy', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
          <div className="col-span-2"><label className="block text-xs text-gray-500 mb-1">Notes</label><textarea value={editing.notes || ''} onChange={(e) => set('notes', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" rows={2} /></div>
        </div>
      )}
      {tab === 'vetDetails' && (
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-xs text-gray-500 mb-1">Clinic Name *</label><input value={editing.clinicName} onChange={(e) => set('clinicName', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" required /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Veterinarian</label><input value={editing.veterinarian || ''} onChange={(e) => set('veterinarian', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Phone</label><input value={editing.phone || ''} onChange={(e) => set('phone', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Email</label><input type="email" value={editing.email || ''} onChange={(e) => set('email', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
          <div className="col-span-2"><label className="block text-xs text-gray-500 mb-1">Address</label><input value={editing.address || ''} onChange={(e) => set('address', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
          <div className="col-span-2 flex items-center gap-2"><input type="checkbox" checked={editing.isPrimary} onChange={(e) => set('isPrimary', e.target.checked)} id="isPrimary" className="rounded" /><label htmlFor="isPrimary" className="text-sm text-gray-600">Primary vet</label></div>
          <div className="col-span-2"><label className="block text-xs text-gray-500 mb-1">Notes</label><textarea value={editing.notes || ''} onChange={(e) => set('notes', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" rows={2} /></div>
        </div>
      )}
      {tab === 'surgeries' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className="block text-xs text-gray-500 mb-1">Procedure *</label><input value={editing.procedure} onChange={(e) => set('procedure', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" required /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Date *</label><input type="date" value={editing.date} onChange={(e) => set('date', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" required /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Performed By</label><input value={editing.performedBy || ''} onChange={(e) => set('performedBy', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Clinic</label><input value={editing.clinic || ''} onChange={(e) => set('clinic', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Reason</label><input value={editing.reason || ''} onChange={(e) => set('reason', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
          <div className="col-span-2"><label className="block text-xs text-gray-500 mb-1">Recovery Notes</label><textarea value={editing.recoveryNotes || ''} onChange={(e) => set('recoveryNotes', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" rows={2} /></div>
        </div>
      )}
      {tab === 'weightHistory' && (
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-xs text-gray-500 mb-1">Weight (kg) *</label><input type="number" step="0.1" min="0" value={editing.weight} onChange={(e) => set('weight', parseFloat(e.target.value) || 0)} className="w-full border rounded-md px-3 py-2 text-sm" required /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Date *</label><input type="date" value={editing.date} onChange={(e) => set('date', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" required /></div>
          <div className="col-span-2"><label className="block text-xs text-gray-500 mb-1">Notes</label><input value={editing.notes || ''} onChange={(e) => set('notes', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
        </div>
      )}
      {tab === 'healthConditions' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className="block text-xs text-gray-500 mb-1">Condition *</label><input value={editing.condition} onChange={(e) => set('condition', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" required /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Severity *</label><select value={editing.severity} onChange={(e) => set('severity', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm"><option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option><option value="chronic">Chronic</option></select></div>
          <div><label className="block text-xs text-gray-500 mb-1">Diagnosed Date</label><input type="date" value={editing.diagnosedDate || ''} onChange={(e) => set('diagnosedDate', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Diagnosed By</label><input value={editing.diagnosedBy || ''} onChange={(e) => set('diagnosedBy', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Treatment</label><input value={editing.treatment || ''} onChange={(e) => set('treatment', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
          <div className="col-span-2"><label className="block text-xs text-gray-500 mb-1">Notes</label><textarea value={editing.notes || ''} onChange={(e) => set('notes', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" rows={2} /></div>
        </div>
      )}
      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={saving} className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
        <button type="button" onClick={onCancel} className="border px-4 py-2 rounded-md text-sm">Cancel</button>
      </div>
    </form>
  );
}

function DesexingSection({ desexing, onEdit, onSave, saving }: any) {
  if (!desexing.isDesexed) {
    return (
      <div className="text-center py-8">
        <Activity size={40} className="mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500 mb-4">Not desexed yet</p>
        <button onClick={onEdit} className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700">Record Desexing</button>
      </div>
    );
  }
  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-3">
        <Activity size={20} className="text-green-600" />
        <h3 className="font-semibold text-green-800">Desexed</h3>
      </div>
      <div className="space-y-1 text-sm text-green-700">
        {desexing.date && <p>Date: {formatDate(desexing.date)}</p>}
        {desexing.performedBy && <p>Performed by: {desexing.performedBy}</p>}
        {desexing.clinic && <p>Clinic: {desexing.clinic}</p>}
        {desexing.notes && <p className="italic">Notes: {desexing.notes}</p>}
      </div>
      <button onClick={onEdit} className="mt-3 text-sm text-green-700 underline">Edit</button>
    </div>
  );
}

function formatDate(d: string) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

import { Edit2 } from 'lucide-react';
