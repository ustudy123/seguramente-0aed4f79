import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Profile, UserRole, AppRole } from '@/types/database';
import { translateError } from '@/lib/translateError';

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  tenantId: string | null;
  isSuperAdmin: boolean;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    roles: [],
    tenantId: null,
    isSuperAdmin: false,
    loading: true,
    error: null,
  });

  const fetchUserData = useCallback(async (userId: string) => {
    try {
      // Fetch profile, roles, and superadmin status in parallel
      const [profileResult, rolesResult, superadminResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId),
        supabase
          .from('superadmins')
          .select('id')
          .eq('user_id', userId)
          .eq('ativo', true)
          .maybeSingle()
      ]);

      if (profileResult.error) throw profileResult.error;
      if (rolesResult.error) throw rolesResult.error;
      // superadmin query might fail due to RLS on first load, ignore

      const roles = rolesResult.data?.map(r => r.role) || [];
      const isSuperAdmin = roles.includes('superadmin') || !!superadminResult.data;

      setState(prev => ({
        ...prev,
        profile: profileResult.data,
        roles,
        tenantId: profileResult.data?.tenant_id || null,
        isSuperAdmin,
        loading: false,
        error: null,
      }));
    } catch (error) {
      console.error('Error fetching user data:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Erro ao carregar dados do usuário',
      }));
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setState(prev => ({
          ...prev,
          user: session?.user || null,
          session,
        }));

        if (session?.user) {
          // Use setTimeout to avoid potential race conditions
          setTimeout(() => fetchUserData(session.user.id), 0);
        } else {
          setState(prev => ({
            ...prev,
            profile: null,
            roles: [],
            tenantId: null,
            loading: false,
          }));
        }
      }
    );

    // THEN check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState(prev => ({
        ...prev,
        user: session?.user || null,
        session,
      }));

      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setState(prev => ({ ...prev, loading: false }));
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

  const signIn = async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: translateError(error.message),
      }));
      return { error: { ...error, message: translateError(error.message) } };
    }

    return { error: null };
  };

  const signUp = async (
    email: string,
    password: string,
    userData: {
      nomeCompleto: string;
      tenantId?: string;
      tenantNome?: string;
      tenantSlug?: string;
      tipoPessoa?: string;
      documento?: string;
    }
  ) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Sign up user
      // Use the published URL for email redirects to avoid localhost issues
      const appUrl = "https://youreyes.com.br";
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: appUrl,
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Erro ao criar usuário');

      let tenantId = userData.tenantId;

      // If creating new tenant (company registration), do it via edge function
      // using Service Role key (bypasses RLS safely).
      if (!tenantId && userData.tenantNome && userData.tenantSlug) {
        const { data, error: fnError } = await supabase.functions.invoke(
          'onboarding-signup',
          {
            body: {
              tenantNome: userData.tenantNome,
              tenantSlug: userData.tenantSlug,
              nomeCompleto: userData.nomeCompleto,
              tipoPessoa: userData.tipoPessoa,
              documento: userData.documento,
            },
          }
        );

        if (fnError) throw fnError;
        tenantId = (data as any)?.tenantId;
      }

      if (!tenantId) throw new Error('Tenant não especificado');

      // Create profile (only when joining an existing tenant)
      if (userData.tenantId) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: authData.user.id,
            tenant_id: tenantId,
            nome_completo: userData.nomeCompleto,
          });

        if (profileError) throw profileError;
      }

      // Assign owner role when joining existing tenant is not applicable here.
      // Owner role is assigned inside the edge function for company registration.

      setState(prev => ({ ...prev, loading: false }));
      return { error: null, user: authData.user };
    } catch (error: any) {
      const translatedMsg = translateError(error.message);
      setState(prev => ({
        ...prev,
        loading: false,
        error: translatedMsg,
      }));
      return { error: { ...error, message: translatedMsg } };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setState({
      user: null,
      session: null,
      profile: null,
      roles: [],
      tenantId: null,
      isSuperAdmin: false,
      loading: false,
      error: null,
    });
  };

  const hasRole = useCallback((role: AppRole): boolean => {
    return state.roles.includes(role);
  }, [state.roles]);

  const hasMinimumRole = useCallback((minimumRole: AppRole): boolean => {
    // Superadmin tem acesso a tudo
    if (state.roles.includes('superadmin')) return true;
    const roleHierarchy: AppRole[] = ['user', 'manager', 'admin', 'owner', 'superadmin'];
    const minimumIndex = roleHierarchy.indexOf(minimumRole);
    return state.roles.some(role => roleHierarchy.indexOf(role) >= minimumIndex);
  }, [state.roles]);

  // Superadmins podem não ter profile (não pertencem a um tenant específico)
  const isAuthenticated = !!state.user && (!!state.profile || state.isSuperAdmin);

  return {
    ...state,
    isAuthenticated,
    signIn,
    signUp,
    signOut,
    hasRole,
    hasMinimumRole,
    refetch: () => state.user && fetchUserData(state.user.id),
  };
}
