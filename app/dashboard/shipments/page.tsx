'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowLeft, MapPin, Package, CheckCircle, Truck, Clock } from 'lucide-react';
import Link from 'next/link';

export default function ShipmentsListPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [shipments, setShipments] = useState<any[]>([]);
  const [businessId, setBusinessId] = useState<string | null>(null);

  useEffect(() => {
    const loadShipments = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.push('/');
        return;
      }

      const { data: businessData, error: bizError } = await supabase
        .from('businesses')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (bizError || !businessData) {
        setLoading(false);
        return;
      }

      setBusinessId(businessData.id);

      const { data: shipmentsData, error: shipError } = await supabase
        .from('shipments')
        .select(`
          *,
          drivers (full_name)
        `)
        .eq('business_id', businessData.id)
        .order('created_at', { ascending: false });

      if (!shipError && shipmentsData) {
        setShipments(shipmentsData);
      }
      setLoading(false);
    };

    loadShipments();
  }, [router]);

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

  const getStatusBadge = (status: string) => {
    const map: Record<string, any> = {
      created: { label: 'Creado', className: 'bg-slate-200 text-slate-800' },
      accepted: { label: 'Aceptado', className: 'bg-blue-100 text-blue-800' },
      picked_up: { label: 'Recogido', className: 'bg-amber-100 text-amber-800' },
      in_transit: { label: 'En camino', className: 'bg-indigo-100 text-indigo-800' },
      delivered: { label: 'Entregado', className: 'bg-green-100 text-green-800' },
      completed: { label: 'Completado', className: 'bg-green-200 text-green-800' },
      cancelled: { label: 'Cancelado', className: 'bg-red-100 text-red-800' },
    };
    const s = map[status] || { label: status, className: 'bg-slate-200 text-slate-800' };
    return <Badge className={`${s.className} text-xs`}>{s.label}</Badge>;
  };

  const activeShipments = shipments.filter(s => ['created','accepted','picked_up','in_transit'].includes(s.status));
  const completedShipments = shipments.filter(s => ['delivered','completed','cancelled'].includes(s.status));

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="max-w-lg mx-auto p-4">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard" className="text-slate-500 hover:text-slate-800">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-xl font-bold text-slate-800">Envíos</h1>
        </div>

        <Tabs defaultValue="activos" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="activos">Activos ({activeShipments.length})</TabsTrigger>
            <TabsTrigger value="historial">Historial ({completedShipments.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="activos" className="space-y-3">
            {activeShipments.length === 0 ? (
              <div className="text-center py-8 bg-white rounded-lg border border-slate-200 border-dashed">
                <p className="text-slate-500">No hay envíos activos</p>
              </div>
            ) : (
              activeShipments.map(s => (
                <Card key={s.id} className="shadow-sm border-slate-200 hover:shadow-md transition">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-slate-800">{s.client_name}</p>
                        <p className="text-sm text-slate-500 flex items-center gap-1">
                          <MapPin size={14} /> {s.dest_address}
                        </p>
                      </div>
                      {getStatusBadge(s.status)}
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
              ))
            )}
          </TabsContent>

          <TabsContent value="historial" className="space-y-3">
            {completedShipments.length === 0 ? (
              <div className="text-center py-8 bg-white rounded-lg border border-slate-200 border-dashed">
                <p className="text-slate-500">No hay envíos en el historial</p>
              </div>
            ) : (
              completedShipments.map(s => (
                <Card key={s.id} className="shadow-sm border-slate-200">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-slate-800">{s.client_name}</p>
                        <p className="text-sm text-slate-500 flex items-center gap-1">
                          <MapPin size={14} /> {s.dest_address}
                        </p>
                      </div>
                      {getStatusBadge(s.status)}
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
                        Ver detalle →
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}