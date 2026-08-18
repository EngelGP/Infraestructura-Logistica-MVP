'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Map, Navigation, Phone, AlertTriangle } from 'lucide-react';
import dynamic from 'next/dynamic';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import 'leaflet/dist/leaflet.css';

interface Shipment {
  id: string;
  client_name: string;
  client_phone: string;
  origin_address: string;
  dest_address: string;
  fee: number;
  status: string;
  created_at: string;
  updated_at: string;
  origin_lat: number | null;
  origin_lng: number | null;
  dest_lat: number | null;
  dest_lng: number | null;
  businesses?: {
    business_name: string;
    address: string;
    lat: number | null;
    lng: number | null;
  } | null;
}

// Mapa dinámico (solo cliente)
const MapWithBothPoints = dynamic(
  () => import('react-leaflet').then(({ MapContainer, TileLayer, Marker, Polyline, Popup, useMap }) => {
    return function MapWithBothPoints({ originLat, originLng, destLat, destLng, originAddress, destAddress }: any) {
      const L = require('leaflet');
      const defaultCenter: [number, number] = [12.1364, -86.2514];

      const createIcon = (color: string) => new L.DivIcon({
        className: 'bg-transparent',
        html: `<div style="background-color: ${color}; width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 0 8px rgba(0,0,0,0.3);"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      const origin: [number, number] | null = originLat && originLng ? [originLat, originLng] : null;
      const destination: [number, number] | null = destLat && destLng ? [destLat, destLng] : null;

      let initialCenter: [number, number] = defaultCenter;
      let initialZoom = 13;
      if (origin && destination) {
        initialCenter = [(origin[0] + destination[0]) / 2, (origin[1] + destination[1]) / 2];
        initialZoom = 14;
      } else if (origin) { initialCenter = origin; initialZoom = 15; }
      else if (destination) { initialCenter = destination; initialZoom = 15; }

      function MapFitBounds() {
        const map = useMap();
        useEffect(() => {
          if (origin && destination) {
            map.fitBounds(L.latLngBounds([origin, destination]), { padding: [80, 80] });
          } else if (origin) map.setView(origin, 15);
          else if (destination) map.setView(destination, 15);
          else map.setView(defaultCenter, 13);
        }, [map]);
        return null;
      }

      const positions: [number, number][] = [];
      if (origin && destination) positions.push(origin, destination);

      return (
        <MapContainer center={initialCenter} zoom={initialZoom} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapFitBounds />
          {origin && <Marker position={origin} icon={createIcon('#22c55e')}><Popup>Origen: {originAddress}</Popup></Marker>}
          {destination && <Marker position={destination} icon={createIcon('#ef4444')}><Popup>Destino: {destAddress}</Popup></Marker>}
          {positions.length === 2 && <Polyline positions={positions} color="#2563eb" weight={4} opacity={0.7} dashArray="5, 10" />}
        </MapContainer>
      );
    };
  }),
  { ssr: false, loading: () => <div className="h-64 w-full bg-slate-100 flex items-center justify-center text-sm text-slate-400">Cargando mapa...</div> }
);

export default function MotoristDashboard() {
  const router = useRouter();
  const [driverId, setDriverId] = useState<string | null>(null);
  const [availableShipments, setAvailableShipments] = useState<Shipment[]>([]);
  const [activeShipment, setActiveShipment] = useState<Shipment | null>(null);
  const [historyShipments, setHistoryShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [viewState, setViewState] = useState<'dashboard' | 'history'>('dashboard');

  // 1. Obtener driverId
  useEffect(() => {
    const initDriver = async () => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) { router.push('/'); return; }
      const { data: driverData, error: driverError } = await supabase
        .from('drivers')
        .select('id')
        .eq('user_id', authData.user.id)
        .single();
      if (driverError || !driverData) {
        setErrorMsg('Tu cuenta no está registrada como motorizado.');
        setLoading(false);
        return;
      }
      setDriverId(driverData.id);
      setLoading(false);
    };
    initDriver();
  }, [router]);

  // 2. Funciones de carga con JOIN a businesses
  const fetchActiveShipment = useCallback(async (dId: string) => {
    const { data, error } = await supabase
      .from('shipments')
      .select(`
        *,
        businesses (business_name, address, lat, lng)
      `)
      .eq('motorist_id', dId)
      .in('status', ['accepted', 'picked_up', 'in_transit'])
      .limit(1)
      .maybeSingle();
    if (!error && data) setActiveShipment(data);
    else setActiveShipment(null);
  }, []);

  const fetchAvailableShipments = useCallback(async () => {
    const { data, error } = await supabase
      .from('shipments')
      .select(`
        *,
        businesses (business_name, address, lat, lng)
      `)
      .eq('status', 'created')
      .is('motorist_id', null)
      .order('created_at', { ascending: false });
    if (!error && data) setAvailableShipments(data || []);
  }, []);

  const fetchHistoryShipments = async (dId: string) => {
    const { data, error } = await supabase
      .from('shipments')
      .select('*')
      .eq('motorist_id', dId)
      .in('status', ['delivered', 'completed'])
      .order('created_at', { ascending: false });
    if (!error && data) setHistoryShipments(data);
  };

  // 3. Efecto principal
  useEffect(() => {
    if (!driverId) return;
    const loadAll = async () => {
      await fetchActiveShipment(driverId);
      await fetchAvailableShipments();
    };
    loadAll();
    const interval = setInterval(loadAll, 5000);
    return () => clearInterval(interval);
  }, [driverId, fetchActiveShipment, fetchAvailableShipments]);

  // 4. Manejadores
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleAcceptShipment = async (shipmentId: string) => {
    if (!driverId) return;
    setActionLoading(true);
    const { error } = await supabase
      .from('shipments')
      .update({ status: 'accepted', motorist_id: driverId, updated_at: new Date().toISOString() })
      .eq('id', shipmentId)
      .eq('status', 'created');
    if (!error) {
      await fetchActiveShipment(driverId);
      await fetchAvailableShipments();
    } else {
      alert('No se pudo aceptar el envío: ' + error.message);
    }
    setActionLoading(false);
  };

  const handleUpdateStatus = async (shipmentId: string, newStatus: string) => {
    setActionLoading(true);
    const { error } = await supabase
      .from('shipments')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', shipmentId);
    if (!error) {
      if (newStatus === 'delivered') {
        setActiveShipment(null);
        await fetchHistoryShipments(driverId!);
      } else {
        await fetchActiveShipment(driverId!);
      }
      await fetchAvailableShipments();
    } else {
      alert('Hubo un error al actualizar el estado: ' + error.message);
    }
    setActionLoading(false);
  };

  // 5. UI Helpers
  const getStatusBadge = (status: string) => {
    const map: Record<string, any> = {
      accepted: { label: 'ACEPTADO', className: 'bg-blue-600 text-white' },
      picked_up: { label: 'RECOGIDO', className: 'bg-amber-500 text-white' },
      in_transit: { label: 'EN CAMINO', className: 'bg-indigo-600 text-white' },
      delivered: { label: 'ENTREGADO', className: 'bg-green-600 text-white' },
      completed: { label: 'COMPLETADO', className: 'bg-green-700 text-white' },
    };
    return map[status] || { label: status.toUpperCase(), className: 'bg-gray-500 text-white' };
  };

  const getPrimaryAction = (status: string) => {
    switch (status) {
      case 'accepted': return { label: 'IR AL ORIGEN', color: 'bg-blue-600 hover:bg-blue-700' };
      case 'picked_up': return { label: 'INICIAR ENTREGA', color: 'bg-amber-500 hover:bg-amber-600' };
      case 'in_transit': return { label: 'MARCAR COMO ENTREGADO', color: 'bg-green-600 hover:bg-green-700' };
      case 'delivered': return { label: 'ENVÍO COMPLETADO', color: 'bg-gray-400 cursor-not-allowed' };
      default: return { label: 'CARGANDO...', color: 'bg-gray-300' };
    }
  };

  // 6. Render
  if (viewState === 'history') {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <header className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-bold">Historial</h1>
          <Button variant="outline" onClick={() => setViewState('dashboard')}>Volver</Button>
        </header>
        {historyShipments.length === 0 ? <p className="text-center text-slate-500 mt-10">Aún no tienes viajes completados.</p> :
          <div className="space-y-4">
            {historyShipments.map(s => (
              <Card key={s.id}><CardHeader><CardTitle>{s.client_name}</CardTitle></CardHeader>
                <CardContent><p>Destino: {s.dest_address}</p><p className="font-bold text-green-600">C$ {s.fee}</p></CardContent></Card>
            ))}
          </div>
        }
      </div>
    );
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50">Cargando...</div>;
  if (errorMsg) return <div className="min-h-screen flex flex-col items-center justify-center p-4"><p className="text-red-600">{errorMsg}</p><Button onClick={handleLogout}>Cerrar Sesión</Button></div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <header className="bg-white border-b px-4 py-3 sticky top-0 z-20 flex justify-between items-center">
        <div><span className="text-sm font-bold">UrbanLogistic</span><span className="text-xs text-slate-400 hidden sm:inline ml-1">| Motorizado</span></div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { fetchHistoryShipments(driverId!); setViewState('history'); }} className="text-xs text-slate-500">Historial</Button>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-xs text-red-500">Salir</Button>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-4 space-y-5">
        <h1 className="text-2xl font-bold text-slate-800">ENVÍO EN CURSO</h1>

        {!activeShipment ? (
          <>
            <div className="bg-white rounded-xl border p-8 text-center shadow-sm">
              <p className="text-slate-500">No tienes ningún envío asignado.</p>
              <p className="text-sm text-slate-400 mt-2">Espera una nueva solicitud.</p>
            </div>

            {/* Envíos disponibles con nombre del negocio */}
            <section>
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Envíos Disponibles</h2>
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-2 w-2 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>
                <span className="text-xs text-slate-400">Actualizando cada 5s</span>
              </div>
              {availableShipments.length === 0 ? (
                <p className="text-center text-sm text-slate-500 py-8 bg-white rounded-lg border">No hay envíos disponibles.</p>
              ) : (
                <div className="space-y-4">
                  {availableShipments.map(s => (
                    <Card key={s.id} className="shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base text-slate-800">{s.client_name}</CardTitle>
                        <CardDescription className="truncate">
                          <span className="font-medium text-blue-600">{s.businesses?.business_name || 'Negocio'}</span> → {s.dest_address}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pb-2"><p className="text-lg font-bold text-green-600">C$ {s.fee}</p></CardContent>
                      <CardFooter>
                        <Button className="w-full" variant="outline" onClick={() => handleAcceptShipment(s.id)} disabled={actionLoading || activeShipment !== null}>
                          {activeShipment ? 'Termina tu viaje actual' : 'Aceptar Pedido'}
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          <>
            {/* Tarjeta de información */}
            <Card className="border-slate-200 shadow-sm rounded-xl">
              <CardHeader className="pb-2 flex flex-row justify-between items-start">
                <div>
                  <CardTitle className="text-xl font-bold">{activeShipment.client_name}</CardTitle>
                  <p className="text-sm text-slate-500 mt-1">ID: {activeShipment.id.slice(0, 8)}</p>
                </div>
                <Badge className={`${getStatusBadge(activeShipment.status).className} uppercase text-xs px-3 py-1`}>
                  {getStatusBadge(activeShipment.status).label}
                </Badge>
              </CardHeader>
            </Card>

            {/* Origen y Destino con Nombre del Negocio */}
            <Card className="border-slate-200 shadow-sm rounded-xl">
              <CardContent className="p-4 space-y-4">
                {/* ORIGEN */}
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0 mt-1"></div>
                    <div className="w-0.5 h-8 bg-slate-300"></div>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Origen</p>
                    {/* 🔥 Nombre del Negocio */}
                    <p className="text-sm font-bold text-blue-600">
                      {activeShipment.businesses?.business_name || 'Negocio desconocido'}
                    </p>
                    <p className="text-base font-medium text-slate-800">{activeShipment.origin_address}</p>
                  </div>
                  <Button variant="outline" size="icon" className="flex-shrink-0 h-8 w-8 rounded-full border-slate-300 text-slate-500 hover:bg-slate-50"
                    onClick={() => {
                      const lat = activeShipment.origin_lat;
                      const lng = activeShipment.origin_lng;
                      const url = lat && lng ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activeShipment.origin_address + ', Managua')}`;
                      window.open(url, '_blank');
                    }}>
                    <Navigation size={16} />
                  </Button>
                </div>

                <div className="border-t border-slate-200 my-2"></div>

                {/* DESTINO */}
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0 mt-1"></div>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Destino</p>
                    <p className="text-base font-medium text-slate-800">{activeShipment.dest_address}</p>
                  </div>
                  <Button variant="outline" size="icon" className="flex-shrink-0 h-8 w-8 rounded-full border-slate-300 text-slate-500 hover:bg-slate-50"
                    onClick={() => {
                      const lat = activeShipment.dest_lat;
                      const lng = activeShipment.dest_lng;
                      const url = lat && lng ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activeShipment.dest_address + ', Managua')}`;
                      window.open(url, '_blank');
                    }}>
                    <Navigation size={16} />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Mapa */}
            {(activeShipment.origin_lat && activeShipment.origin_lng && activeShipment.dest_lat && activeShipment.dest_lng) ? (
              <div className="rounded-xl overflow-hidden border shadow-sm">
                <div className="h-64 w-full relative">
                  <MapWithBothPoints
                    originLat={activeShipment.origin_lat} originLng={activeShipment.origin_lng}
                    destLat={activeShipment.dest_lat} destLng={activeShipment.dest_lng}
                    originAddress={activeShipment.origin_address}
                    destAddress={activeShipment.dest_address}
                  />
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border p-8 text-center shadow-sm">
                <p className="text-slate-500">Ubicación no disponible</p>
                <p className="text-sm text-slate-400 mt-2">El negocio no marcó coordenadas exactas.</p>
              </div>
            )}

            {/* Tarifa */}
            <div className="bg-white rounded-xl border p-4 shadow-sm flex justify-between items-center">
              <span className="text-sm font-medium text-slate-600">Tarifa del envío</span>
              <span className="text-2xl font-bold text-green-600">C$ {activeShipment.fee}</span>
            </div>

            {/* Acciones */}
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="border-slate-200 text-slate-600 hover:bg-slate-50 gap-2"><Phone size={16} /> Contactar</Button>
              <Button variant="outline" className="border-slate-200 text-slate-600 hover:bg-slate-50 gap-2"><AlertTriangle size={16} /> Incidencia</Button>
            </div>

            {/* Acción principal */}
            {(() => {
              const action = getPrimaryAction(activeShipment.status);
              return (
                <Button className={`w-full h-14 text-base font-bold rounded-xl shadow-sm ${action.color} text-white`}
                  disabled={actionLoading || activeShipment.status === 'delivered'}
                  onClick={() => {
                    if (activeShipment.status === 'accepted') handleUpdateStatus(activeShipment.id, 'picked_up');
                    else if (activeShipment.status === 'picked_up') handleUpdateStatus(activeShipment.id, 'in_transit');
                    else if (activeShipment.status === 'in_transit') handleUpdateStatus(activeShipment.id, 'delivered');
                  }}>
                  {actionLoading ? 'Procesando...' : action.label}
                </Button>
              );
            })()}
          </>
        )}
      </main>
    </div>
  );
}