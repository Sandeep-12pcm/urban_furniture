import { createContext, useContext } from 'react';

export const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider.');
  return context;
}

export function canManageMasterData(role) {
  return role === 'ADMIN' || role === 'ACCOUNTANT';
}

export function canArchiveMasterData(role) {
  return role === 'ADMIN';
}
