import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Copy, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useCreateUser,
  useUpdateUser,
} from '@/hooks/useUsers';
import { useToastContext } from '@/contexts/ToastContext';
import type { User as UserType, CreateUserDto } from '@/types/user.types';

const userSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  email: z.string().email('El email debe ser válido').min(1, 'El email es requerido'),
});

type UserFormData = z.infer<typeof userSchema>;

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: UserType | null;
  onSuccess?: (generatedPassword?: string) => void;
}

export function UserFormDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
}: UserFormDialogProps) {
  const isEditing = !!user;
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const toast = useToastContext();
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
  });

  useEffect(() => {
    if (open) {
      if (user) {
        reset({
          name: user.name,
          email: user.email,
        });
      } else {
        reset({
          name: '',
          email: '',
        });
      }
    }
  }, [open, user, reset]);

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        setGeneratedPassword(null);
        setCopied(false);
      }
      onOpenChange(newOpen);
    },
    [onOpenChange],
  );

  const onSubmit = async (data: UserFormData) => {
    try {
      const userData: CreateUserDto = {
        name: data.name,
        email: data.email,
      };

      if (isEditing && user) {
        await updateMutation.mutateAsync({
          id: user._id,
          data: userData,
        });
        toast.success(
          'Usuario actualizado',
          `El usuario "${data.name}" ha sido actualizado correctamente.`,
        );
        onOpenChange(false);
        onSuccess?.();
      } else {
        const response = await createMutation.mutateAsync(userData);
        setGeneratedPassword(response.generatedPassword);
        toast.success(
          'Usuario creado',
          `El usuario "${data.name}" ha sido creado correctamente.`,
        );
        onSuccess?.(response.generatedPassword);
      }
    } catch (error: unknown) {
      const errorMessage =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Error al guardar el usuario';
      toast.error('Error al guardar', errorMessage);
    }
  };

  const handleCopyPassword = async () => {
    if (generatedPassword) {
      try {
        await navigator.clipboard.writeText(generatedPassword);
        setCopied(true);
        toast.success('Contraseña copiada', 'La contraseña ha sido copiada al portapapeles.');
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error('Error al copiar', 'No se pudo copiar la contraseña.');
      }
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {isEditing ? 'Editar Usuario Administrador' : 'Nuevo Usuario Administrador'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modifica la información del usuario administrador'
              : 'Completa los datos para registrar un nuevo usuario administrador'}
          </DialogDescription>
        </DialogHeader>

        {generatedPassword && !isEditing && (
          <div className="p-4 bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800 rounded-lg">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-primary-900 dark:text-primary-100 mb-1">
                  Contraseña generada
                </p>
                <p className="text-xs text-primary-700 dark:text-primary-300 mb-2">
                  Copia esta contraseña para enviarla al usuario por correo
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-primary-200 dark:border-primary-700 rounded text-sm font-mono text-slate-900 dark:text-slate-100">
                    {generatedPassword}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyPassword}
                    className="flex-shrink-0"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">
              Nombre completo <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="Juan Pérez"
              className="focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">
              Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              {...register('email')}
              placeholder="juan.perez@itca.edu.sv"
              className="focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              {generatedPassword ? 'Cerrar' : 'Cancelar'}
            </Button>
            {!generatedPassword && (
              <Button type="submit" disabled={isLoading}>
                {isLoading
                  ? 'Guardando...'
                  : isEditing
                    ? 'Actualizar'
                    : 'Crear'}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

