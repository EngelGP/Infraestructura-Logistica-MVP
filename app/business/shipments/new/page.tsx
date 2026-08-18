'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import type { LatLng } from 'leaflet';
import dynamic from 'next/dynamic';
import { ChevronLeft, Store, User as UserIcon, Map as MapIcon, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Mapa dinámico
const MapWithGeocoder = dynamic(
  () => import('./MapWithGeocoder'),
  { 
    ssr: false,
    loading: () => (
      <div className="h-[200px] w-full bg-slate-100 rounded-md flex items-center justify-center text-slate-400 text-sm">
        Cargando mapa...
      </div>
    )
  }
);

function calculateFee(distanceKm: number, baseFee: number, pricePerKm: number): number {
  if (distanceKm <= 3) return baseFee;
  return baseFee + (distanceKm - 3) * pricePerKm;
}

export default function NewShipmentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [business, setBusiness] = useState<any>(null);

  // Formulario
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [destAddress, setDestAddress] = useState('');

  const [originCoords, setOriginCoords] = useState<LatLng | null>(null);
  const [destCoords, setDestCoords] = useState<LatLng | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [fee, setFee] = useState<number | null>(null);
  const [platformFee, setPlatformFee] = useState(20);
  const [baseFee, setBaseFee] = useState(50);
  const [pricePerKm, setPricePerKm] = useState(10);
  const [isCalculating, setIsCalculating] = useState(false);

  useEffect(() => {
    const loadBusinessAndRule = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          console.error('Auth error:', authError);
          router.push('/');
          return;
        }

        console.log('🔍 Usuario autenticado:', user.id);

        // 1. Obtener el negocio
        const { data: businessData, error: bizError } = await supabase
          .from('businesses')
          .select('id, business_name, lat, lng, address, pricing_rule_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (bizError) {
          console.error('❌ Error al obtener negocio:', bizError);
          setError('Error al cargar tu negocio. Por favor, intenta de nuevo.');
          return;
        }

        if (!businessData) {
          console.warn('⚠️ No se encontró negocio para el usuario:', user.id);
          setError('No se encontró tu negocio. Por favor, contacta al administrador para configurar tu cuenta.');
          return;
        }

        console.log('✅ Negocio encontrado:', businessData);
        setBusiness(businessData);

        if (businessData.lat && businessData.lng) {
          const L = await import('leaflet');
          setOriginCoords(L.latLng(businessData.lat, businessData.lng));
        } else {
          setError('Tu negocio no tiene ubicación configurada. Por favor, contacta al administrador.');
          return;
        }

        // 2. Obtener la regla de tarifa (si no tiene, usar global)
        let ruleId = businessData.pricing_rule_id;
        let query = supabase.from('pricing_rules').select('*');
        if (ruleId) {
          query = query.eq('id', ruleId);
        } else {
          query = query.eq('is_default', true);
        }
        const { data: ruleData, error: ruleError } = await query.maybeSingle();

        if (ruleError) {
          console.error('❌ Error al obtener regla de tarifa:', ruleError);
          // Usar valores por defecto si falla
          setPlatformFee(20);
          setBaseFee(50);
          setPricePerKm(10);
        } else if (ruleData) {
          setPlatformFee(ruleData.platform_fee ?? 20);
          setBaseFee(ruleData.base_fee ?? 50);
          setPricePerKm(ruleData.price_per_km ?? 10);
          console.log('📊 Regla de tarifa cargada:', ruleData);
        } else {
          console.warn('⚠️ No se encontró regla de tarifa, usando valores por defecto');
        }

      } catch (err) {
        console.error('❌ Error inesperado:', err);
        setError('Ocurrió un error inesperado. Por favor, recarga la página.');
      }
    };

    loadBusinessAndRule();
  }, [router]);

  // Calcular distancia y tarifa
  useEffect(() => {
    if (!originCoords || !destCoords) {
      setDistance(null);
      setFee(null);
      return;
    }

    const calculate = async () => {
      setIsCalculating(true);
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${originCoords.lng},${originCoords.lat};${destCoords.lng},${destCoords.lat}?overview=false`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.routes && data.routes.length > 0) {
          const km = data.routes[0].distance / 1000;
          setDistance(Math.round(km * 10) / 10);
          const calculatedFee = Math.round(calculateFee(km, baseFee, pricePerKm));
          setFee(calculatedFee);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsCalculating(false);
      }
    };

    calculate();
  }, [originCoords, destCoords, baseFee, pricePerKm]);

  const handleSubmit = async () => {
    if (!originCoords || !destCoords || !fee) {
      setError('Faltan datos para crear el envío.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado.');

      const { data: biz, error: bizErr } = await supabase
        .from('businesses')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (bizErr || !biz) throw new Error('No se encontró tu negocio.');

      const { error: insertErr } = await supabase
        .from('shipments')
        .insert([{
          business_id: biz.id,
          client_name: clientName,
          client_phone: clientPhone,
          origin_address: business?.business_name || 'Mi negocio',
          dest_address: destAddress,
          fee: fee,
          origin_lat: originCoords.lat,
          origin_lng: originCoords.lng,
          dest_lat: destCoords.lat,
          dest_lng: destCoords.lng,
          status: 'created'
        }]);

      if (insertErr) throw insertErr;

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Error al crear el envío.');
      setLoading(false);
    }
  };

  if (!business && !error) {
    return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  }

  const totalToPay = fee ? fee + platformFee : 0;

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      <div className="max-w-lg mx-auto p-4">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard" className="text-slate-500 hover:text-slate-800">
            <ChevronLeft size={24} />
          </Link>
          <h1 className="text-xl font-bold text-slate-800">Nuevo Envío</h1>
        </div>

        {error && (
          <div className="bg-red-100 text-red-700 p-4 rounded-md mb-4 text-center border border-red-200">
            <p className="font-semibold">{error}</p>
            <Link href="/dashboard">
              <Button className="mt-2">Volver al Dashboard</Button>
            </Link>
          </div>
        )}

        {!error && (
          <>
            {/* Sección 1: Datos del Cliente */}
            <Card className="shadow-sm border-slate-200 mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <UserIcon size={16} /> Datos del Cliente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label htmlFor="clientName" className="text-xs text-slate-500">Nombre del cliente</Label>
                  <Input id="clientName" placeholder="Ej. María López" value={clientName} onChange={(e) => setClientName(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="clientPhone" className="text-xs text-slate-500">WhatsApp</Label>
                  <Input id="clientPhone" type="tel" placeholder="Ej. 8563-2415" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} className="mt-1" />
                </div>
              </CardContent>
            </Card>

            {/* Sección 2: Origen */}
            <Card className="shadow-sm border-slate-200 mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Store size={16} /> Origen
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-slate-50 p-4 rounded-md border border-slate-200 flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Store size={18} className="text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">{business?.business_name || 'Mi negocio'}</p>
                    {business?.address && <p className="text-sm text-slate-500">{business.address}</p>}
                    {originCoords && (
                      <p className="text-xs text-slate-400 mt-1">📍 {originCoords.lat.toFixed(6)}, {originCoords.lng.toFixed(6)}</p>
                    )}
                  </div>
                  <Button variant="link" className="text-blue-600 text-sm p-0 h-auto">Ver en mapa</Button>
                </div>
              </CardContent>
            </Card>

            {/* Sección 3: Destino */}
            <Card className="shadow-sm border-slate-200 mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <MapIcon size={16} /> Destino
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label htmlFor="destAddress" className="text-xs text-slate-500">Referencia del destino</Label>
                  <Input id="destAddress" placeholder="Ej. Barrio La Luz, casa verde, frente al parque" value={destAddress} onChange={(e) => setDestAddress(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-slate-500 block mb-2">Ubicación exacta en el mapa</Label>
                  <div className="relative">
                    <MapWithGeocoder
                      mode="dest"
                      originCoords={originCoords}
                      destCoords={destCoords}
                      onOriginSelect={() => {}}
                      onDestSelect={setDestCoords}
                      fixedOrigin={true}
                    />
                    {destCoords && (
                      <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full shadow">✅ Ubicado</div>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Haz clic en el mapa para marcar el destino exacto</p>
                </div>
              </CardContent>
            </Card>

            {/* Sección 4: Tarifa */}
            <Card className="shadow-sm border-slate-200 mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <DollarSign size={16} /> Tarifa del Envío
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {distance !== null && fee !== null ? (
                  <>
                    <div className="flex justify-between py-2 border-b border-slate-100">
                      <span className="text-slate-600">Distancia estimada</span>
                      <span className="font-medium">{distance} km</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-100">
                      <span className="text-slate-600">Valor del viaje</span>
                      <span className="font-medium text-blue-600">C$ {fee}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-100">
                      <span className="text-slate-600">Comisión plataforma</span>
                      <span className="font-medium text-orange-600">C$ {platformFee}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t-2 border-slate-200">
                      <span className="font-bold text-base">Total a pagar</span>
                      <span className="font-bold text-xl text-green-600">C$ {totalToPay}</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      * El total incluye el valor del viaje más la comisión de plataforma.
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4 text-slate-500">
                    {isCalculating ? 'Calculando distancia...' : 'Selecciona el destino para calcular la tarifa'}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Botón Confirmar */}
            <Button
              onClick={handleSubmit}
              disabled={loading || !fee || !destCoords}
              className="w-full h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700"
            >
              {loading ? 'Creando...' : `Confirmar Envío C$ ${fee ? totalToPay : ''}`}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}