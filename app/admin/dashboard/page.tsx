'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { 
  Package, Users, Truck, DollarSign,
  UserCheck, UserX, Loader2, Trash2
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// Mapa dinámico (Leaflet)
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';

const MapWithMarkers = dynamic(
  () => import('react-leaflet').then(({ MapContainer, TileLayer, Marker, Popup }) => {
    return function MapComponent({ businesses, drivers }: { businesses: any[], drivers: any[] }) {
      const L = require('leaflet');
      const defaultCenter: [number, number] = [12.1364, -86.2514];

      const businessIcon = new L.DivIcon({
        className: 'bg-transparent',
        html: `<div style="background-color: #22c55e; width:16px;height:16px;border-radius:50%;border:2px solid white;box-shadow:0 0 8px rgba(0,0,0,0.3);"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      const driverIcon = new L.DivIcon({
        className: 'bg-transparent',
        html: `<div style="background-color: #2563eb; width:16px;height:16px;border-radius:50%;border:2px solid white;box-shadow:0 0 8px rgba(0,0,0,0.3);"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      return (
        <MapContainer center={defaultCenter} zoom={12} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {businesses.map((b) => b.lat && b.lng && (
            <Marker key={b.id} position={[b.lat, b.lng]} icon={businessIcon}>
              <Popup><strong>{b.business_name}</strong><br />{b.owner_name}</Popup>
            </Marker>
          ))}
          {drivers.map((d) => d.lat && d.lng && (
            <Marker key={d.id} position={[d.lat, d.lng]} icon={driverIcon}>
              <Popup><strong>{d.full_name}</strong><br />Placa: {d.plate}</Popup>
            </Marker>
          ))}
        </MapContainer>
      );
    };
  }),
  { ssr: false, loading: () => <div className="h-64 w-full bg-slate-100 flex items-center justify-center text-sm text-slate-400">Cargando mapa...</div> }
);

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  // Métricas
  const [metrics, setMetrics] = useState<any>({
    totalShipments: 0,
    totalBusinesses: 0,
    totalMotorists: 0,
    totalRevenue: 0,
    pendingShipments: 0,
    inProgressCount: 0,
    avgFee: 0,
  });

  // Listas
  const [recentShipments, setRecentShipments] = useState<any[]>([]);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);

  const [userFilter, setUserFilter] = useState<'all' | 'business' | 'motorist' | 'admin'>('all');

  const [processingUserId, setProcessingUserId] = useState<string | null>(null);
  const [processingAction, setProcessingAction] = useState<'approve' | 'reject' | 'delete' | null>(null);

  const loadData = async () => {
    try {
      // Verificar autenticación y rol
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { 
        router.push('/'); 
        return; 
      }
      setUser(user);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, status')
        .eq('id', user.id)
        .single();

      if (profileError || !profile || profile.role !== 'admin' || profile.status !== 'approved') {
        router.push('/dashboard');
        return;
      }

      // 🔥 Cargar datos desde la API (usando service_role)
      const res = await fetch('/api/admin/dashboard-data');
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al cargar datos');
      }
      const data = await res.json();

      setMetrics(data.metrics);
      setRecentShipments(data.recentShipments);
      setRecentUsers(data.approvedUsers);
      setPendingUsers(data.pendingUsers);
      setBusinesses(data.businesses);
      setDrivers(data.drivers);

      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al cargar datos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  // ============================================================
  // 🔥 APROBAR (usa API)
  // ============================================================
  const handleApprove = async (profile: any) => {
    setProcessingUserId(profile.id);
    setProcessingAction('approve');
    try {
      const res = await fetch('/api/admin/approve-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile.id,
          role: profile.role,
          extraData: {
            business_name: profile.business_name || profile.name,
            owner_name: profile.name,
            ruc: profile.ruc,
            address: profile.business_address,
            lat: profile.business_lat,
            lng: profile.business_lng,
            full_name: profile.name,
            license: profile.license,
            plate: profile.plate,
            vehicle_model: profile.vehicle_model,
            vehicle_year: profile.vehicle_year,
          }
        }),
      });
      if (res.ok) {
        alert('✅ Usuario aprobado');
        await loadData();
      } else {
        const err = await res.json();
        alert('❌ Error: ' + err.error);
      }
    } catch (err: any) {
      alert('❌ Error: ' + err.message);
    } finally {
      setProcessingUserId(null);
      setProcessingAction(null);
    }
  };

  // ============================================================
  // 🔥 RECHAZAR (usa API)
  // ============================================================
  const handleReject = async (profile: any) => {
    if (!confirm(`¿Rechazar a "${profile.name}"?`)) return;
    setProcessingUserId(profile.id);
    setProcessingAction('reject');
    try {
      const res = await fetch('/api/admin/reject-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile.id,
          role: profile.role,
        }),
      });
      if (res.ok) {
        alert('✅ Usuario rechazado');
        await loadData();
      } else {
        const err = await res.json();
        alert('❌ Error: ' + err.error);
      }
    } catch (err: any) {
      alert('❌ Error: ' + err.message);
    } finally {
      setProcessingUserId(null);
      setProcessingAction(null);
    }
  };

  // ============================================================
  // 🔥 ELIMINAR (ya usa API, solo agregamos confirmación)
  // ============================================================
  const handleDelete = async (profile: any) => {
    if (!confirm(`¿Eliminar permanentemente a "${profile.displayName}"?`)) return;
    setProcessingUserId(profile.id);
    setProcessingAction('delete');
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.id }),
      });
      if (res.ok) {
        alert('✅ Usuario eliminado');
        await loadData();
      } else {
        const err = await res.json();
        alert('❌ Error: ' + err.error);
      }
    } catch (err) {
      alert('❌ Error de red');
    } finally {
      setProcessingUserId(null);
      setProcessingAction(null);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm">Cargando panel...</div>;
  if (error) return <div className="min-h-screen flex flex-col items-center justify-center p-4"><p className="text-red-600">{error}</p><Button onClick={() => window.location.reload()}>Reintentar</Button></div>;

  const getStatusBadge = (status: string) => {
    const map: Record<string, any> = {
      created: { label: 'Creado', className: 'bg-slate-500 text-white' },
      accepted: { label: 'Aceptado', className: 'bg-blue-500 text-white' },
      picked_up: { label: 'Recogido', className: 'bg-amber-500 text-white' },
      in_transit: { label: 'En camino', className: 'bg-indigo-500 text-white' },
      delivered: { label: 'Entregado', className: 'bg-green-500 text-white' },
      completed: { label: 'Completado', className: 'bg-green-700 text-white' },
      cancelled: { label: 'Cancelado', className: 'bg-red-500 text-white' },
    };
    return map[status] || { label: status, className: 'bg-gray-500 text-white' };
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      <header className="bg-white border-b px-3 py-2 sticky top-0 z-20 flex flex-wrap justify-between items-center gap-2">
        <span className="text-sm font-bold">UrbanLogistic <span className="text-[10px] text-slate-400 hidden sm:inline">| Admin</span></span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 hidden md:inline truncate max-w-[120px]">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-xs text-red-500 h-7 px-2">Salir</Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 py-4 space-y-4">
        <h1 className="text-lg sm:text-xl font-bold">Panel de Administración</h1>

        {/* Métricas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card><CardHeader className="pb-1 px-3 pt-3"><CardTitle className="text-[10px] font-medium text-slate-500 flex items-center gap-1"><Package size={14} /> Envíos</CardTitle></CardHeader><CardContent className="px-3 pb-3 pt-0"><p className="text-lg font-bold">{metrics.totalShipments}</p></CardContent></Card>
          <Card><CardHeader className="pb-1 px-3 pt-3"><CardTitle className="text-[10px] font-medium text-slate-500 flex items-center gap-1"><Users size={14} /> Negocios</CardTitle></CardHeader><CardContent className="px-3 pb-3 pt-0"><p className="text-lg font-bold">{metrics.totalBusinesses}</p></CardContent></Card>
          <Card><CardHeader className="pb-1 px-3 pt-3"><CardTitle className="text-[10px] font-medium text-slate-500 flex items-center gap-1"><Truck size={14} /> Motorizados</CardTitle></CardHeader><CardContent className="px-3 pb-3 pt-0"><p className="text-lg font-bold">{metrics.totalMotorists}</p></CardContent></Card>
          <Card><CardHeader className="pb-1 px-3 pt-3"><CardTitle className="text-[10px] font-medium text-slate-500 flex items-center gap-1"><DollarSign size={14} /> Ingresos</CardTitle></CardHeader><CardContent className="px-3 pb-3 pt-0"><p className="text-lg font-bold text-green-600">C$ {metrics.totalRevenue.toFixed(0)}</p></CardContent></Card>
        </div>

        {/* Mapa */}
        <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
          <div className="h-64 w-full"><MapWithMarkers businesses={businesses} drivers={drivers} /></div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-50 border-t text-[10px] text-slate-500">
            <div className="flex items-center gap-3"><span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block"></span> Negocios</span><span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span> Motorizados</span></div>
            <span>Actualización cada 10s</span>
          </div>
        </div>

        {/* Estados rápidos */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border p-3 shadow-sm flex justify-between items-center"><div><p className="text-[10px] text-slate-500">Pendientes</p><p className="text-base font-bold">{metrics.pendingShipments}</p></div><Badge className="text-[10px] bg-amber-50 text-amber-700">{metrics.totalShipments > 0 ? Math.round((metrics.pendingShipments/metrics.totalShipments)*100) : 0}%</Badge></div>
          <div className="bg-white rounded-xl border p-3 shadow-sm flex justify-between items-center"><div><p className="text-[10px] text-slate-500">En progreso</p><p className="text-base font-bold">{metrics.inProgressCount}</p></div><Badge className="text-[10px] bg-indigo-50 text-indigo-700">Activos</Badge></div>
          <div className="bg-white rounded-xl border p-3 shadow-sm flex justify-between items-center"><div><p className="text-[10px] text-slate-500">Entregados</p><p className="text-base font-bold">{recentShipments.filter(s => s.status === 'delivered' || s.status === 'completed').length}</p></div><Badge className="text-[10px] bg-green-50 text-green-700">OK</Badge></div>
          <div className="bg-white rounded-xl border p-3 shadow-sm flex justify-between items-center"><div><p className="text-[10px] text-slate-500">Tarifa Ø</p><p className="text-base font-bold">C$ {metrics.avgFee}</p></div><Badge className="text-[10px] bg-purple-50 text-purple-700">Promedio</Badge></div>
        </div>

        {/* Pendientes de aprobación */}
        <Card>
          <CardHeader className="pb-1 px-3 pt-3 flex flex-row justify-between items-center">
            <CardTitle className="text-xs font-semibold flex items-center gap-1"><UserCheck size={14} /> Usuarios Pendientes</CardTitle>
            <Badge variant="outline" className="text-[10px]">{pendingUsers.length}</Badge>
          </CardHeader>
          <CardContent className="px-3 pb-3 max-h-64 overflow-y-auto space-y-2">
            {pendingUsers.length === 0 ? <p className="text-xs text-slate-400 text-center py-4">No hay usuarios pendientes.</p> :
              pendingUsers.map(p => (
                <div key={p.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-2 gap-2">
                  <div><p className="text-sm font-medium">{p.business_name || p.name || 'Sin nombre'}</p><p className="text-[10px] text-slate-400">{p.phone || 'Sin teléfono'} · <span className="text-amber-600 font-medium">Pendiente</span></p></div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" className="h-7 px-3 text-[10px] bg-green-600 hover:bg-green-700 text-white" onClick={() => handleApprove(p)} disabled={processingUserId === p.id}>
                      {processingUserId === p.id && processingAction === 'approve' ? <Loader2 size={12} className="animate-spin" /> : <UserCheck size={12} className="mr-1" />} Aprobar
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-3 text-[10px] border-red-200 text-red-600 hover:bg-red-50" onClick={() => handleReject(p)} disabled={processingUserId === p.id}>
                      {processingUserId === p.id && processingAction === 'reject' ? <Loader2 size={12} className="animate-spin" /> : <UserX size={12} className="mr-1" />} Rechazar
                    </Button>
                  </div>
                </div>
              ))
            }
          </CardContent>
        </Card>

        {/* Últimos envíos y usuarios */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-1 px-3 pt-3 flex flex-row justify-between items-center">
              <CardTitle className="text-xs font-semibold flex items-center gap-1"><Package size={14} /> Últimos Envíos</CardTitle>
              <Badge variant="outline">{recentShipments.length}</Badge>
            </CardHeader>
            <CardContent className="px-3 pb-3 max-h-64 overflow-y-auto space-y-2">
              {recentShipments.length === 0 ? <p className="text-xs text-slate-400 text-center py-4">No hay envíos aún.</p> :
                recentShipments.map(s => (
                  <div key={s.id} className="flex flex-wrap justify-between items-start border-b pb-2 gap-1">
                    <div className="flex-1 min-w-0 pr-2"><p className="text-sm font-medium truncate">{s.client_name}</p><p className="text-[10px] text-slate-400 truncate">{s.dest_address}</p></div>
                    <div className="flex items-center gap-1"><Badge className={`${getStatusBadge(s.status).className} text-[10px] px-1.5 py-0`}>{getStatusBadge(s.status).label}</Badge><span className="text-xs font-semibold text-green-600">C${s.fee}</span></div>
                  </div>
                ))
              }
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1 px-3 pt-3 flex flex-row justify-between items-center">
              <CardTitle className="text-xs font-semibold flex items-center gap-1"><Users size={14} /> Usuarios</CardTitle>
              <Badge variant="outline" className="text-[10px]">{recentUsers.length}</Badge>
            </CardHeader>
            <div className="px-3 pb-2 flex flex-wrap gap-1">
              <Button variant={userFilter === 'all' ? 'default' : 'outline'} size="sm" className="h-6 px-2 text-[10px]" onClick={() => setUserFilter('all')}>Todos</Button>
              <Button variant={userFilter === 'business' ? 'default' : 'outline'} size="sm" className="h-6 px-2 text-[10px]" onClick={() => setUserFilter('business')}>Negocios</Button>
              <Button variant={userFilter === 'motorist' ? 'default' : 'outline'} size="sm" className="h-6 px-2 text-[10px]" onClick={() => setUserFilter('motorist')}>Motorizados</Button>
              <Button variant={userFilter === 'admin' ? 'default' : 'outline'} size="sm" className="h-6 px-2 text-[10px]" onClick={() => setUserFilter('admin')}>Admins</Button>
            </div>
            <CardContent className="px-3 pb-3 max-h-64 overflow-y-auto space-y-2">
              {recentUsers.length === 0 ? <p className="text-xs text-slate-400 text-center py-4">No hay usuarios.</p> :
                recentUsers.filter(u => userFilter === 'all' ? true : u.role === userFilter).map(u => (
                  <div key={u.id} className="flex justify-between items-center border-b pb-2 hover:bg-slate-50 px-1 py-1 rounded group transition-colors">
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-800 truncate">{u.displayName || u.name || 'Sin nombre'}</p>
                        {u.extraInfo && <Badge className={`text-[10px] px-1.5 py-0 ${u.extraInfo === 'Negocio' ? 'bg-blue-100 text-blue-800' : u.extraInfo === 'Motorizado' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'}`}>{u.extraInfo}</Badge>}
                      </div>
                      {u.secondaryText && <p className="text-[10px] text-slate-400">{u.secondaryText}</p>}
                      <p className="text-[10px] text-slate-400">{u.phone}</p>
                    </div>
                    {u.status === 'approved' && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-red-500 hover:bg-red-50" onClick={() => handleDelete(u)} disabled={processingUserId === u.id} title="Eliminar usuario">
                        {processingUserId === u.id && processingAction === 'delete' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </Button>
                    )}
                  </div>
                ))
              }
            </CardContent>
          </Card>
        </div>
        <div className="text-center text-[10px] text-slate-400 pt-3 border-t">UrbanLogistic · Actualización cada 10s</div>
      </main>
    </div>
  );
}