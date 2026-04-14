import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type UserRole = 'student' | 'teacher' | 'admin';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: UserRole | null;
  fullName: string | null;
  rollNo: string | null;
  loading: boolean;
  roleLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  role: null,
  fullName: null,
  rollNo: null,
  loading: true,
  roleLoading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [rollNo, setRollNo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(true);

  const fetchUserRole = async (userId: string, metadataRole?: string) => {
    setRoleLoading(true);

    let resolvedRole: UserRole | null = null;
    if (metadataRole && ['student', 'teacher', 'admin'].includes(metadataRole)) {
      resolvedRole = metadataRole as UserRole;
    }

    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();

    if (data && !error && (data as any).role) {
      resolvedRole = (data as any).role as UserRole;
    }

    setRole(resolvedRole);
    setRoleLoading(false);
  };

  const fetchUserProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, enrollment_number')
      .eq('user_id', userId)
      .maybeSingle();
    if (data && !error) {
      setFullName((data as any).full_name);
      setRollNo((data as any).enrollment_number);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Defer role and profile fetching with setTimeout to prevent deadlock
        if (session?.user) {
          const metadataRole = (session.user.user_metadata as any)?.role;
          setTimeout(() => {
            fetchUserRole(session.user.id, metadataRole);
            fetchUserProfile(session.user.id);
          }, 0);
        } else {
          setRole(null);
          setFullName(null);
          setRollNo(null);
          setRoleLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (session?.user) {
        const metadataRole = (session.user.user_metadata as any)?.role;
        fetchUserRole(session.user.id, metadataRole);
        fetchUserProfile(session.user.id);
      } else {
        setRoleLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setFullName(null);
    setRollNo(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, fullName, rollNo, loading, roleLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
