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

interface ImpersonatedUser {
  uid: string;
  name: string;
  deviceId: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  impersonatedUser: ImpersonatedUser | null;
  setImpersonatedUser: (user: ImpersonatedUser | null) => void;
  activeDeviceId: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  impersonatedUser: null,
  setImpersonatedUser: () => {},
  activeDeviceId: null,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [impersonatedUser, setImpersonatedUser] = useState<ImpersonatedUser | null>(null);

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
  const activeDeviceId = isAdmin && impersonatedUser ? impersonatedUser.deviceId : (profile?.device_id || null);

  const value = {
    user,
    profile,
    loading,
    isAdmin,
    impersonatedUser,
    setImpersonatedUser,
    activeDeviceId,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
