import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';

const execAsync = promisify(exec);

/**
 * Resultado de la validación de un documento de solvencia de horas sociales
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  hasValidStamp: boolean;
  hasValidFormat: boolean;
}

/**
 * Resultado de la validación de un documento de materias ganadas
 */
export interface PassedSubjectsValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  hasValidFormat: boolean;
  passedSubjects: Array<{
    cycle: string;
    code: string;
    subject: string;
  }>;
  totalSubjects: number;
  passedCount: number;
}

/**
 * Análisis de OpenAI sobre el documento de materias ganadas
 */
interface PassedSubjectsOpenAIAnalysis {
  isValid: boolean;
  hasValidFormat: boolean;
  errors: string[];
  warnings: string[];
  passedSubjects: Array<{
    cycle: string;
    code: string;
    subject: string;
  }>;
  totalSubjects: number;
  passedCount: number;
  reasoning?: string;
}

/**
 * Análisis de OpenAI sobre el documento
 */
interface OpenAIAnalysis {
  isValid: boolean;
  hasValidFormat: boolean;
  hasValidStamp: boolean;
  errors: string[];
  warnings: string[];
  reasoning?: string;
}

/**
 * Configuración para la conversión de PDF a imágenes usando pdf-poppler
 */
const PDF_TO_IMAGE_CONFIG = {
  scale: 2.0, // Escala para pdf-poppler (2.0 = 200% de resolución)
  imageFormat: 'image/png' as const,
} as const;

/**
 * Configuración para la API de OpenAI
 */
const OPENAI_CONFIG = {
  model: 'gpt-4o',
  maxTokens: 1500,
  temperature: 0.3,
} as const;

/**
 * Valida un documento de solvencia de horas sociales usando OpenAI GPT-4 Vision
 *
 * @param documentPath - Ruta del archivo PDF a validar
 * @param configService - Servicio de configuración de NestJS
 * @returns Resultado de la validación con errores y advertencias
 */
export async function validateSocialServiceDocumentWithOpenAI(
  documentPath: string,
  configService: ConfigService,
): Promise<ValidationResult> {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    hasValidStamp: false,
    hasValidFormat: false,
  };

  try {
    // Validar configuración de OpenAI
    const openaiApiKey = configService.get<string>('openai.apiKey');
    if (!openaiApiKey) {
      throw new Error(
        'OPENAI_API_KEY no está configurada. Por favor, agrega OPENAI_API_KEY a tu archivo .env',
      );
    }

    // Inicializar cliente de OpenAI
    const openai = new OpenAI({ apiKey: openaiApiKey });

    // Obtener rutas de archivos de referencia
    const referencePath = getReferenceDocumentPath();
    const stampImagePath = getStampImagePath();

    // Convertir PDFs a imágenes de alta calidad
    console.log('Convirtiendo documento PDF a imágenes de alta calidad...');
    const documentImages = await convertPdfToImages(documentPath);
    
    if (documentImages.length === 0) {
      throw new Error('No se pudieron generar imágenes del documento PDF');
    }
    
    console.log(`Documento convertido: ${documentImages.length} página(s)`);
    
    const referenceImages = fs.existsSync(referencePath)
      ? await convertPdfToImages(referencePath)
      : [];
    
    // Leer imagen del sello directamente (PNG)
    const stampImageBase64 = fs.existsSync(stampImagePath)
      ? fs.readFileSync(stampImagePath).toString('base64')
      : null;
    
    if (!stampImageBase64) {
      console.warn('Advertencia: No se encontró la imagen del sello de referencia');
    }

    // Construir mensajes para OpenAI
    const messages = buildOpenAIMessages(
      documentImages,
      referenceImages,
      stampImageBase64,
    );

    // Realizar validación con OpenAI
    const analysis = await validateWithOpenAI(openai, messages);

    // Procesar resultado
    result.isValid = analysis.isValid ?? false;
    result.hasValidFormat = analysis.hasValidFormat ?? false;
    result.hasValidStamp = analysis.hasValidStamp ?? false;
    result.errors = Array.isArray(analysis.errors) ? analysis.errors : [];
    result.warnings = Array.isArray(analysis.warnings) ? analysis.warnings : [];

    // Agregar reasoning si es necesario
    if (!result.isValid && analysis.reasoning && result.errors.length === 0) {
      result.errors.push(analysis.reasoning);
    }

    if (result.isValid && analysis.reasoning && result.warnings.length === 0) {
      result.warnings.push(analysis.reasoning);
    }

    return result;
  } catch (error: any) {
    result.isValid = false;
    
    // Manejar errores específicos de OpenAI
    if (error?.status === 429) {
      if (error?.code === 'insufficient_quota') {
        result.errors.push(
          'La cuenta de OpenAI no tiene créditos disponibles. Por favor, agrega un método de pago en https://platform.openai.com/account/billing para activar tu cuenta.',
        );
      } else {
        result.errors.push(
          'Se excedió el límite de solicitudes a OpenAI. Por favor, intenta de nuevo más tarde.',
        );
      }
    } else if (error?.status === 401) {
      result.errors.push(
        'La API key de OpenAI no es válida. Por favor, verifica tu OPENAI_API_KEY en el archivo .env',
      );
    } else if (error?.status === 400) {
      result.errors.push(
        `Error en la solicitud a OpenAI: ${error?.message || 'Solicitud inválida'}`,
      );
    } else {
      const errorMessage = error?.message || 'Error desconocido';
      result.errors.push(`Error al validar con OpenAI: ${errorMessage}`);
    }
    
    console.error('Error en validación OpenAI:', error);
    return result;
  }
}

/**
 * Obtiene la ruta del documento de referencia
 */
function getReferenceDocumentPath(): string {
  return path.join(
    __dirname,
    '..',
    'assets',
    'solvencia_horas_sociales.pdf',
  );
}

/**
 * Obtiene la ruta de la imagen del sello de referencia
 */
function getStampImagePath(): string {
  return path.join(__dirname, '..', 'assets', 'sello_aprobado.png');
}

/**
 * Construye los mensajes para enviar a OpenAI
 */
function buildOpenAIMessages(
  documentImages: string[],
  referenceImages: string[],
  stampImageBase64: string | null,
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const systemPrompt = getSystemPrompt();
  const userPrompt = getUserPrompt();

  const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: 'text', text: userPrompt },
  ];

  // Agregar imágenes del documento a validar (alta calidad)
  documentImages.forEach((imageBase64, index) => {
    userContent.push({
      type: 'image_url',
      image_url: {
        url: `data:${PDF_TO_IMAGE_CONFIG.imageFormat};base64,${imageBase64}`,
        detail: 'high', // Máxima calidad para mejor legibilidad
      },
    });
  });

  // Agregar documento de referencia si existe
  if (referenceImages.length > 0) {
    userContent.push({
      type: 'text',
      text: '\n\nEste es el formato de referencia del documento:',
    });
    referenceImages.forEach((imageBase64) => {
      userContent.push({
        type: 'image_url',
        image_url: {
          url: `data:${PDF_TO_IMAGE_CONFIG.imageFormat};base64,${imageBase64}`,
          detail: 'high',
        },
      });
    });
  }

  // Agregar imagen del sello de referencia si existe - PREGUNTA DIRECTA
  if (stampImageBase64) {
    userContent.push({
      type: 'text',
      text: '\n\n¿Este documento tiene este sello?',
    });
    userContent.push({
      type: 'image_url',
      image_url: {
        url: `data:image/png;base64,${stampImageBase64}`,
        detail: 'high',
      },
    });
    userContent.push({
      type: 'text',
      text: '\n\nPor favor, verifica:\n1. Si el documento tiene el formato correcto (estructura similar al documento de referencia)\n2. Si el documento contiene el sello mostrado arriba (puede tener variaciones menores en color, tamaño o nitidez debido al escaneo)\n\nIMPORTANTE:\n- Las tachaduras, correcciones o marcas de lapicero son NORMALES en documentos físicos y NO deben considerarse errores\n- Los documentos pueden estar escritos a mano - esto es aceptable\n- Solo marca errores si falta información esencial, el formato es completamente incorrecto, o falta el sello oficial\n\nResponde en formato JSON con isValid, hasValidFormat, hasValidStamp, errors, warnings y reasoning.',
    });
  }

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ];
}

/**
 * Obtiene el prompt del sistema para OpenAI
 */
function getSystemPrompt(): string {
  return `Eres un experto en analizar documentos PDF e imágenes. Tu tarea es validar documentos de solvencia de horas sociales.

IMPORTANTE - CARACTERÍSTICAS NORMALES DE DOCUMENTOS FÍSICOS:
- Los documentos pueden tener tachaduras, correcciones o marcas de lapicero - esto es NORMAL y NO debe afectar la validación
- Los documentos pueden estar escritos a mano - esto es NORMAL y aceptable
- Los documentos pueden tener manchas, arrugas o imperfecciones por ser documentos físicos escaneados - esto es NORMAL
- NO debes marcar como error o advertencia las tachaduras, correcciones o marcas de lapicero
- Solo marca errores si falta información esencial, el formato es completamente incorrecto, o falta el sello oficial

Responde SOLO en formato JSON válido con esta estructura exacta:
{
  "isValid": boolean,
  "hasValidFormat": boolean,
  "hasValidStamp": boolean,
  "errors": ["error1", "error2"],
  "warnings": ["warning1", "warning2"],
  "reasoning": "explicación breve de tu análisis"
}`;
}

/**
 * Obtiene el prompt del usuario para OpenAI
 */
function getUserPrompt(): string {
  return `Por favor, valida este documento PDF de solvencia de horas sociales.`;
}

/**
 * Realiza la validación con OpenAI
 */
async function validateWithOpenAI(
  openai: OpenAI,
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
): Promise<OpenAIAnalysis> {
  const response = await openai.chat.completions.create({
    model: OPENAI_CONFIG.model,
    messages,
    response_format: { type: 'json_object' },
    max_tokens: OPENAI_CONFIG.maxTokens,
    temperature: OPENAI_CONFIG.temperature,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No se recibió respuesta de OpenAI');
  }

  try {
    return JSON.parse(content) as OpenAIAnalysis;
  } catch (parseError) {
    throw new Error(
      `Error al parsear respuesta de OpenAI: ${(parseError as Error).message}. Respuesta: ${content.substring(0, 200)}`,
    );
  }
}


/**
 * Convierte un PDF a imágenes PNG en base64 usando pdftoppm del sistema
 * Usa poppler-utils instalado en el sistema (más confiable)
 *
 * @param pdfPath - Ruta del archivo PDF
 * @returns Array de imágenes en base64
 */
async function convertPdfToImages(pdfPath: string): Promise<string[]> {
  try {
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`El archivo PDF no existe: ${pdfPath}`);
    }

    // Crear directorio temporal para las imágenes
    const tempDir = path.join(os.tmpdir(), `pdf-images-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const outputPrefix = path.join(tempDir, 'page');
    const scale = Math.round(PDF_TO_IMAGE_CONFIG.scale * 100); // Convertir a porcentaje (200 = 2.0x)

    console.log(`Convirtiendo PDF a imágenes usando pdftoppm del sistema...`);

    // Usar pdftoppm del sistema directamente
    // pdftoppm -png -scale-to 200 input.pdf output_prefix
    const command = `pdftoppm -png -scale-to ${scale} "${pdfPath}" "${outputPrefix}"`;
    
    try {
      await execAsync(command);
    } catch (execError: any) {
      // Limpiar directorio temporal en caso de error
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.warn('Error al limpiar directorio temporal:', cleanupError);
      }
      throw new Error(`Error al ejecutar pdftoppm: ${execError.message}`);
    }

    // Leer todas las imágenes generadas
    const files = fs.readdirSync(tempDir)
      .filter((file) => file.endsWith('.png'))
      .sort((a, b) => {
        // Ordenar por número de página (page-1.png, page-2.png, etc.)
        const numA = parseInt(a.match(/-(\d+)\.png$/)?.[1] || '0');
        const numB = parseInt(b.match(/-(\d+)\.png$/)?.[1] || '0');
        return numA - numB;
      });

    if (files.length === 0) {
      // Limpiar directorio temporal
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.warn('Error al limpiar directorio temporal:', cleanupError);
      }
      throw new Error('No se generaron imágenes del PDF');
    }

    const images: string[] = [];
    for (const file of files) {
      const imagePath = path.join(tempDir, file);
      const imageBuffer = fs.readFileSync(imagePath);
      
      if (imageBuffer.length === 0) {
        console.warn(`Advertencia: La imagen ${file} está vacía`);
        continue;
      }

      const imageBase64 = imageBuffer.toString('base64');
      images.push(imageBase64);

      // Limpiar archivo temporal
      try {
        fs.unlinkSync(imagePath);
      } catch (error) {
        console.warn(`No se pudo eliminar archivo temporal: ${imagePath}`, error);
      }
    }

    // Limpiar directorio temporal
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.warn('Error al limpiar directorio temporal:', cleanupError);
    }

    if (images.length === 0) {
      throw new Error('No se pudieron generar imágenes del PDF');
    }

    console.log(`PDF convertido exitosamente: ${images.length} imagen(es) generada(s) usando pdftoppm`);
    return images;
  } catch (error) {
    console.error('Error al convertir PDF a imágenes:', error);
    throw new Error(
      `Error al convertir PDF a imágenes: ${(error as Error).message}`,
    );
  }
}

/**
 * Valida un documento de materias ganadas usando OpenAI GPT-4 Vision
 *
 * @param documentPath - Ruta del archivo PDF a validar
 * @param configService - Servicio de configuración de NestJS
 * @returns Resultado de la validación con las materias ganadas extraídas
 */
export async function validatePassedSubjectsDocumentWithOpenAI(
  documentPath: string,
  configService: ConfigService,
): Promise<PassedSubjectsValidationResult> {
  const result: PassedSubjectsValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    hasValidFormat: false,
    passedSubjects: [],
    totalSubjects: 0,
    passedCount: 0,
  };

  try {
    // Validar configuración de OpenAI
    const openaiApiKey = configService.get<string>('openai.apiKey');
    if (!openaiApiKey) {
      throw new Error(
        'OPENAI_API_KEY no está configurada. Por favor, agrega OPENAI_API_KEY a tu archivo .env',
      );
    }

    // Inicializar cliente de OpenAI
    const openai = new OpenAI({ apiKey: openaiApiKey });

    // Obtener ruta del documento de referencia
    const referencePath = path.join(
      __dirname,
      '..',
      'assets',
      'materias_ganadas.pdf',
    );

    // Convertir PDFs a imágenes de alta calidad
    console.log('Convirtiendo documento PDF de materias ganadas a imágenes...');
    const documentImages = await convertPdfToImages(documentPath);
    
    if (documentImages.length === 0) {
      throw new Error('No se pudieron generar imágenes del documento PDF');
    }
    
    console.log(`Documento convertido: ${documentImages.length} página(s)`);
    
    const referenceImages = fs.existsSync(referencePath)
      ? await convertPdfToImages(referencePath)
      : [];
    
    if (referenceImages.length === 0) {
      console.warn('Advertencia: No se encontró el documento de referencia de materias ganadas');
    }

    // Construir mensajes para OpenAI
    const messages = buildPassedSubjectsOpenAIMessages(
      documentImages,
      referenceImages,
    );

    // Realizar validación con OpenAI
    const analysis = await validatePassedSubjectsWithOpenAI(openai, messages);

    // Procesar resultado
    result.isValid = analysis.isValid ?? false;
    result.hasValidFormat = analysis.hasValidFormat ?? false;
    result.errors = Array.isArray(analysis.errors) ? analysis.errors : [];
    result.warnings = Array.isArray(analysis.warnings) ? analysis.warnings : [];
    result.passedSubjects = Array.isArray(analysis.passedSubjects) 
      ? analysis.passedSubjects 
      : [];
    result.totalSubjects = analysis.totalSubjects ?? 0;
    result.passedCount = analysis.passedCount ?? 0;

    // Validar que se extrajeron materias
    if (result.passedSubjects.length === 0 && result.isValid) {
      result.warnings.push('No se pudieron extraer materias del documento. Verifica que el formato sea correcto.');
    }

    return result;
  } catch (error: any) {
    result.isValid = false;
    
    // Manejar errores específicos de OpenAI
    if (error?.status === 429) {
      if (error?.code === 'insufficient_quota') {
        result.errors.push(
          'La cuenta de OpenAI no tiene créditos disponibles. Por favor, agrega un método de pago en https://platform.openai.com/account/billing para activar tu cuenta.',
        );
      } else {
        result.errors.push(
          'Se excedió el límite de solicitudes a OpenAI. Por favor, intenta de nuevo más tarde.',
        );
      }
    } else if (error?.status === 401) {
      result.errors.push(
        'La API key de OpenAI no es válida. Por favor, verifica tu OPENAI_API_KEY en el archivo .env',
      );
    } else if (error?.status === 400) {
      result.errors.push(
        `Error en la solicitud a OpenAI: ${error?.message || 'Solicitud inválida'}`,
      );
    } else {
      const errorMessage = error?.message || 'Error desconocido';
      result.errors.push(`Error al validar con OpenAI: ${errorMessage}`);
    }
    
    console.error('Error en validación OpenAI de materias ganadas:', error);
    return result;
  }
}

/**
 * Construye los mensajes para enviar a OpenAI para validación de materias ganadas
 */
function buildPassedSubjectsOpenAIMessages(
  documentImages: string[],
  referenceImages: string[],
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const systemPrompt = getPassedSubjectsSystemPrompt();
  const userPrompt = getPassedSubjectsUserPrompt();

  const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: 'text', text: userPrompt },
  ];

  // Agregar imágenes del documento a validar
  documentImages.forEach((imageBase64) => {
    userContent.push({
      type: 'image_url',
      image_url: {
        url: `data:${PDF_TO_IMAGE_CONFIG.imageFormat};base64,${imageBase64}`,
        detail: 'high',
      },
    });
  });

  // Agregar documento de referencia si existe
  if (referenceImages.length > 0) {
    userContent.push({
      type: 'text',
      text: '\n\nEste es el formato de referencia del documento de materias ganadas:',
    });
    referenceImages.forEach((imageBase64) => {
      userContent.push({
        type: 'image_url',
        image_url: {
          url: `data:${PDF_TO_IMAGE_CONFIG.imageFormat};base64,${imageBase64}`,
          detail: 'high',
        },
      });
    });
  }

  userContent.push({
    type: 'text',
    text: '\n\nPor favor, extrae TODAS las materias que tienen el checkbox marcado (☑) de la tabla. Para cada materia ganada, extrae:\n- El ciclo (ej: CICLO I, CICLO II, etc.)\n- El código de la materia (ej: COM25, BAS308, etc.)\n- El nombre completo de la materia\n\nResponde en formato JSON con isValid, hasValidFormat, errors, warnings, passedSubjects (array de objetos con cycle, code, subject), totalSubjects y passedCount.',
  });

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ];
}

/**
 * Obtiene el prompt del sistema para validación de materias ganadas
 */
function getPassedSubjectsSystemPrompt(): string {
  return `Eres un experto en analizar documentos PDF e imágenes de materias ganadas de estudiantes. Tu tarea es extraer todas las materias que tienen el checkbox marcado (☑) de una tabla.

IMPORTANTE:
- Solo debes extraer las materias que tienen el checkbox marcado (☑)
- Ignora las materias que tienen el checkbox vacío (☐) o sin marcar
- Extrae el ciclo, código y nombre completo de cada materia ganada
- El documento puede tener variaciones en formato, pero debe ser similar al documento de referencia

Responde SOLO en formato JSON válido con esta estructura exacta:
{
  "isValid": boolean,
  "hasValidFormat": boolean,
  "errors": ["error1", "error2"],
  "warnings": ["warning1", "warning2"],
  "passedSubjects": [
    {
      "cycle": "CICLO I",
      "code": "COM25",
      "subject": "DESARROLLO DE LOGICA DE PROGRAMACIÓN"
    }
  ],
  "totalSubjects": number,
  "passedCount": number,
  "reasoning": "explicación breve de tu análisis"
}`;
}

/**
 * Obtiene el prompt del usuario para validación de materias ganadas
 */
function getPassedSubjectsUserPrompt(): string {
  return `Por favor, analiza este documento PDF de materias ganadas y extrae todas las materias que tienen el checkbox marcado (☑).`;
}

/**
 * Realiza la validación de materias ganadas con OpenAI
 */
async function validatePassedSubjectsWithOpenAI(
  openai: OpenAI,
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
): Promise<PassedSubjectsOpenAIAnalysis> {
  const response = await openai.chat.completions.create({
    model: OPENAI_CONFIG.model,
    messages,
    response_format: { type: 'json_object' },
    max_tokens: 4000,
    temperature: OPENAI_CONFIG.temperature,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No se recibió respuesta de OpenAI');
  }

  try {
    return JSON.parse(content) as PassedSubjectsOpenAIAnalysis;
  } catch (parseError) {
    throw new Error(
      `Error al parsear respuesta de OpenAI: ${(parseError as Error).message}. Respuesta: ${content.substring(0, 200)}`,
    );
  }
}
