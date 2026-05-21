'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RoleGuard } from '@/components/RoleGuard';
import { CustomerNav } from '@/components/CustomerNav';
import { OwnerNav } from '@/components/OwnerNav';
import { Spinner } from '@/components/Spinner';
import { useAuth } from '@/lib/auth';
import { showToast, ToastHost } from '@/components/Toast';

export default function AccountPage() {
  return (
    <RoleGuard allow={['customer', 'owner']}>
      <Account />
      <ToastHost />
    </RoleGuard>
  );
}

function Account() {
  const router = useRouter();
  const { user, profile, updateDisplayName, changePassword, deleteAccount, signOut } = useAuth();
  const isOwner = profile?.role === 'owner';

  const [name, setName] = useState(profile?.name || '');
  const [savingName, setSavingName] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [changingPw, setChangingPw] = useState(false);

  const [delPw, setDelPw] = useState('');
  const [deletingAcct, setDeletingAcct] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  async function onSaveName() {
    if (!name.trim() || name.trim() === profile?.name) return;
    setSavingName(true);
    try {
      await updateDisplayName(name);
      showToast('Name updated');
    } catch (e: any) {
      showToast(e?.message || 'Could not update name');
    } finally { setSavingName(false); }
  }

  async function onChangePassword() {
    if (!currentPw || !newPw) return;
    setChangingPw(true);
    try {
      await changePassword(currentPw, newPw);
      showToast('Password updated');
      setCurrentPw(''); setNewPw('');
    } catch (e: any) {
      showToast(e?.message?.replace('Firebase:', '').trim() || 'Could not change password');
    } finally { setChangingPw(false); }
  }

  async function onDeleteAccount() {
    if (!delPw) return;
    if (!confirm('This permanently deletes your account and removes you from any followed trucks. Continue?')) return;
    setDeletingAcct(true);
    try {
      await deleteAccount(delPw);
      router.replace('/');
    } catch (e: any) {
      showToast(e?.message?.replace('Firebase:', '').trim() || 'Could not delete account');
      setDeletingAcct(false);
    }
  }

  return (
    <>
      <div className="min-h-screen max-w-md mx-auto pb-28 page-enter">
        <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur border-b border-stroke px-5 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-surface border border-stroke grid place-items-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          <h1 className="text-lg font-bold flex-1">Account settings</h1>
        </header>

        {/* Profile */}
        <h2 className="px-5 mt-5 text-xs uppercase tracking-widest text-text-muted font-bold">Profile</h2>
        <div className="px-5 mt-2 flex flex-col gap-3">
          <div>
            <label className="field-label">Display name</label>
            <div className="flex gap-2">
              <input className="input flex-1" value={name} onChange={(e) => setName(e.target.value)} />
              <button className="btn primary" onClick={onSaveName} disabled={savingName || !name.trim() || name.trim() === profile?.name}>
                {savingName ? <Spinner /> : 'Save'}
              </button>
            </div>
          </div>
          <div>
            <label className="field-label">Email</label>
            <input className="input" value={user?.email || ''} disabled />
            <div className="text-[11px] text-text-muted mt-1">Email changes aren’t supported in the MVP. Contact support if you need this.</div>
          </div>
          <div>
            <label className="field-label">Account type</label>
            <div className="input flex items-center capitalize">{profile?.role}</div>
          </div>
        </div>

        {/* Password */}
        <h2 className="px-5 mt-7 text-xs uppercase tracking-widest text-text-muted font-bold">Change password</h2>
        <div className="px-5 mt-2 flex flex-col gap-3">
          <div>
            <label className="field-label">Current password</label>
            <input className="input" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="••••••••" />
          </div>
          <div>
            <label className="field-label">New password</label>
            <input className="input" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="At least 6 characters" />
          </div>
          <button className="btn primary block" onClick={onChangePassword} disabled={changingPw || !currentPw || newPw.length < 6}>
            {changingPw ? <Spinner /> : 'Update password'}
          </button>
        </div>

        {/* Notifications */}
        <h2 className="px-5 mt-7 text-xs uppercase tracking-widest text-text-muted font-bold">Notifications</h2>
        <div className="px-5 mt-2">
          <div className="card p-4 text-sm text-text-muted">
            In-app notifications are always on (live alerts, order status, follows). Browser push notifications coming soon.
          </div>
        </div>

        {/* Sign out */}
        <div className="px-5 mt-7">
          <button onClick={async () => { await signOut(); router.replace('/'); }} className="btn block">
            Sign out
          </button>
        </div>

        {/* Danger zone */}
        <h2 className="px-5 mt-7 text-xs uppercase tracking-widest text-accent font-bold">Danger zone</h2>
        <div className="px-5 mt-2">
          {!showDelete ? (
            <button onClick={() => setShowDelete(true)} className="btn danger block">
              Delete my account
            </button>
          ) : (
            <div className="card p-4 flex flex-col gap-3">
              <div className="text-sm">
                Deleting your account is permanent. We'll keep order records for tax purposes but your profile is removed.
              </div>
              <input className="input" type="password" value={delPw} onChange={(e) => setDelPw(e.target.value)} placeholder="Enter your current password to confirm" />
              <div className="flex gap-2">
                <button className="btn ghost" onClick={() => { setShowDelete(false); setDelPw(''); }}>Cancel</button>
                <button className="btn danger block" onClick={onDeleteAccount} disabled={deletingAcct || !delPw}>
                  {deletingAcct ? <Spinner /> : 'Permanently delete account'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {isOwner ? <OwnerNav /> : <CustomerNav />}
    </>
  );
}
