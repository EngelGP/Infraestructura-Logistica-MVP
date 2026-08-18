'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Store, Bike, ArrowLeft } from 'lucide-react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';

// ============================================================
// MAPA DINÁMICO (solo cliente)
// ============================================================
const LocationPicker = dynamic(
  () => import('react-leaflet').then(({ MapContainer, TileLayer, Marker, useMapEvents }) => {
    function LocationPickerComponent({ position, setPosition }: any) {
      const L = require('leaflet');
      useMapEvents({
        click(e) {
          setPosition({ lat: e.latlng.lat, lng: e.latlng.lng });
        }
      });
      const icon = new L.DivIcon({
        className: 'bg-transparent',
        html: `<div style="background-color: #2563eb; width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 0 8px rgba(0,0,0,0.3);"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      return position ? <Marker position={[position.lat, position.lng]} icon={icon} /> : null;
    }
    return function LocationPickerWrapper({ position, setPosition }: any) {
      return (
        <MapContainer 
          center={[12.1364, -86.2514]} 
          zoom={13} 
          style={{ height: '200px', width: '100%' }} 
          className="rounded-md border border-slate-300"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationPickerComponent position={position} setPosition={setPosition} />
        </MapContainer>
      );
    };
  }),
  { 
    ssr: false, 
    loading: () => (
      <div className="h-48 w-full bg-slate-100 rounded-md flex items-center justify-center text-sm text-slate-400">
        Cargando mapa...
      </div>
    )
  }
);

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function AuthPage() {
  const router = useRouter();

  const [step, setStep] = useState<'landing' | 'auth'>('landing');
  const [selectedRole, setSelectedRole] = useState<'business' | 'motorist'>('business');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Campos comunes
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // Campos para negocio
  const [businessName, setBusinessName] = useState('');
  const [ruc, setRuc] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessLocation, setBusinessLocation] = useState<{ lat: number, lng: number } | null>(null);

  // Campos para motorizado
  const [license, setLicense] = useState('');
  const [plate, setPlate] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');

  // ============================================================
  // HANDLE LOGIN
  // ============================================================
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const user = authData.user;
    if (!user) {
      setError('No se pudo obtener el usuario');
      setLoading(false);
      return;
    }

    let { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      const isAdmin = email === 'enix2022guerrero@gmail.com' || email === 'admin@corrreo.com';
      const newRole = isAdmin ? 'admin' : 'business';
      const newStatus = isAdmin ? 'approved' : 'pending';

      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          name: user.user_metadata?.name || 'Usuario',
          phone: user.user_metadata?.phone || '00000000',
          role: newRole,
          status: newStatus,
          business_name: user.user_metadata?.business_name || null,
          ruc: user.user_metadata?.ruc || null,
          business_address: user.user_metadata?.business_address || null,
          business_lat: user.user_metadata?.business_lat || null,
          business_lng: user.user_metadata?.business_lng || null,
          license: user.user_metadata?.license || null,
          plate: user.user_metadata?.plate || null,
          vehicle_model: user.user_metadata?.vehicle_model || null,
          vehicle_year: user.user_metadata?.vehicle_year || null,
        })
        .select('role, status')
        .single();

      if (insertError) {
        setError('Error al crear el perfil. Contacta al administrador.');
        setLoading(false);
        return;
      }

      profile = newProfile;
    }

    if (profile.status !== 'approved') {
      setError('Tu cuenta está pendiente de aprobación.');
      setLoading(false);
      return;
    }

    const userRole = profile.role || 'business';
    if (userRole === 'admin') {
      router.push('/admin/dashboard');
    } else if (userRole === 'motorist') {
      router.push('/motorist/dashboard');
    } else {
      router.push('/dashboard');
    }

    setLoading(false);
  };

  // ============================================================
  // HANDLE REGISTER (con ubicación)
  // ============================================================
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validar que el negocio haya marcado ubicación
    if (selectedRole === 'business' && !businessLocation) {
      setError('Debes marcar la ubicación de tu negocio en el mapa.');
      setLoading(false);
      return;
    }

    const metadata: any = { name, phone, role: selectedRole };
    if (selectedRole === 'business') {
      metadata.business_name = businessName;
      metadata.ruc = ruc;
      metadata.business_address = businessAddress;
      if (businessLocation) {
        metadata.business_lat = businessLocation.lat;
        metadata.business_lng = businessLocation.lng;
      }
    } else if (selectedRole === 'motorist') {
      metadata.license = license;
      metadata.plate = plate;
      metadata.vehicle_model = vehicleModel;
      metadata.vehicle_year = vehicleYear;
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push('/pending-approval');
    setLoading(false);
  };

  // ============================================================
  // LANDING PAGE
  // ============================================================
  if (step === 'landing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full text-center">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-slate-800">UrbanLogistic</h1>
            <p className="text-slate-500 mt-2 text-sm">Logística y envíos bajo demanda · Nicaragua</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <button
              onClick={() => { setSelectedRole('business'); setIsLogin(true); setStep('auth'); }}
              className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl transition-all duration-200 hover:scale-105 border-2 border-transparent hover:border-blue-500 group"
            >
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-200 transition">
                  <Store size={40} className="text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">UL Negocio</h2>
                <p className="text-slate-500 text-sm mt-2">Solicita envíos para tu negocio</p>
                <span className="mt-4 text-blue-600 font-medium text-sm">Seleccionar →</span>
              </div>
            </button>

            <button
              onClick={() => { setSelectedRole('motorist'); setIsLogin(true); setStep('auth'); }}
              className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl transition-all duration-200 hover:scale-105 border-2 border-transparent hover:border-green-500 group"
            >
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-green-200 transition">
                  <Bike size={40} className="text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">UL Motorizado</h2>
                <p className="text-slate-500 text-sm mt-2">Recibe y realiza envíos</p>
                <span className="mt-4 text-green-600 font-medium text-sm">Seleccionar →</span>
              </div>
            </button>
          </div>

          <p className="text-xs text-slate-400 mt-6">
            Cada aplicación es independiente e instalable como PWA
          </p>
        </div>
      </div>
    );
  }

  // ============================================================
  // FORMULARIO DE AUTENTICACIÓN
  // ============================================================
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-6 rounded-xl shadow-sm max-w-md w-full">
        <button
          onClick={() => setStep('landing')}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-4 transition"
        >
          <ArrowLeft size={16} /> Volver
        </button>

        <h2 className="text-2xl font-bold text-center text-slate-800">
          {selectedRole === 'business' ? 'Negocio' : 'Motorizado'}
        </h2>
        <p className="text-center text-sm text-slate-500 mb-6">
          {isLogin ? 'Inicia sesión' : 'Regístrate para comenzar'}
        </p>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-4 border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-4">
          {!isLogin && (
            <>
              <input
                type="text"
                placeholder="Nombre completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full p-2 border border-slate-300 rounded-md text-sm"
              />
              <input
                type="tel"
                placeholder="Teléfono"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full p-2 border border-slate-300 rounded-md text-sm"
              />
            </>
          )}

          {!isLogin && selectedRole === 'business' && (
            <>
              <input
                type="text"
                placeholder="Nombre del negocio"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
                className="w-full p-2 border border-slate-300 rounded-md text-sm"
              />
              <input
                type="text"
                placeholder="RUC (opcional)"
                value={ruc}
                onChange={(e) => setRuc(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-md text-sm"
              />
              <input
                type="text"
                placeholder="Dirección del negocio"
                value={businessAddress}
                onChange={(e) => setBusinessAddress(e.target.value)}
                required
                className="w-full p-2 border border-slate-300 rounded-md text-sm"
              />
              {/* 🔥 MAPA PARA UBICACIÓN DEL NEGOCIO */}
              <div>
                <label className="text-xs text-slate-500 block mb-1">
                  Ubicación en el mapa <span className="text-red-500">*</span>
                </label>
                <LocationPicker position={businessLocation} setPosition={setBusinessLocation} />
                {businessLocation ? (
                  <p className="text-xs text-green-600 mt-1">✅ Ubicación guardada</p>
                ) : (
                  <p className="text-xs text-amber-600 mt-1">👆 Haz clic en el mapa para marcar tu negocio</p>
                )}
              </div>
            </>
          )}

          {!isLogin && selectedRole === 'motorist' && (
            <>
              <input
                type="text"
                placeholder="Número de licencia"
                value={license}
                onChange={(e) => setLicense(e.target.value)}
                required
                className="w-full p-2 border border-slate-300 rounded-md text-sm"
              />
              <input
                type="text"
                placeholder="Placa de la moto"
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
                required
                className="w-full p-2 border border-slate-300 rounded-md text-sm"
              />
              <input
                type="text"
                placeholder="Modelo de la moto"
                value={vehicleModel}
                onChange={(e) => setVehicleModel(e.target.value)}
                required
                className="w-full p-2 border border-slate-300 rounded-md text-sm"
              />
              <input
                type="number"
                placeholder="Año de la moto"
                value={vehicleYear}
                onChange={(e) => setVehicleYear(e.target.value)}
                required
                className="w-full p-2 border border-slate-300 rounded-md text-sm"
              />
            </>
          )}

          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full p-2 border border-slate-300 rounded-md text-sm"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full p-2 border border-slate-300 rounded-md text-sm"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-md transition disabled:opacity-50"
          >
            {loading ? 'Cargando...' : (isLogin ? 'Iniciar sesión' : 'Registrarse')}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-4">
          {isLogin ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
          <button
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="text-blue-600 hover:underline"
          >
            {isLogin ? 'Regístrate' : 'Inicia sesión'}
          </button>
        </p>
      </div>
    </div>
  );
}