"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

function ProtectedInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);

  const returnTo = typeof window !== 'undefined'
    ? `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ''}`
    : '/palpites';

  useEffect(() => {
    let mounted = true;
    
    const checkAuth = async () => {
      try {
        const { data: sessData } = await supabase.auth.getSession();
        if (!mounted) return;
        
        if (sessData.session) {
          setLoading(false);
          return;
        }
        
        const { data: userData } = await supabase.auth.getUser();
        if (!mounted) return;
        
        if (userData.user) {
          setLoading(false);
          return;
        }
        
        router.replace(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
      } catch {
        router.replace(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
      }
    };

    checkAuth();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setLoading(false);
      } else {
        router.replace(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [router, returnTo]);

  if (loading) return <div className="p-8">Carregando...</div>;
  return <>{children}</>;
}

export default function Protected({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-8">Carregando...</div>}>
      <ProtectedInner>{children}</ProtectedInner>
    </Suspense>
  );
}