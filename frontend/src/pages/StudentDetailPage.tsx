import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  User,
  Mail,
  Flag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { generateStudentPDF } from '@/utils/pdf.utils';
import { useToastContext } from '@/contexts/ToastContext';
import {
  useStudentDetailForCompany,
  useStudentActivitiesForCompany,
  useUpdateActivityStatus,
  useFinishPracticeProfessional,
} from '@/hooks/usePracticeProfessional';
import { ActivityStatus } from '@/types/practice-professional.types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StudentTabs } from '@/components/students/StudentTabs';
import { StudentInfoTab } from '@/components/students/StudentInfoTab';
import { StudentActivitiesTab } from '@/components/students/StudentActivitiesTab';

export function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToastContext();
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [activitiesPage, setActivitiesPage] = useState(1);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'activities'>('info');
  const activitiesPerPage = 10;

  const { data: studentDetail, isLoading: isLoadingDetail } =
    useStudentDetailForCompany(id || null);
  const { data: activitiesData, isLoading: isLoadingActivities } =
    useStudentActivitiesForCompany(id || null, {
      page: activitiesPage,
      limit: activitiesPerPage,
    });
  const updateStatusMutation = useUpdateActivityStatus();
  const finishPracticeMutation = useFinishPracticeProfessional();

  const student = studentDetail?.student;
  const application = studentDetail?.application;
  const opportunity = studentDetail?.opportunity;
  const activities = activitiesData?.data || [];
  const totalActivitiesPages = activitiesData?.totalPages || 0;

  const isFinalized = application?.finalizedAt ? true : false;

  const handleApprove = useCallback((activityId: string) => {
    setSelectedActivity(activityId);
    setActionType('approve');
    setShowConfirmDialog(true);
  }, []);

  const handleReject = useCallback((activityId: string) => {
    setSelectedActivity(activityId);
    setActionType('reject');
    setRejectionReason('');
    setShowConfirmDialog(true);
  }, []);

  const confirmAction = useCallback(async () => {
    if (!selectedActivity || !actionType) return;

    try {
      await updateStatusMutation.mutateAsync({
        activityId: selectedActivity,
        status:
          actionType === 'approve'
            ? ActivityStatus.APPROVED
            : ActivityStatus.REJECTED,
        rejectionReason: actionType === 'reject' ? rejectionReason : undefined,
      });

      setSelectedActivity(null);
      setActionType(null);
      setRejectionReason('');
      setShowConfirmDialog(false);
    } catch {
      // Error is handled by the mutation
    }
  }, [selectedActivity, actionType, rejectionReason, updateStatusMutation]);

  const handleFinishPractice = useCallback(() => {
    setShowFinishDialog(true);
  }, []);

  const confirmFinishPractice = useCallback(async () => {
    if (!id) return;

    try {
      await finishPracticeMutation.mutateAsync(id);
      setShowFinishDialog(false);
    } catch {
      // Error is handled by the mutation
    }
  }, [id, finishPracticeMutation]);

  const handleDownloadPDF = useCallback(async () => {
    if (!student) {
      toast.error('Error', 'No se pudo obtener la información del estudiante');
      return;
    }

    setIsGeneratingPDF(true);
    try {
      await generateStudentPDF(student, {
        workExperiences: student.workExperience || [],
        education: student.education || [],
        skills: student.skills || [],
        professionalProfile: student.professionalProfile || {},
      });
      toast.success('Éxito', 'PDF generado correctamente');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error desconocido';
      toast.error('Error', `No se pudo generar el PDF: ${errorMessage}`);
    } finally {
      setIsGeneratingPDF(false);
    }
  }, [student, toast]);

  const getActivityStatusBadgeVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'aprobada':
        return 'default';
      case 'rechazada':
        return 'destructive';
      case 'pendiente_aprobacion':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const capitalizeFirst = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  if (isLoadingDetail) {
    return (
      <div className="min-h-screen bg-[#f3f2ef] dark:bg-slate-900 -m-4 sm:-m-6 lg:-m-8 w-[calc(100%+2rem)] sm:w-[calc(100%+3rem)] lg:w-[calc(100%+4rem)]">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
            <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!studentDetail || !student || !application || !opportunity) {
    return (
      <div className="min-h-screen bg-[#f3f2ef] dark:bg-slate-900 -m-4 sm:-m-6 lg:-m-8 w-[calc(100%+2rem)] sm:w-[calc(100%+3rem)] lg:w-[calc(100%+4rem)]">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <CardContent className="py-12 text-center">
              <User className="h-12 w-12 mx-auto mb-4 text-slate-400" />
              <h3 className="text-lg font-semibold mb-2 text-slate-900 dark:text-slate-100">
                Estudiante no encontrado
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                El estudiante no tiene una práctica profesional activa o no tienes permiso para ver esta información.
              </p>
              <Button onClick={() => navigate('/estudiantes')} className="mt-4">
                Volver a Estudiantes
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f2ef] dark:bg-slate-900 -m-4 sm:-m-6 lg:-m-8 w-[calc(100%+2rem)] sm:w-[calc(100%+3rem)] lg:w-[calc(100%+4rem)]">
      <div className="w-full py-4 sm:py-6">
        <div className="px-4 sm:px-6 lg:px-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/estudiantes')}
            className="mb-4 sm:mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Estudiantes
          </Button>
        </div>

        <div className="px-4 sm:px-6 lg:px-8">
          <div className="w-full max-w-full space-y-4 sm:space-y-6">
            {/* Student Header */}
            <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                      {student.firstName} {student.lastName}
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <Mail className="h-4 w-4" />
                        {student.email}
                      </div>
                      {student.phone && (
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                          {student.phone}
                        </div>
                      )}
                      {isFinalized && (
                        <div className="flex items-center gap-2 px-2 py-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-md border border-green-200 dark:border-green-800">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="font-medium">Práctica Finalizada</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {!isFinalized && (
                    <Button
                      onClick={handleFinishPractice}
                      disabled={finishPracticeMutation.isPending}
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      {finishPracticeMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Finalizando...
                        </>
                      ) : (
                        <>
                          <Flag className="h-4 w-4 mr-2" />
                          Finalizar Práctica
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardHeader>
            </Card>

            {/* Tabs */}
            <StudentTabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
              activitiesCount={activitiesData?.total || 0}
            />

            {/* Tab Content */}
            {activeTab === 'info' ? (
              <StudentInfoTab
                student={student}
                application={application}
                opportunity={opportunity}
                isGeneratingPDF={isGeneratingPDF}
                onDownloadPDF={handleDownloadPDF}
              />
            ) : (
              <StudentActivitiesTab
                activities={activities}
                isLoading={isLoadingActivities}
                activitiesPage={activitiesPage}
                totalActivitiesPages={totalActivitiesPages}
                totalActivities={activitiesData?.total || 0}
                activitiesPerPage={activitiesPerPage}
                onPageChange={setActivitiesPage}
                onApprove={handleApprove}
                onReject={handleReject}
                getActivityStatusBadgeVariant={getActivityStatusBadgeVariant}
                capitalizeFirst={capitalizeFirst}
              />
            )}
          </div>
        </div>
      </div>

      {/* Approve/Reject Dialog */}
      <Dialog
        open={showConfirmDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowConfirmDialog(false);
            setSelectedActivity(null);
            setActionType(null);
            setRejectionReason('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionType === 'approve' ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-[#388E3C]" />
                  ¿Aprobar actividad?
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-[#C62828]" />
                  ¿Rechazar actividad?
                </>
              )}
            </DialogTitle>
            <DialogDescription className="pt-2">
              {actionType === 'approve' ? (
                '¿Estás seguro de aprobar esta actividad?'
              ) : (
                <>
                  ¿Estás seguro de rechazar esta actividad? Por favor, proporciona
                  una razón para el rechazo.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {actionType === 'reject' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rejectionReason">
                  Razón de rechazo <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="rejectionReason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Ej: Las horas reportadas no coinciden con las actividades descritas..."
                  rows={4}
                  className="resize-none"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowConfirmDialog(false);
                setSelectedActivity(null);
                setActionType(null);
                setRejectionReason('');
              }}
              className="border-slate-300 dark:border-slate-600 cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmAction}
              disabled={
                (actionType === 'reject' && !rejectionReason.trim()) ||
                updateStatusMutation.isPending
              }
              className={
                actionType === 'approve'
                  ? 'bg-[#388E3C] hover:bg-[#2E7D32] text-white font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'
                  : 'bg-[#C62828] hover:bg-[#B71C1C] text-white font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'
              }
            >
              {updateStatusMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {actionType === 'approve' ? 'Aprobando...' : 'Rechazando...'}
                </>
              ) : actionType === 'approve' ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Confirmar Aprobación
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Confirmar Rechazo
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Finish Practice Dialog */}
      <Dialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-amber-600" />
              Finalizar Práctica Profesional
            </DialogTitle>
            <DialogDescription className="pt-2">
              ¿Estás seguro de que deseas finalizar la práctica profesional de{' '}
              {student?.firstName} {student?.lastName}? Esta acción marcará la
              práctica como completada.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowFinishDialog(false)}
              disabled={finishPracticeMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmFinishPractice}
              disabled={finishPracticeMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {finishPracticeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Finalizando...
                </>
              ) : (
                <>
                  <Flag className="h-4 w-4 mr-2" />
                  Confirmar Finalización
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

