import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

// Cliente con Service Role Key (ignora RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { userId, role, extraData } = await req.json();

    if (!userId || !role) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
    }

    // 1. Verificar que quien llama es admin (usando sesión normal)
    const cookieStore = cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name) => cookieStore.get(name)?.value,
        },
      }
    );
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { data: caller } = await supabaseAuth
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (caller?.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // 2. Aprobar perfil
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ status: 'approved' })
      .eq('id', userId);

    if (updateError) throw updateError;

    // 3. Crear negocio o motorizado
    if (role === 'business') {
      const businessName = extraData?.business_name || 'Negocio sin nombre';
      const { error: insertError } = await supabaseAdmin
        .from('businesses')
        .insert({
          user_id: userId,
          business_name: businessName,
          owner_name: extraData?.owner_name || 'Propietario',
          ruc: extraData?.ruc || null,
          address: extraData?.address || null,
          lat: extraData?.lat || null,
          lng: extraData?.lng || null,
          status: 'approved',
        });
      if (insertError) throw insertError;
    } else if (role === 'motorist') {
      const { error: insertError } = await supabaseAdmin
        .from('drivers')
        .insert({
          user_id: userId,
          full_name: extraData?.full_name || 'Motorizado sin nombre',
          license: extraData?.license || null,
          plate: extraData?.plate || null,
          vehicle_model: extraData?.vehicle_model || null,
          vehicle_year: extraData?.vehicle_year || null,
          lat: extraData?.lat || null,
          lng: extraData?.lng || null,
          status: 'approved',
        });
      if (insertError) throw insertError;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error en approve-user:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}