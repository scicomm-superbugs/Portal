import { createContext, useState, useEffect, useContext } from 'react';
import { db, getFirebaseAuth } from '../db';
import { signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider } from 'firebase/auth';
import bcrypt from 'bcryptjs';
import { Capacitor } from '@capacitor/core';

const isMedian = () => {
  return typeof window !== 'undefined' && (
    !!window.gonative || 
    !!window.median || 
    navigator.userAgent.toLowerCase().includes('gonative') ||
    navigator.userAgent.toLowerCase().includes('median')
  );
};

const isCapacitor = () => {
  return (typeof window !== 'undefined' && (
    window.Capacitor?.isNative || 
    !!window.Capacitor?.Commands ||
    navigator.userAgent.toLowerCase().includes('capacitor') ||
    window.location.protocol === 'capacitor:' ||
    !!window.android
  ));
};

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
      } else {
        const storedUserId = localStorage.getItem('userId');
        if (storedUserId) {
          setUser({ uid: storedUserId, email: 'user@local.db' });
        } else {
          setUser(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive.file');
    
    try {
      const auth = getFirebaseAuth();
      let gUser, token;
      
      if (isCapacitor()) {
        const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
        const result = await FirebaseAuthentication.signInWithGoogle();
        
        if (result.credential && result.credential.idToken) {
          const { signInWithCredential } = await import('firebase/auth');
          const credential = GoogleAuthProvider.credential(result.credential.idToken);
          const webResult = await signInWithCredential(auth, credential);
          gUser = webResult.user;
          token = result.credential.accessToken;
        } else {
          gUser = result.user;
        }
      } else if (isMedian()) {
        if (window.median && window.median.google && window.median.google.login) {
          const medianResult = await window.median.google.login({
            scopes: ['profile', 'email', 'https://www.googleapis.com/auth/drive.file']
          });
          const { signInWithCredential } = await import('firebase/auth');
          const credential = GoogleAuthProvider.credential(medianResult.idToken);
          const webResult = await signInWithCredential(auth, credential);
          gUser = webResult.user;
          token = medianResult.accessToken;
        }
      } else {
        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        gUser = result.user;
        token = credential.accessToken;
      }

      if (gUser) {
        setUser(gUser);
        localStorage.setItem('userId', gUser.uid);
        if (token) localStorage.setItem('googleDriveToken', token);
        return gUser;
      }
    } catch (error) {
      console.error('Google login error:', error);
      throw error;
    }
  };

  const linkGoogleAccount = async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive.file');
    
    try {
      const auth = getFirebaseAuth();
      let gUser, token;

      if (isCapacitor()) {
        const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
        const result = await FirebaseAuthentication.signInWithGoogle();
        
        if (result.credential && result.credential.idToken) {
          const { signInWithCredential } = await import('firebase/auth');
          const credential = GoogleAuthProvider.credential(result.credential.idToken);
          const webResult = await signInWithCredential(auth, credential);
          gUser = webResult.user;
          token = result.credential.accessToken;
        } else {
          gUser = result.user;
        }
      } else if (isMedian()) {
        if (window.median && window.median.google && window.median.google.login) {
          const medianResult = await window.median.google.login({
            scopes: ['profile', 'email', 'https://www.googleapis.com/auth/drive.file']
          });
          const { signInWithCredential } = await import('firebase/auth');
          const credential = GoogleAuthProvider.credential(medianResult.idToken);
          const webResult = await signInWithCredential(auth, credential);
          gUser = webResult.user;
          token = medianResult.accessToken;
        }
      } else {
        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        gUser = result.user;
        token = credential.accessToken;
      }

      if (gUser) {
        setUser(gUser);
        localStorage.setItem('userId', gUser.uid);
        if (token) localStorage.setItem('googleDriveToken', token);
        return gUser;
      }
    } catch (error) {
      console.error('Account link error:', error);
      throw error;
    }
  };

  const logout = async () => {
    const auth = getFirebaseAuth();
    await auth.signOut();
    setUser(null);
    localStorage.removeItem('userId');
    localStorage.removeItem('googleDriveToken');
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, logout, linkGoogleAccount }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
