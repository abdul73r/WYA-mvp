'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut as fbSignOut, updateProfile, updatePassword as fbUpdatePassword,
  reauthenticateWithCredential, EmailAuthProvider, deleteUser as fbDeleteUser, User,
} from 'firebase/auth';
import {
  doc, setDoc, serverTimestamp, onSnapshot, updateDoc, deleteDoc,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { clearCart } from './cart';
import type { UserDoc, Role } from './types';

interface AuthCtx {
  user: User | null;
  profile: UserDoc | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, role: Role) => Promise<string>;
  signOut: () => Promise<void>;
  updateDisplayName: (newName: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  deleteAccount: (currentPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setProfile(null);
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, 'users', user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setProfile(snap.exists() ? ({ id: snap.id, ...snap.data() } as UserDoc) : null);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [user]);

  async function signIn(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function signUp(email: string, password: string, name: string, role: Role): Promise<string> {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    await setDoc(doc(db, 'users', cred.user.uid), {
      email,
      name,
      role,
      created_at: serverTimestamp(),
    });
    return cred.user.uid;
  }

  async function signOut() {
    try { clearCart(); } catch {}
    await fbSignOut(auth);
  }

  async function updateDisplayName(newName: string) {
    if (!auth.currentUser) throw new Error('Not signed in');
    const trimmed = newName.trim();
    if (!trimmed) throw new Error('Name cannot be empty');
    await updateProfile(auth.currentUser, { displayName: trimmed });
    await updateDoc(doc(db, 'users', auth.currentUser.uid), { name: trimmed });
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    const u = auth.currentUser;
    if (!u || !u.email) throw new Error('Not signed in');
    if (newPassword.length < 6) throw new Error('New password must be at least 6 characters');
    const cred = EmailAuthProvider.credential(u.email, currentPassword);
    await reauthenticateWithCredential(u, cred);
    await fbUpdatePassword(u, newPassword);
  }

  async function deleteAccount(currentPassword: string) {
    const u = auth.currentUser;
    if (!u || !u.email) throw new Error('Not signed in');
    const cred = EmailAuthProvider.credential(u.email, currentPassword);
    await reauthenticateWithCredential(u, cred);
    try { await deleteDoc(doc(db, 'users', u.uid)); } catch {}
    await fbDeleteUser(u);
    try { clearCart(); } catch {}
  }

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      signIn, signUp, signOut,
      updateDisplayName, changePassword, deleteAccount,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
