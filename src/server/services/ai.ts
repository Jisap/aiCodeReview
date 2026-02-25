import OpenAI from "openai";
import { z } from "zod";

let openaiClient: OpenAI | null = null;                                // Variable para mantener una única instancia del cliente de OpenAI (patrón Singleton).

function getOpenAIClient(): OpenAI {                                   // Función para obtener el cliente de OpenAI.
  const apiKey = process.env.OPENAI_API_KEY;                           // Obtiene la API key de las variables de entorno.
  if (!apiKey) {                                                       // Lanza un error si la clave no está configurada.
    throw new Error("OPENAI_API_KEY is not set");
  }

  if (!openaiClient) {                                                 // Si el cliente no ha sido inicializado, lo crea.
    openaiClient = new OpenAI({ apiKey });
  }

  return openaiClient;                                                 // Devuelve la instancia del cliente.
}

// Define el esquema de validación para un 
// comentario de revisión usando Zod.
export const ReviewCommentSchema = z.object({
  file: z.string(),                                                    // Nombre del archivo comentado.
  line: z.number(),                                                    // Línea específica del comentario.
  severity: z.enum(["critical", "high", "medium", "low"]),             // Nivel de severidad del problema.
  category: z.enum(["bug", "security", "performance", "style", "suggestion"]), // Categoría del problema.
  message: z.string(),                                                 // Mensaje explicando el problema.
  suggestion: z.string().optional(),                                   // Sugerencia de cómo solucionarlo (opcional).
});

export const ReviewResultSchema = z.object({
  summary: z.string(),
  riskScore: z.number().min(0).max(100),
  comments: z.array(ReviewCommentSchema),
});

// Exporta los tipos inferidos de los esquemas 
// de Zod para usarlos en el código.
export type ReviewComment = z.infer<typeof ReviewCommentSchema>;
export type ReviewResult = z.infer<typeof ReviewResultSchema>;

interface FileChange {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

// Prompt del sistema que instruye a la IA sobre cómo debe 
// comportarse y qué formato de respuesta debe usar.
const SYSTEM_PROMPT = `You are an expert code reviewer. Analyze the provided pull request diff and provide a structured review. 

Your review should:
1. Identify bugs, security issues, performance problems, and code style issues
2. Provide a brief summary of the changes
3. Assign a risk score (0-100) based on the complexity and potential issues
4. Give specific, actionable feedback with line numbers

Respond with valid JSON matching this schema:
{
  "summary": "Brief summary of changes and overall assessment",
  "riskScore": 0-100,
  "comments": [
    {
      "file": "path/to/file.ts",
      "line": 42,
      "severity": "critical" | "high" | "medium" | "low",
      "category": "bug" | "security" | "performance" | "style" | "suggestion",
      "message": "What the issue is",
      "suggestion": "How to fix it (optional)"
    }
  ]
}

Severity guide:
- critical: Security vulnerabilities, data loss, crashes
- high: Bugs that will cause issues in production
- medium: Should be fixed but won't break things
- low: Style issues, minor improvements

Be concise but specific. Reference exact line numbers from the diff.`;

export async function reviewCode(                                      // Función principal que interactúa con la API de OpenAI para revisar el código.
  prTitle: string,
  files: FileChange[],
): Promise<ReviewResult> {
  const diffContent = files                                            // Concatena los parches de todos los archivos modificados en un solo string.
    .filter((f) => f.patch)                                            // Filtra archivos que no tienen parche (ej. binarios).
    .map(
      (f) => `### ${f.filename} (${f.status})\n\`\`\`diff\n${f.patch}\n\`\`\``,
    )
    .join("\n\n");

  if (!diffContent.trim()) {                                           // Si no hay cambios de código (diff vacío), retorna un resultado por defecto.
    return {
      summary: "No code changes to review (binary files or empty diff).",
      riskScore: 0,
      comments: [],
    };
  }

  const userPrompt = `Review this pull request: // Construye el prompt del usuario con el título del PR y el contenido del diff.

**Title:** ${prTitle}

**Changes:**
${diffContent}`;

  const openai = getOpenAIClient();                                    // Obtiene el cliente de OpenAI.
  const response = await openai.chat.completions.create({              // Realiza la llamada a la API de Chat Completions.
    model: "gpt-4o-mini",                                              // Modelo de IA a utilizar.
    messages: [
      { role: "system", content: SYSTEM_PROMPT },                      // El prompt del sistema con las instrucciones.
      { role: "user", content: userPrompt },                           // El prompt del usuario con los datos del PR.
    ],
    response_format: { type: "json_object" },                          // Fuerza a la IA a responder en formato JSON.
    temperature: 0.3,                                                  // Controla la "creatividad" de la respuesta. Un valor bajo la hace más determinista.
    max_tokens: 2000,                                                  // Límite de tokens para la respuesta.
  });

  const content = response.choices[0]?.message?.content;               // Extrae el contenido de la respuesta de la IA.
  if (!content) {
    throw new Error("No response from AI");
  }

  const parsed = JSON.parse(content);                                  // Parsea la respuesta JSON.
  const validated = ReviewResultSchema.parse(parsed);                  // Valida la estructura del JSON con Zod.

  return validated;                                                    // Retorna el resultado validado.
}