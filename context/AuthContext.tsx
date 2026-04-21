import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { ref, onValue, off } from 'firebase/database';
import { auth, db } from '../lib/firebase';

interface UserProfile {
  email: string;
  device_id?: string;
  role: 'admin' | 'user';
  name?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  adminSelectedDeviceId: string | null;
  setAdminSelectedDeviceId: (id: string | null) => void;
  activeDeviceId: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  adminSelectedDeviceId: null,
  setAdminSelectedDeviceId: () => {},
  activeDeviceId: null,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminSelectedDeviceId, setAdminSelectedDeviceId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Fetch user profile from Realtime DB
        const userRef = ref(db, `users/${firebaseUser.uid}`);
        
        const unsubscribeProfile = onValue(userRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            setProfile(data);
          } else {
            // Default profile if not found
            setProfile({
              email: firebaseUser.email || '',
              role: 'user',
            });
          }
          setLoading(false);
        });

        return () => {
          off(userRef);
          unsubscribeProfile();
        };
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const isAdmin = profile?.role === 'admin';
  const activeDeviceId = isAdmin && adminSelectedDeviceId ? adminSelectedDeviceId : (profile?.device_id || null);

  const value = {
    user,
    profile,
    loading,
    isAdmin,
    adminSelectedDeviceId,
    setAdminSelectedDeviceId,
    activeDeviceId,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
