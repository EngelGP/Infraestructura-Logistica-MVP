'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Inicializar Supabase con Server Client (usa cookies)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: false,
    },
  }
);

export async function createShipment(formData: any) {
  // 1. Obtener el usuario autenticado desde el servidor
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('No autenticado');

  // 2. Obtener el negocio
  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('id, pricing_rule_id')
    .eq('user_id', user.id)
    .single();
  if (bizError || !business) throw new Error('Negocio no encontrado');

  // 3. Obtener la regla de precios
  let ruleQuery = supabase.from('pricing_rules').select('*');
  if (business.pricing_rule_id) {
    ruleQuery = ruleQuery.eq('id', business.pricing_rule_id);
  } else {
    ruleQuery = ruleQuery.eq('is_default', true);
  }
  const { data: rule, error: ruleError } = await ruleQuery.single();
  if (ruleError || !rule) throw new Error('Regla de precios no encontrada');

  // 4. Calcular distancia usando OSRM (desde el servidor)
  const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${formData.originLng},${formData.originLat};${formData.destLng},${formData.destLat}?overview=false`;
  const osrmRes = await fetch(osrmUrl);
  const osrmData = await osrmRes.json();
  const distanceKm = osrmData.routes?.[0]?.distance / 1000 || 0;

  // 5. Calcular tarifa usando la regla
  const baseFee = rule.base_fee || 50;
  const pricePerKm = rule.price_per_km || 10;
  const distanceFee = distanceKm <= 3 ? baseFee : baseFee + (distanceKm - 3) * pricePerKm;
  const fee = Math.round(distanceFee);
  const commission = Math.round(fee * (rule.commission_rate || 0.10));
  const platformFee = rule.platform_fee || 20;

  // 6. Insertar el envío (todo calculado en el servidor)
  const { data: shipment, error: insertError } = await supabase
    .from('shipments')
    .insert({
      business_id: business.id,
      client_name: formData.clientName,
      client_phone: formData.clientPhone,
      origin_address: formData.originAddress,
      dest_address: formData.destAddress,
      fee: fee,
      origin_lat: formData.originLat,
      origin_lng: formData.originLng,
      dest_lat: formData.destLat,
      dest_lng: formData.destLng,
      status: 'created',
      // 🔥 Guardar snapshot financiero
      distance_km: distanceKm,
      base_fee: baseFee,
      price_per_km: pricePerKm,
      commission_amount: commission,
      platform_fee: platformFee,
      driver_earnings: fee - commission,
      pricing_rule_id: rule.id,
      pricing_rule_version: rule.version || 1,
    })
    .select()
    .single();

  if (insertError) throw new Error(insertError.message);
  return { success: true, shipment };
}