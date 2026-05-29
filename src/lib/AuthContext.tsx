import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserRole } from '@/types';
import { genericService } from './firestoreService';
import { seedDatabase } from './seed';

export interface UserData {
  uid: string;
  matricula: string;
  displayName: string;
  role: UserRole;
  password?: string; // Optional because we don't want it in the session necessarily
}

export interface AuthContextType {
  user: any | null; 
  userData: UserData | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const DEFAULT_USERS: UserData[] = [
  { uid: 'u1', matricula: 'roberto', displayName: 'Roberto', role: 'Supervisor', password: '1234' },
  { uid: 'u2', matricula: 'aloir', displayName: 'Aloir', role: 'Supervisor', password: '1234' },
  { uid: 'u3', matricula: 'cleito', displayName: 'Cleito', role: 'Admin', password: '1234' },
  { uid: 'u4', matricula: 'arthur', displayName: 'Arthur', role: 'Admin', password: '1234' },
  { uid: 'u5', matricula: 'luiz henrique', displayName: 'Luiz Henrique', role: 'Supervisor', password: '1234' },
  { uid: 'u6', matricula: 'reinaldo', displayName: 'Reinaldo', role: 'Supervisor', password: '1234' },
  { uid: 'u7', matricula: 'marcio', displayName: 'Márcio', role: 'Supervisor', password: '1234' },
  { uid: 'u8', matricula: 'arthursouza1106@gmail.com', displayName: 'Arthur Souza', role: 'Admin', password: '1234' },
];

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  userData: null, 
  loading: true, 
  login: async () => ({ success: false }),
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check for active session first for instant UI response (0ms)
        const session = localStorage.getItem('vigiguard_session');
        if (session) {
          try {
            const data = JSON.parse(session);
            setUserData(data);
          } catch (e) {
            localStorage.removeItem('vigiguard_session');
          }
        }
        
        // Silently run the self-healing seedDatabase verification in the background in all cases,
        // so that new devices can immediately download/sync registrations and default users can log in.
        setTimeout(async () => {
          try {
            await seedDatabase();
          } catch (bgError) {
            console.warn('[Firestore] Background seeding/sync took a little longer:', bgError);
          }
        }, 500);

      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const normalizedUsername = username.toLowerCase().trim();
      
      // 1. Check DEFAULT_USERS or local cached users FIRST for immediate 0ms response
      let foundUser = DEFAULT_USERS.find(u => u.matricula.toLowerCase() === normalizedUsername);
      
      if (!foundUser) {
        try {
          const cachedStr = localStorage.getItem('vigi_db_users');
          if (cachedStr) {
            const cachedUsers = JSON.parse(cachedStr) as UserData[];
            foundUser = cachedUsers.find(u => u.matricula.toLowerCase() === normalizedUsername);
          }
        } catch (e) {
          console.warn('[Auth] Error checking local users cache:', e);
        }
      }

      if (foundUser && foundUser.password === password) {
        // Create session instantly
        const sessionData = { ...foundUser };
        delete sessionData.password;
        setUserData(sessionData);
        localStorage.setItem('vigiguard_session', JSON.stringify(sessionData));
        
        // Silently sync from cloud in background to update cache
        genericService.list<UserData>('users').catch(() => {});
        return { success: true };
      }

      // 2. If not found or if password has been changed/different, query cloud immediately
      const allUsers = await genericService.list<UserData>('users');
      const cloudUser = allUsers.find(u => u.matricula.toLowerCase() === normalizedUsername);

      if (cloudUser && cloudUser.password === password) {
        const sessionData = { ...cloudUser };
        delete sessionData.password;
        setUserData(sessionData);
        localStorage.setItem('vigiguard_session', JSON.stringify(sessionData));
        return { success: true };
      }

      return { success: false, error: 'Nome ou senha incorretos' };
    } catch (err) {
      return { success: false, error: 'Erro ao conectar ao servidor' };
    }
  };

  const logout = async () => {
    localStorage.removeItem('vigiguard_session');
    setUserData(null);
  };

  return (
    <AuthContext.Provider value={{ 
      user: userData, 
      userData, 
      loading, 
      login, 
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
