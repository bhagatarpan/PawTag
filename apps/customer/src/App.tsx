import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { useState, useEffect, FormEvent, createContext, useContext, ReactNode } from 'react';
import api from './lib/api';
import { PawPrint, LogOut, Bell, Plus, AlertTriangle, CheckCircle } from 'lucide-react';

// --- Auth Context ---
const AuthCtx = createContext<{ user: any; login: (e: string, p: string) => Promise<void>; logout: () => void } | null>(null);

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const nav = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('customer_token');
    if (token) {
      api.get('/auth/me').then((r) => setUser(r.data.data)).catch(() => localStorage.removeItem('customer_token'));
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('customer_token', res.data.data.token);
    setUser(res.data.data.user);
    nav('/');
  };

  const logout = () => { localStorage.removeItem('customer_token'); setUser(null); nav('/login'); };

  return <AuthCtx.Provider value={{ user, login, logout }}>{children}</AuthCtx.Provider>;
}

function useAuth() { return useContext(AuthCtx)!; }

// --- Login ---
function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
        <div className="text-center mb-6">
          <PawPrint size={32} className="text-primary-600 mx-auto mb-2" />
          <h1 className="text-xl font-bold">Customer Portal</h1>
        </div>
        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded mb-4">{error}</div>}
        <form onSubmit={async (e: FormEvent) => { e.preventDefault(); setError(''); try { await login(email, password); } catch (err: any) { setError(err.response?.data?.error || 'Login failed'); } }} className="space-y-4">
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" required />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" required />
          <button type="submit" className="w-full bg-primary-600 text-white py-2 rounded-md text-sm font-medium hover:bg-primary-700">Sign In</button>
        </form>
      </div>
    </div>
  );
}

// --- Dashboard ---
function Dashboard() {
  const { user, logout } = useAuth();
  const [pets, setPets] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', species: 'Dog', breed: '', color: '', medicalAlerts: '' });

  useEffect(() => { api.get('/customer/pets').then((r) => setPets(r.data.data)).catch(console.error); }, []);

  const addPet = async (e: FormEvent) => {
    e.preventDefault();
    await api.post('/customer/pets', form);
    setShowForm(false);
    setForm({ name: '', species: 'Dog', breed: '', color: '', medicalAlerts: '' });
    api.get('/customer/pets').then((r) => setPets(r.data.data));
  };

  const markLost = async (id: string) => { await api.post(`/customer/pets/${id}/mark-lost`); api.get('/customer/pets').then((r) => setPets(r.data.data)); };
  const markFound = async (id: string) => { await api.post(`/customer/pets/${id}/mark-found`); api.get('/customer/pets').then((r) => setPets(r.data.data)); };
  const deletePet = async (id: string) => { if (confirm('Delete this pet?')) { await api.delete(`/customer/pets/${id}`); api.get('/customer/pets').then((r) => setPets(r.data.data)); } };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2"><PawPrint size={24} className="text-primary-600" /><span className="font-bold">My PawTag</span></div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{user?.fullName}</span>
          <button onClick={logout} className="text-gray-500 hover:text-red-600"><LogOut size={18} /></button>
        </div>
      </header>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">My Pets</h1>
          <button onClick={() => setShowForm(!showForm)} className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm flex items-center gap-2 hover:bg-primary-700">
            <Plus size={16} /> Add Pet
          </button>
        </div>

        {showForm && (
          <form onSubmit={addPet} className="bg-white rounded-lg border p-6 mb-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <input placeholder="Pet Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border rounded-md px-3 py-2 text-sm" required />
              <input placeholder="Breed" value={form.breed} onChange={(e) => setForm({ ...form, breed: e.target.value })} className="border rounded-md px-3 py-2 text-sm" required />
              <input placeholder="Color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="border rounded-md px-3 py-2 text-sm" required />
              <input placeholder="Medical Alerts" value={form.medicalAlerts} onChange={(e) => setForm({ ...form, medicalAlerts: e.target.value })} className="border rounded-md px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700">Save</button>
              <button type="button" onClick={() => setShowForm(false)} className="border px-4 py-2 rounded-md text-sm">Cancel</button>
            </div>
          </form>
        )}

        {pets.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No pets yet. Add your first pet above.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pets.map((pet) => (
              <div key={pet._id} className="bg-white rounded-lg border p-5">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-semibold">{pet.name}</h3>
                    <p className="text-sm text-gray-600">{pet.species} - {pet.breed}</p>
                    <p className="text-sm text-gray-500">Color: {pet.color}</p>
                    {pet.medicalAlerts && <p className="text-sm text-red-600 mt-1 flex items-center gap-1"><AlertTriangle size={14} /> {pet.medicalAlerts}</p>}
                  </div>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${pet.status === 'safe' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {pet.status}
                  </span>
                </div>
                <div className="flex gap-2 pt-3 border-t">
                  {pet.status === 'safe' ? (
                    <button onClick={() => markLost(pet._id)} className="text-red-600 hover:text-red-800 text-sm font-medium">Mark as Lost</button>
                  ) : (
                    <button onClick={() => markFound(pet._id)} className="text-green-600 hover:text-green-800 text-sm font-medium flex items-center gap-1"><CheckCircle size={14} /> Mark as Found</button>
                  )}
                  <button onClick={() => deletePet(pet._id)} className="text-gray-400 hover:text-red-600 text-sm ml-auto">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- App ---
export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={<Protected><Dashboard /></Protected>} />
      </Routes>
    </AuthProvider>
  );
}

function Protected({ children }: { children: ReactNode }) {
  const token = localStorage.getItem('customer_token');
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
