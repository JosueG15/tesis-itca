import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authApi, setAuthToken } from '@/lib/api';
import { encryptedStorage } from '@/lib/storage.utils';
import type { LoginRequest, RegisterRequest, LoginResponse } from '@/types/auth.types';

export function useLogin() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: LoginRequest) => authApi.login(data),
    onSuccess: async (data: LoginResponse) => {
      await Promise.all([
        encryptedStorage.setItem('token', data.access_token),
        encryptedStorage.setItem('user', JSON.stringify(data.user)),
      ]);
      await setAuthToken(data.access_token);
      queryClient.setQueryData(['user'], data.user);
      queryClient.setQueryData(['auth'], data);
      
      if (data.user.isTemporaryPassword && data.user.role === 'estudiante') {
        navigate('/settings?changePassword=true', { replace: true });
      } else if (data.user.isProfileIncomplete && data.user.role === 'estudiante') {
        navigate('/settings', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: RegisterRequest) => authApi.register(data),
    onSuccess: async (data: LoginResponse) => {
      await Promise.all([
        encryptedStorage.setItem('token', data.access_token),
        encryptedStorage.setItem('user', JSON.stringify(data.user)),
      ]);
      await setAuthToken(data.access_token);
      queryClient.setQueryData(['user'], data.user);
      queryClient.setQueryData(['auth'], data);
      
      if (data.user.isProfileIncomplete && data.user.role === 'estudiante') {
        navigate('/settings', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    },
  });
}





