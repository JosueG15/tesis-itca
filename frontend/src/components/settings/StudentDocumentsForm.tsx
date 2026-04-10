import { useState, useCallback, useEffect } from "react";
import { FileText, Upload, Loader2, CheckCircle2, XCircle, AlertCircle, Eye, X, Check, Clock, ArrowRight, ArrowLeft, Trash2 } from "lucide-react";
import { useMyStudent } from "@/hooks/useStudents";
import { useToast } from "@/hooks/useToast";
import { studentsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function StudentDocumentsForm() {
  const { data: student, isLoading, refetch } = useMyStudent();
  const { success, error: showError } = useToast();
  const [uploading, setUploading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  
  // Estados para el paso 2
  const [uploadingSubjects, setUploadingSubjects] = useState(false);
  const [validatingSubjects, setValidatingSubjects] = useState(false);
  const [selectedSubjectsFile, setSelectedSubjectsFile] = useState<File | null>(null);
  const [previewSubjectsUrl, setPreviewSubjectsUrl] = useState<string | null>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        showError("Error", "Solo se permiten archivos PDF");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        showError("Error", "El archivo no puede ser mayor a 10MB");
        return;
      }
      setSelectedFile(file);
      
      // Crear URL de previsualización
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  }, [showError]);

  // Limpiar URLs de previsualización cuando se desmonte el componente o cambie el archivo
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      if (previewSubjectsUrl) {
        URL.revokeObjectURL(previewSubjectsUrl);
      }
    };
  }, [previewUrl, previewSubjectsUrl]);

  const handleClearSelection = useCallback(() => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    // Resetear el input
    const input = window.document.getElementById('document-upload');
    if (input && input instanceof HTMLInputElement) {
      input.value = '';
    }
  }, [previewUrl]);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) {
      showError("Error", "Por favor selecciona un archivo");
      return;
    }

    setUploading(true);
    setValidating(true);

    try {
      const formData = new FormData();
      formData.append("document", selectedFile);

      const result = await studentsApi.uploadSocialServiceDocument(formData);
      
      // El documento siempre se guarda, incluso si no es válido
      await refetch();
      setSelectedFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      
      if (result.validation?.isValid) {
        success(
          "Documento validado",
          "Tu solvencia de horas sociales ha sido validada y guardada exitosamente."
        );
      } else {
        showError(
          "Documento inválido",
          result.validation?.errors?.join(". ") || 
          "El documento no cumple con los requisitos. El archivo ha sido guardado para revisión."
        );
      }
    } catch (error: unknown) {
      // El documento ya está guardado en el servidor, solo refrescamos para ver el estado
      await refetch();
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "El documento ha sido guardado pero no pasó la validación. Revisa los detalles a continuación.";
      showError("Documento inválido", message);
    } finally {
      setUploading(false);
      setValidating(false);
    }
  }, [selectedFile, showError, success, refetch]);

  if (isLoading) {
    return (
      <Card className="border-2 border-slate-200 dark:border-slate-800">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const document = student?.socialServiceDocument;
  const hasDocument = !!document;
  const hasValidDocument = document?.isValidated === true;
  const showUploadSection = !hasValidDocument || selectedFile;

  const subjectsDocument = student?.passedSubjectsDocument;
  const hasValidSubjectsDocument = subjectsDocument?.isValidated === true;

  const steps = [
    {
      number: 1,
      title: "Solvencia de horas sociales",
      description: "Sube tu solvencia de horas sociales para validación",
    },
    {
      number: 2,
      title: "Validación de materias",
      description: "Coming soon",
    },
    {
      number: 3,
      title: "Comprobante de inscripción",
      description: "Coming soon",
    },
  ];

  return (
    <Card className="border-2 border-slate-200 dark:border-slate-800">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl">Documentación</CardTitle>
            <CardDescription className="mt-1">
              Completa los pasos para finalizar tu documentación
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stepper */}
        <div className="relative">
          <div className="flex items-center justify-between mb-8">
            {steps.map((step, index) => {
              const isActive = activeStep === step.number;
              let isCompleted = false;
              
              // Determinar si el paso está completado
              if (step.number === 1) {
                isCompleted = hasValidDocument;
              } else if (step.number === 2) {
                isCompleted = hasValidSubjectsDocument;
              }
              
              const isLast = index === steps.length - 1;

              return (
                <div key={step.number} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => setActiveStep(step.number as 1 | 2 | 3)}
                      className={cn(
                        "relative flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all cursor-pointer hover:scale-105",
                        isActive
                          ? "bg-primary border-primary text-white"
                          : isCompleted
                          ? "bg-green-500 border-green-500 text-white"
                          : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-400"
                      )}
                    >
                      {isCompleted ? (
                        <Check className="h-6 w-6" />
                      ) : (
                        <span className="text-sm font-semibold">{step.number}</span>
                      )}
                    </button>
                    <div className="mt-2 text-center max-w-[120px]">
                      <p
                        className={cn(
                          "text-xs font-medium",
                          isActive
                            ? "text-primary"
                            : isCompleted
                            ? "text-green-600 dark:text-green-400"
                            : "text-slate-500 dark:text-slate-400"
                        )}
                      >
                        {step.title}
                      </p>
                    </div>
                  </div>
                  {!isLast && (
                    <div
                      className={cn(
                        "flex-1 h-0.5 mx-4 transition-colors",
                        (isCompleted || (step.number === 1 && hasValidDocument && activeStep > step.number)) || isActive
                          ? "bg-primary"
                          : "bg-slate-300 dark:bg-slate-600"
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="min-h-[400px]">
          {/* Step 1: Solvencia de horas sociales */}
          {activeStep === 1 && (
            <div className="space-y-6">
              {hasDocument && (
                <div className="space-y-3">
                  {hasValidDocument ? (
              <Alert className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <AlertTitle className="text-green-800 dark:text-green-200">
                      Documento validado
                    </AlertTitle>
                    <AlertDescription className="text-green-700 dark:text-green-300">
                      Tu solvencia de horas sociales ha sido validada exitosamente.
                      {document.validatedAt && (
                        <span className="block mt-1 text-xs">
                          Validado el: {new Date(document.validatedAt).toLocaleString()}
                        </span>
                      )}
                      {document.filePath && (
                        <a
                          href={`http://localhost:3000/${document.filePath}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block mt-2 text-sm underline hover:text-green-800 dark:hover:text-green-200"
                        >
                          Ver documento
                        </a>
                      )}
                    </AlertDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      if (confirm('¿Estás seguro de que deseas eliminar este documento y todas sus validaciones?')) {
                        try {
                          await studentsApi.deleteSocialServiceDocument();
                          await refetch();
                          success("Documento eliminado", "El documento de solvencia de horas sociales ha sido eliminado exitosamente.");
                        } catch (error: unknown) {
                          const message =
                            (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                            "Error al eliminar el documento";
                          showError("Error", message);
                        }
                      }
                    }}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Alert>
            ) : (
              <Alert className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    <AlertTitle className="text-red-800 dark:text-red-200">
                      Documento no válido
                    </AlertTitle>
                    <AlertDescription className="text-red-700 dark:text-red-300">
                      El documento fue guardado pero no pasó la validación.
                      {document.validatedAt && (
                        <span className="block mt-1 text-xs">
                          Validado el: {new Date(document.validatedAt).toLocaleString()}
                        </span>
                      )}
                      {document.filePath && (
                        <a
                          href={`http://localhost:3000/${document.filePath}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block mt-2 text-sm underline hover:text-red-800 dark:hover:text-red-200"
                        >
                          Ver documento
                        </a>
                      )}
                    </AlertDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      if (confirm('¿Estás seguro de que deseas eliminar este documento y todas sus validaciones?')) {
                        try {
                          await studentsApi.deleteSocialServiceDocument();
                          await refetch();
                          success("Documento eliminado", "El documento de solvencia de horas sociales ha sido eliminado exitosamente.");
                        } catch (error: unknown) {
                          const message =
                            (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                            "Error al eliminar el documento";
                          showError("Error", message);
                        }
                      }
                    }}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Alert>
            )}

                  {document.validationErrors && document.validationErrors.length > 0 && (
              <Alert className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <AlertTitle className="text-red-800 dark:text-red-200">
                  Errores de validación
                </AlertTitle>
                <AlertDescription className="text-red-700 dark:text-red-300">
                  <ul className="list-disc list-inside space-y-1 mt-2">
                    {document.validationErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
                  )}

                  {document.validationWarnings && document.validationWarnings.length > 0 && (
              <Alert className="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20">
                <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                <AlertTitle className="text-yellow-800 dark:text-yellow-200">
                  Advertencias
                </AlertTitle>
                <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                  <ul className="list-disc list-inside space-y-1 mt-2">
                    {document.validationWarnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
                  )}

                  {(document.hasValidFormat !== undefined || document.hasValidStamp !== undefined) && (
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg space-y-2">
                {document.hasValidFormat !== undefined && (
                  <div className="flex items-center gap-2">
                    {document.hasValidFormat ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="text-sm font-medium">
                      Formato del documento: {document.hasValidFormat ? "Válido" : "Inválido"}
                    </span>
                  </div>
                )}
                {document.hasValidStamp !== undefined && (
                  <div className="flex items-center gap-2">
                    {document.hasValidStamp ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="text-sm font-medium">
                      Sello válido: {document.hasValidStamp ? "Encontrado" : "No encontrado"}
                    </span>
                  </div>
                )}
                </div>
                  )}
                </div>
              )}

              {showUploadSection && (
                <div className="space-y-4">
                  <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="document-upload"
                  className="text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Solvencia de Horas Sociales (PDF)
                </label>
                {hasValidDocument && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const input = window.document.getElementById('document-upload');
                      if (input && input instanceof HTMLInputElement) {
                        input.click();
                      }
                    }}
                    disabled={uploading || validating}
                  >
                    Reemplazar documento
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <input
                    id="document-upload"
                    type="file"
                    accept=".pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={uploading || validating}
                  />
                  <label
                    htmlFor="document-upload"
                    className={cn(
                      "flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
                      uploading || validating
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800",
                      selectedFile
                        ? "border-primary bg-primary/5"
                        : "border-slate-300 dark:border-slate-700"
                    )}
                  >
                    <Upload className="h-5 w-5" />
                    <span className="text-sm font-medium">
                      {selectedFile ? selectedFile.name : "Seleccionar archivo PDF"}
                    </span>
                  </label>
                </div>
                {selectedFile && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClearSelection}
                      disabled={uploading || validating}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={handleUpload}
                      disabled={uploading || validating}
                      className="flex-shrink-0"
                    >
                      {uploading || validating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {validating ? "Validando..." : "Subiendo..."}
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Subir y Validar
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      El documento debe ser un PDF que cumpla con el formato oficial y contenga uno de los sellos válidos.
                      Tamaño máximo: 10MB
                    </p>
                  </div>

                  {previewUrl && selectedFile && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Previsualización del documento
                  </label>
                </div>
                <div className="border-2 border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                  <iframe
                    src={previewUrl}
                    className="w-full h-[600px]"
                    title="Previsualización del documento PDF"
                  />
                    </div>
                  </div>
                  )}
                </div>
              )}

              {/* Botones de navegación */}
              <div className="flex justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="flex-1" />
                <div className="flex gap-2">
                  {activeStep > 1 && (
                    <Button
                      variant="outline"
                      onClick={() => setActiveStep((activeStep - 1) as 1 | 2 | 3)}
                      className="flex items-center gap-2"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                  )}
                  {activeStep < 3 && (
                    <Button
                      onClick={() => setActiveStep((activeStep + 1) as 1 | 2 | 3)}
                      className="flex items-center gap-2"
                    >
                      Siguiente
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Validación de materias */}
          {activeStep === 2 && (
            <div className="space-y-6">
              {(() => {
                const subjectsDoc = student?.passedSubjectsDocument;
                const hasSubjectsDoc = !!subjectsDoc;
                const hasValidSubjectsDoc = subjectsDoc?.isValidated === true;
                const showUploadSubjectsSection = !hasValidSubjectsDoc || selectedSubjectsFile;

                return (
                  <>
                    {hasSubjectsDoc && (
                      <div className="space-y-3">
                        {hasValidSubjectsDoc ? (
                          <Alert className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                                <AlertTitle className="text-green-800 dark:text-green-200">
                                  Documento validado
                                </AlertTitle>
                                <AlertDescription className="text-green-700 dark:text-green-300">
                                  Tu documento de materias ganadas ha sido validado exitosamente.
                                  {subjectsDoc.validatedAt && (
                                    <span className="block mt-1 text-xs">
                                      Validado el: {new Date(subjectsDoc.validatedAt).toLocaleString()}
                                    </span>
                                  )}
                                  {subjectsDoc.passedCount !== undefined && subjectsDoc.totalSubjects !== undefined && (
                                    <span className="block mt-2 text-sm font-medium">
                                      Materias ganadas: {subjectsDoc.passedCount} de {subjectsDoc.totalSubjects}
                                    </span>
                                  )}
                                </AlertDescription>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  if (confirm('¿Estás seguro de que deseas eliminar este documento y todas sus validaciones?')) {
                                    try {
                                      await studentsApi.deletePassedSubjectsDocument();
                                      await refetch();
                                      success("Documento eliminado", "El documento de materias ganadas ha sido eliminado exitosamente.");
                                    } catch (error: unknown) {
                                      const message =
                                        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                                        "Error al eliminar el documento";
                                      showError("Error", message);
                                    }
                                  }
                                }}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </Alert>
                        ) : (
                          <Alert className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                                <AlertTitle className="text-red-800 dark:text-red-200">
                                  Documento no válido
                                </AlertTitle>
                                <AlertDescription className="text-red-700 dark:text-red-300">
                                  El documento fue guardado pero no pasó la validación.
                                  {subjectsDoc.validatedAt && (
                                    <span className="block mt-1 text-xs">
                                      Validado el: {new Date(subjectsDoc.validatedAt).toLocaleString()}
                                    </span>
                                  )}
                                </AlertDescription>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  if (confirm('¿Estás seguro de que deseas eliminar este documento y todas sus validaciones?')) {
                                    try {
                                      await studentsApi.deletePassedSubjectsDocument();
                                      await refetch();
                                      success("Documento eliminado", "El documento de materias ganadas ha sido eliminado exitosamente.");
                                    } catch (error: unknown) {
                                      const message =
                                        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                                        "Error al eliminar el documento";
                                      showError("Error", message);
                                    }
                                  }
                                }}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </Alert>
                        )}

                        {subjectsDoc.validationErrors && subjectsDoc.validationErrors.length > 0 && (
                          <Alert className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
                            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                            <AlertTitle className="text-red-800 dark:text-red-200">
                              Errores de validación
                            </AlertTitle>
                            <AlertDescription className="text-red-700 dark:text-red-300">
                              <ul className="list-disc list-inside space-y-1 mt-2">
                                {subjectsDoc.validationErrors.map((error: string, index: number) => (
                                  <li key={index}>{error}</li>
                                ))}
                              </ul>
                            </AlertDescription>
                          </Alert>
                        )}

                        {subjectsDoc.passedSubjects && subjectsDoc.passedSubjects.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                              Materias Ganadas ({subjectsDoc.passedSubjects.length})
                            </h4>
                            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                              <div className="max-h-[500px] overflow-y-auto">
                                <table className="w-full text-sm">
                                  <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0">
                                    <tr>
                                      <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                                        Ciclo
                                      </th>
                                      <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                                        Código
                                      </th>
                                      <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                                        Materia
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {subjectsDoc.passedSubjects.map((subject: { cycle: string; code: string; name: string }, index: number) => (
                                      <tr
                                        key={index}
                                        className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                                      >
                                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                                          {subject.cycle}
                                        </td>
                                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-mono">
                                          {subject.code}
                                        </td>
                                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                                          {subject.name}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {showUploadSubjectsSection && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label
                              htmlFor="subjects-document-upload"
                              className="text-sm font-medium text-slate-700 dark:text-slate-300"
                            >
                              Documento de Materias Ganadas (PDF)
                            </label>
                            {hasValidSubjectsDoc && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const input = window.document.getElementById('subjects-document-upload');
                                  if (input && input instanceof HTMLInputElement) {
                                    input.click();
                                  }
                                }}
                                disabled={uploadingSubjects || validatingSubjects}
                              >
                                Reemplazar documento
                              </Button>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <input
                                id="subjects-document-upload"
                                type="file"
                                accept=".pdf"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    if (file.type !== "application/pdf") {
                                      showError("Error", "Solo se permiten archivos PDF");
                                      return;
                                    }
                                    if (file.size > 10 * 1024 * 1024) {
                                      showError("Error", "El archivo no puede ser mayor a 10MB");
                                      return;
                                    }
                                    setSelectedSubjectsFile(file);
                                    const url = URL.createObjectURL(file);
                                    setPreviewSubjectsUrl(url);
                                  }
                                }}
                                className="hidden"
                                disabled={uploadingSubjects || validatingSubjects}
                              />
                              <label
                                htmlFor="subjects-document-upload"
                                className={cn(
                                  "flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
                                  uploadingSubjects || validatingSubjects
                                    ? "opacity-50 cursor-not-allowed"
                                    : "hover:bg-slate-50 dark:hover:bg-slate-800",
                                  selectedSubjectsFile
                                    ? "border-primary bg-primary/5"
                                    : "border-slate-300 dark:border-slate-700"
                                )}
                              >
                                <Upload className="h-5 w-5" />
                                <span className="text-sm font-medium">
                                  {selectedSubjectsFile ? selectedSubjectsFile.name : "Seleccionar archivo PDF"}
                                </span>
                              </label>
                            </div>
                            {selectedSubjectsFile && (
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedSubjectsFile(null);
                                    if (previewSubjectsUrl) {
                                      URL.revokeObjectURL(previewSubjectsUrl);
                                      setPreviewSubjectsUrl(null);
                                    }
                                    const input = window.document.getElementById('subjects-document-upload');
                                    if (input && input instanceof HTMLInputElement) {
                                      input.value = '';
                                    }
                                  }}
                                  disabled={uploadingSubjects || validatingSubjects}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                                <Button
                                  onClick={async () => {
                                    if (!selectedSubjectsFile) {
                                      showError("Error", "Por favor selecciona un archivo");
                                      return;
                                    }

                                    setUploadingSubjects(true);
                                    setValidatingSubjects(true);

                                    try {
                                      const formData = new FormData();
                                      formData.append("document", selectedSubjectsFile);

                                      await studentsApi.uploadPassedSubjectsDocument(formData);
                                      
                                      await refetch();
                                      setSelectedSubjectsFile(null);
                                      if (previewSubjectsUrl) {
                                        URL.revokeObjectURL(previewSubjectsUrl);
                                        setPreviewSubjectsUrl(null);
                                      }
                                      
                                      success(
                                        "Documento validado",
                                        "Tu documento de materias ganadas ha sido validado y guardado exitosamente."
                                      );
                                    } catch (error: unknown) {
                                      await refetch();
                                      const message =
                                        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                                        "El documento ha sido guardado pero no pasó la validación. Revisa los detalles a continuación.";
                                      showError("Documento inválido", message);
                                    } finally {
                                      setUploadingSubjects(false);
                                      setValidatingSubjects(false);
                                    }
                                  }}
                                  disabled={uploadingSubjects || validatingSubjects}
                                  className="flex-shrink-0"
                                >
                                  {uploadingSubjects || validatingSubjects ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      {validatingSubjects ? "Validando..." : "Subiendo..."}
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="mr-2 h-4 w-4" />
                                      Subir y Validar
                                    </>
                                  )}
                                </Button>
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            El documento debe ser un PDF con el formato oficial de materias ganadas del ITCA.
                            Tamaño máximo: 10MB
                          </p>
                        </div>

                        {previewSubjectsUrl && selectedSubjectsFile && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <Eye className="h-4 w-4" />
                                Previsualización del documento
                              </label>
                            </div>
                            <div className="border-2 border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                              <iframe
                                src={previewSubjectsUrl}
                                className="w-full h-[600px]"
                                title="Previsualización del documento PDF"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Botones de navegación */}
                    <div className="flex justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
                      <Button
                        variant="outline"
                        onClick={() => setActiveStep(1)}
                        className="flex items-center gap-2"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Anterior
                      </Button>
                      {activeStep < 3 && (
                        <Button
                          onClick={() => setActiveStep(3)}
                          className="flex items-center gap-2"
                        >
                          Siguiente
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* Step 3: Comprobante de inscripción */}
          {activeStep === 3 && (
            <div className="space-y-6">
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800">
                  <Clock className="h-12 w-12 text-slate-400" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                    Comprobante de inscripción
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    Esta funcionalidad estará disponible próximamente
                  </p>
                </div>
              </div>
              
              {/* Botones de navegación */}
              <div className="flex justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
                <Button
                  variant="outline"
                  onClick={() => setActiveStep(2)}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <div className="flex-1" />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

