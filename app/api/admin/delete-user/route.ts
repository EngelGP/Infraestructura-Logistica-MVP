// This is the API route for deleting a user and their associated data in Supabase.
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Inicializar Supabase con la Service Role Key (permisos totales)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'Falta el ID del usuario' }, { status: 400 });
    }

    // 1. Eliminar registros relacionados en negocios o motorizados (si existen)
    // Primero verificamos si es negocio
    const { data: business } = await supabaseAdmin
      .from('businesses')
      .select('id')
      .eq('user_id', userId)
      .single();
    
    if (business) {
      await supabaseAdmin.from('businesses').delete().eq('user_id', userId);
    }

    // Verificamos si es motorizado
    const { data: driver } = await supabaseAdmin
      .from('drivers')
      .select('id')
      .eq('user_id', userId)
      .single();
    
    if (driver) {
      await supabaseAdmin.from('drivers').delete().eq('user_id', userId);
    }

    // 2. Eliminar el perfil de la tabla profiles
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileError) {
      console.error('Error al eliminar profile:', profileError);
      // Si falla, intentamos continuar con auth
    }

    // 3. Eliminar el usuario de auth.users
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authError) {
      console.error('Error al eliminar auth user:', authError);
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Usuario eliminado correctamente' });

  } catch (error: any) {
    console.error('Error en delete-user API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}