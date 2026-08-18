'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { 
  Home, Package, User, Plus, Bell, MapPin, Truck, CheckCircle, Clock, MoreHorizontal
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function BusinessDashboardPage() {
  const router = useRouter();
  const [business, setBusiness] = useState<any>(null);
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardInfo = useCallback(async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.push('/');
        return;
      }

      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select('id, business_name, owner_name, address, lat, lng')
        .eq('user_id', user.id)
        .single();

      if (businessError || !businessData) {
        setError('No tienes un negocio registrado.');
        setLoading(false);
        return;
      }

      setBusiness(businessData);

      const { data: shipmentsData, error: shipmentsError } = await supabase
        .from('shipments')
        .select(`
          *,
          drivers (full_name)
        `)
        .eq('business_id', businessData.id)
        .order('created_at', { ascending: false });

      if (!shipmentsError && shipmentsData) {
        setShipments(shipmentsData);
      }
    } catch (err) {
      console.error('Error al cargar datos:', err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadDashboardInfo();
    const intervalId = setInterval(loadDashboardInfo, 5000);
    return () => clearInterval(intervalId);
  }, [loadDashboardInfo]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusInfo = (status: string) => {
    const map: Record<string, any> = {
      created: { label: 'Creado', icon: Clock, className: 'bg-slate-100 text-slate-700' },
      accepted: { label: 'Aceptado', icon: Truck, className: 'bg-blue-100 text-blue-700' },
      picked_up: { label: 'Recogido', icon: Package, className: 'bg-amber-100 text-amber-700' },
      in_transit: { label: 'En camino', icon: Truck, className: 'bg-indigo-100 text-indigo-700' },
      delivered: { label: 'Entregado', icon: CheckCircle, className: 'bg-green-100 text-green-700' },
      completed: { label: 'Completado', icon: CheckCircle, className: 'bg-green-200 text-green-800' },
      cancelled: { label: 'Cancelado', icon: MoreHorizontal, className: 'bg-red-100 text-red-700' },
    };
    return map[status] || { label: status, icon: Clock, className: 'bg-slate-100 text-slate-700' };
  };

  const activeShipments = shipments.filter(s => ['created','accepted','picked_up','in_transit'].includes(s.status));
  const deliveredToday = shipments.filter(s => 
    (s.status === 'delivered' || s.status === 'completed') && 
    new Date(s.updated_at).toDateString() === new Date().toDateString()
  );

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <p className="text-red-600">{error}</p>
        <Button onClick={handleLogout} className="mt-4">Cerrar sesión</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="max-w-lg mx-auto px-4 pt-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-800">{business?.business_name || 'Mi negocio'}</h1>
            <p className="text-sm text-slate-500">¡Buenos días! 🥳</p>
          </div>
          <Button variant="ghost" size="icon" className="relative">
            <Bell size={22} className="text-slate-600" />
            <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
          </Button>
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Activos</p>
                <p className="text-2xl font-bold">{activeShipments.length}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Truck size={18} className="text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Entregados hoy</p>
                <p className="text-2xl font-bold">{deliveredToday.length}</p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle size={18} className="text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Botón Nuevo Envío */}
        <Link href="/business/shipments/new">
          <Button className="w-full mb-6 h-12 text-base font-semibold shadow-sm gap-2 bg-blue-600 hover:bg-blue-700">
            <Plus size={20} /> Nuevo Envío
          </Button>
        </Link>

        {/* Envíos Activos */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-slate-600 mb-3">Envíos activos</h2>
          {activeShipments.length === 0 ? (
            <div className="text-center py-6 bg-white rounded-lg border border-slate-200 border-dashed">
              <p className="text-slate-500 text-sm">No hay envíos activos</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeShipments.slice(0, 2).map(s => {
                const statusInfo = getStatusInfo(s.status);
                return (
                  <Card key={s.id} className="shadow-sm border-slate-200 hover:shadow-md transition">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-slate-800">{s.client_name}</p>
                          <p className="text-sm text-slate-500 flex items-center gap-1">
                            <MapPin size={14} /> {s.dest_address}
                          </p>
                        </div>
                        <Badge className={`${statusInfo.className} text-xs`}>
                          {statusInfo.label}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100">
                        <span className="text-xs text-slate-400">{formatDate(s.created_at)}</span>
                        <span className="font-bold text-green-600">C$ {s.fee}</span>
                      </div>
                      {s.drivers?.full_name && (
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <Truck size={12} /> {s.drivers.full_name}
                        </div>
                      )}
                      <Link href={`/dashboard/tracking/${s.id}`}>
                        <Button variant="link" className="text-blue-600 text-xs p-0 h-auto mt-1">
                          Ver seguimiento →
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
              {activeShipments.length > 2 && (
                <p className="text-xs text-slate-400 text-center">+ {activeShipments.length - 2} más</p>
              )}
            </div>
          )}
        </div>

        {/* Entregados recientes */}
        <div>
          <h2 className="text-sm font-semibold text-slate-600 mb-3">Entregados recientemente</h2>
          {deliveredToday.length === 0 ? (
            <div className="text-center py-6 bg-white rounded-lg border border-slate-200 border-dashed">
              <p className="text-slate-500 text-sm">No hay entregas hoy</p>
            </div>
          ) : (
            <div className="space-y-3">
              {deliveredToday.slice(0, 2).map(s => (
                <Card key={s.id} className="shadow-sm border-slate-200">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-slate-800">{s.client_name}</p>
                        <p className="text-sm text-slate-500 flex items-center gap-1">
                          <MapPin size={14} /> {s.dest_address}
                        </p>
                      </div>
                      <Badge className="bg-green-100 text-green-700 text-xs">Entregado</Badge>
                    </div>
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100">
                      <span className="text-xs text-slate-400">{formatDate(s.created_at)}</span>
                      <span className="font-bold text-green-600">C$ {s.fee}</span>
                    </div>
                    <Link href={`/dashboard/tracking/${s.id}`}>
                      <Button variant="link" className="text-blue-600 text-xs p-0 h-auto mt-1">Ver detalle →</Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 max-w-lg mx-auto">
        <div className="flex justify-around items-center py-2 px-4">
          <Link href="/dashboard" className="flex flex-col items-center text-blue-600">
            <Home size={22} />
            <span className="text-xs">Inicio</span>
          </Link>
          <Link href="/dashboard/shipments" className="flex flex-col items-center text-slate-400">
            <Package size={22} />
            <span className="text-xs">Envíos</span>
          </Link>
          <Link href="/business/shipments/new" className="relative -mt-6">
            <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center shadow-lg text-white">
              <Plus size={28} />
            </div>
          </Link>
          <Link href="/dashboard/profile" className="flex flex-col items-center text-slate-400">
            <User size={22} />
            <span className="text-xs">Cuenta</span>
          </Link>
        </div>
      </div>
    </div>
  );
}