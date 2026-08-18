'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MapPin, Phone, User, Package, CheckCircle, Truck, Clock } from 'lucide-react';
import Link from 'next/link';

export default function TrackingPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [shipment, setShipment] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);
  const [driver, setDriver] = useState<any>(null);

  useEffect(() => {
    const loadTracking = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.push('/');
        return;
      }

      const { data: shipmentData, error: shipError } = await supabase
        .from('shipments')
        .select(`
          *,
          businesses:business_id (id, business_name, lat, lng, address),
          drivers:motorist_id (id, full_name, plate, lat, lng)
        `)
        .eq('id', id)
        .maybeSingle();

      if (shipError || !shipmentData) {
        console.error('Error al cargar seguimiento:', shipError);
        return;
      }

      setShipment(shipmentData);
      if (shipmentData.businesses) setBusiness(shipmentData.businesses);
      if (shipmentData.drivers) setDriver(shipmentData.drivers);
      setLoading(false);
    };

    loadTracking();
    const interval = setInterval(loadTracking, 5000);
    return () => clearInterval(interval);
  }, [id, router]);

  const getStatusStep = (currentStatus: string) => {
    const steps = ['created', 'accepted', 'picked_up', 'in_transit', 'delivered'];
    const currentIndex = steps.indexOf(currentStatus);
    const labels = ['Pedido creado', 'Asignado', 'Recogido', 'En camino', 'Entregado'];
    return { currentIndex, labels, steps };
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Cargando seguimiento...</div>;
  }

  if (!shipment) {
    return <div className="min-h-screen flex items-center justify-center">Envío no encontrado</div>;
  }

  const { currentIndex, labels, steps } = getStatusStep(shipment.status);
  const isCompleted = shipment.status === 'delivered' || shipment.status === 'completed';

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="max-w-lg mx-auto p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard" className="text-slate-500 hover:text-slate-800">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-xl font-bold text-slate-800">Seguimiento del Envío</h1>
        </div>

        {/* Estado actual */}
        <Card className={`shadow-sm border ${isCompleted ? 'border-green-200' : 'border-blue-200'} mb-4`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              {isCompleted ? (
                <CheckCircle size={20} className="text-green-600" />
              ) : (
                <Truck size={20} className="text-blue-600" />
              )}
              <span className="font-semibold text-slate-800">
                {isCompleted ? 'Entregado' : shipment.status === 'in_transit' ? 'En camino' : shipment.status}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {isCompleted ? 'El envío fue entregado' : 'Tu pedido va en camino al destino'}
            </p>
            <p className="text-xs text-slate-400 mt-1">{formatDate(shipment.updated_at)}</p>
          </CardContent>
        </Card>

        {/* Origen y destino */}
        <Card className="shadow-sm border-slate-200 mb-4">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0"></div>
              <div>
                <p className="text-xs text-slate-500 font-semibold">ORIGEN</p>
                <p className="font-medium text-slate-800">{business?.business_name || 'Negocio'}</p>
                <p className="text-sm text-slate-500">{business?.address || shipment.origin_address}</p>
              </div>
            </div>
            <div className="border-t border-slate-100"></div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-red-500 mt-2 flex-shrink-0"></div>
              <div>
                <p className="text-xs text-slate-500 font-semibold">DESTINO</p>
                <p className="font-medium text-slate-800">{shipment.dest_address}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Información del repartidor */}
        {driver && (
          <Card className="shadow-sm border-slate-200 mb-4">
            <CardContent className="p-4 flex items-start gap-3">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                <User size={20} className="text-indigo-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-800">{driver.full_name}</p>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>⭐ 4.9</span>
                  <span>•</span>
                  <span>📩 {driver.plate || 'Sin placa'}</span>
                </div>
                {driver.phone && (
                  <a href={`tel:${driver.phone}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1">
                    <Phone size={12} /> {driver.phone}
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Progreso */}
        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Progreso del envío</h3>
            <div className="space-y-3">
              {labels.map((label, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`
                      w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                      ${index <= currentIndex ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-600'}
                    `}>
                      {index < currentIndex ? <CheckCircle size={14} /> : index + 1}
                    </div>
                    {index < labels.length - 1 && (
                      <div className={`w-0.5 h-6 ${index < currentIndex ? 'bg-green-500' : 'bg-slate-200'}`} />
                    )}
                  </div>
                  <div className={`flex-1 ${index <= currentIndex ? 'text-slate-800' : 'text-slate-400'}`}>
                    <p className="text-sm font-medium">{label}</p>
                    {index === currentIndex && shipment.status === 'delivered' && (
                      <p className="text-xs text-green-600">✅ Completado</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tarifa */}
        <div className="mt-4 p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
          <span className="text-sm text-slate-600">Tarifa del envío</span>
          <span className="font-bold text-green-600">C$ {shipment.fee}</span>
        </div>

        {/* Mapa (placeholder) */}
        <div className="mt-4 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="h-48 bg-slate-100 rounded-md flex items-center justify-center text-slate-400 text-sm">
            🗺️ Mapa en tiempo real (próximamente)
          </div>
          <p className="text-xs text-slate-400 text-center mt-2">Ubicación del repartidor actualizada en vivo</p>
        </div>
      </div>
    </div>
  );
}