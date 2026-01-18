import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Profile, UserRole, AppRole } from '@/types/database';

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  tenantId: string | null;
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
    loading: true,
    error: null,
  });

  const fetchUserData = useCallback(async (userId: string) => {
    try {
      // Fetch profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileError) throw profileError;

      // Fetch roles
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (rolesError) throw rolesError;

      const roles = userRoles?.map(r => r.role) || [];

      setState(prev => ({
        ...prev,
        profile,
        roles,
        tenantId: profile?.tenant_id || null,
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
        error: error.message,
      }));
      return { error };
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
    }
  ) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Sign up user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Erro ao criar usuário');

      let tenantId = userData.tenantId;

      // If creating new tenant (for company registration)
      if (!tenantId && userData.tenantNome && userData.tenantSlug) {
        const { data: tenant, error: tenantError } = await supabase
          .from('tenants')
          .insert({
            nome: userData.tenantNome,
            slug: userData.tenantSlug,
          })
          .select()
          .single();

        if (tenantError) throw tenantError;
        tenantId = tenant.id;
      }

      if (!tenantId) throw new Error('Tenant não especificado');

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: authData.user.id,
          tenant_id: tenantId,
          nome_completo: userData.nomeCompleto,
        });

      if (profileError) throw profileError;

      // Assign owner role if creating new tenant
      if (!userData.tenantId && userData.tenantNome) {
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: authData.user.id,
            role: 'owner',
          });

        if (roleError) throw roleError;
      }

      setState(prev => ({ ...prev, loading: false }));
      return { error: null, user: authData.user };
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message,
      }));
      return { error };
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
      loading: false,
      error: null,
    });
  };

  const hasRole = useCallback((role: AppRole): boolean => {
    return state.roles.includes(role);
  }, [state.roles]);

  const hasMinimumRole = useCallback((minimumRole: AppRole): boolean => {
    const roleHierarchy: AppRole[] = ['user', 'manager', 'admin', 'owner'];
    const minimumIndex = roleHierarchy.indexOf(minimumRole);
    return state.roles.some(role => roleHierarchy.indexOf(role) >= minimumIndex);
  }, [state.roles]);

  const isAuthenticated = !!state.user && !!state.profile;

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
