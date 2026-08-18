'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Store, Phone, MapPin, CreditCard, Settings, LogOut, User } from 'lucide-react';
import Link from 'next/link';

export default function BusinessProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<any>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.push('/');
        return;
      }
      setUser(user);

      const { data: businessData, error: bizError } = await supabase
        .from('businesses')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (bizError || !businessData) {
        setLoading(false);
        return;
      }

      setBusiness(businessData);
      setLoading(false);
    };

    loadProfile();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Cargando perfil...</div>;
  }

  if (!business) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <p className="text-slate-500">No tienes un negocio registrado.</p>
        <Button onClick={() => router.push('/dashboard')} className="mt-4">Volver</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="max-w-lg mx-auto p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard" className="text-slate-500 hover:text-slate-800">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-xl font-bold text-slate-800">Cuenta</h1>
        </div>

        {/* Información del negocio */}
        <Card className="shadow-sm border-slate-200 mb-6">
          <CardContent className="p-4 flex items-start gap-4">
            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Store size={24} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-slate-800">{business.business_name}</h2>
              <p className="text-sm text-slate-500 flex items-center gap-1">
                <Phone size={14} /> {user?.phone || 'Sin teléfono'}
              </p>
              {business.address && (
                <p className="text-sm text-slate-500 flex items-center gap-1">
                  <MapPin size={14} /> {business.address}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Saldo virtual */}
        <Card className="shadow-sm border-slate-200 mb-6 bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">Saldo virtual</p>
            <p className="text-3xl font-bold text-blue-600">C$ 350.00</p>
            <Button variant="outline" size="sm" className="mt-2 border-blue-300 text-blue-600 hover:bg-blue-50">
              <CreditCard size={14} className="mr-1" /> Recargar saldo
            </Button>
          </CardContent>
        </Card>

        {/* Configuración */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Configuración</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <button className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-slate-50 transition">
              <Store size={18} className="text-slate-500" />
              <span className="text-sm text-slate-700">Información del negocio</span>
            </button>
            <button className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-slate-50 transition">
              <CreditCard size={18} className="text-slate-500" />
              <span className="text-sm text-slate-700">Métodos de pago</span>
            </button>
            <button className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-slate-50 transition">
              <Settings size={18} className="text-slate-500" />
              <span className="text-sm text-slate-700">Notificaciones</span>
            </button>
          </CardContent>
        </Card>

        {/* Cerrar sesión */}
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full mt-6 text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <LogOut size={18} className="mr-2" /> Cerrar sesión
        </Button>
      </div>
    </div>
  );
}