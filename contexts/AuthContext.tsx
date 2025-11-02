import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { AuthContextType, Profile, Subscription, UserUsage } from '../lib/auth-types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UserUsage | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    return data;
  };

  const fetchSubscription = async (userId: string) => {
    const { data, error } = await supabase
      .from('subscriptions')
      .select(`
        *,
        plan:subscription_plans(*)
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
      .gte('current_period_end', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching subscription:', error);
      return null;
    }
    return data;
  };

  const fetchUsage = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_usage')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching usage:', error);
      return null;
    }
    return data;
  };

  const loadUserData = async (currentUser: User) => {
    setLoading(true);
    try {
      const [profileData, subscriptionData, usageData] = await Promise.all([
        fetchProfile(currentUser.id),
        fetchSubscription(currentUser.id),
        fetchUsage(currentUser.id)
      ]);

      setProfile(profileData);
      setSubscription(subscriptionData);
      setUsage(usageData);
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          loadUserData(session.user);
        } else {
          setProfile(null);
          setSubscription(null);
          setUsage(null);
          setLoading(false);
        }
      }
    );

    return () => {
      authSubscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    });

    if (error) throw error;

    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        email: data.user.email!,
        full_name: fullName
      });

      const { data: freePlan } = await supabase
        .from('subscription_plans')
        .select('id')
        .eq('name', 'free')
        .single();

      if (freePlan) {
        await supabase.from('subscriptions').insert({
          user_id: data.user.id,
          plan_id: freePlan.id,
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        });

        await supabase.from('user_usage').insert({
          user_id: data.user.id,
          conversions_used: 0,
          period_start: new Date().toISOString(),
          period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        });
      }
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    if (error) throw error;
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    if (error) throw error;
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) throw new Error('No user logged in');

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (error) throw error;

    if (user) {
      await loadUserData(user);
    }
  };

  const refreshSubscription = async () => {
    if (user) {
      const subscriptionData = await fetchSubscription(user.id);
      const usageData = await fetchUsage(user.id);
      setSubscription(subscriptionData);
      setUsage(usageData);
    }
  };

  const canConvert = (): boolean => {
    if (!user || !subscription) return false;

    const plan = subscription.plan;
    if (!plan) return false;

    if (plan.pdf_limit === null) return true;

    const used = usage?.conversions_used || 0;
    return used < plan.pdf_limit;
  };

  const remainingConversions = (): number => {
    if (!user || !subscription) return 0;

    const plan = subscription.plan;
    if (!plan) return 0;

    if (plan.pdf_limit === null) return -1;

    const used = usage?.conversions_used || 0;
    return Math.max(0, plan.pdf_limit - used);
  };

  const value: AuthContextType = {
    user,
    profile,
    subscription,
    usage,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    updateProfile,
    refreshSubscription,
    canConvert,
    remainingConversions
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
