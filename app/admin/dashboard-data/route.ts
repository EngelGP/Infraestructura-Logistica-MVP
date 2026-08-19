import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Cliente con Service Role Key (ignora RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // Obtener perfiles (todos)
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    // Obtener negocios (todos)
    const { data: businesses, error: bizError } = await supabaseAdmin
      .from('businesses')
      .select('*');

    // Obtener motorizados (todos)
    const { data: drivers, error: driversError } = await supabaseAdmin
      .from('drivers')
      .select('*');

    // Obtener envíos recientes
    const { data: shipments, error: shipmentsError } = await supabaseAdmin
      .from('shipments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    // Métricas (totales)
    const { count: totalShipments } = await supabaseAdmin
      .from('shipments')
      .select('*', { count: 'exact', head: true });

    const { count: totalBusinesses } = await supabaseAdmin
      .from('businesses')
      .select('*', { count: 'exact', head: true });

    const { count: totalDrivers } = await supabaseAdmin
      .from('drivers')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      profiles,
      businesses,
      drivers,
      shipments,
      metrics: {
        totalShipments: totalShipments || 0,
        totalBusinesses: totalBusinesses || 0,
        totalDrivers: totalDrivers || 0,
      }
    });

  } catch (error) {
    return NextResponse.json({ error: 'Error al cargar datos' }, { status: 500 });
  }
}