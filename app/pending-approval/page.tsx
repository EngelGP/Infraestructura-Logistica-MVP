'use client';

import Link from 'next/link';

export default function PendingApproval() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white p-8 rounded-xl shadow-sm max-w-md w-full text-center">
        <div className="text-5xl mb-4">⏳</div>
        <h1 className="text-2xl font-bold text-slate-800">¡Registro exitoso!</h1>
        <p className="text-slate-600 mt-2">
          Tu cuenta ha sido creada. Un administrador revisará tus datos y te aprobará en las próximas 24 horas.
        </p>
        <p className="text-sm text-slate-400 mt-4">
          Recibirás un correo cuando tu cuenta esté activa.
        </p>
        <Link href="/" className="inline-block mt-6 text-blue-600 hover:underline">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}