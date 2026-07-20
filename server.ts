import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

// Increase JSON payload limit for large roster text
app.use(express.json({ limit: '10mb' }));

// Initialize GoogleGenAI SDK
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
} else {
  console.warn('GEMINI_API_KEY is not defined. PDF parser backup will use basic client-side mapping.');
}

// Helper function to call Gemini API with automatic retries for transient errors (503 UNAVAILABLE or 429 RESOURCE_EXHAUSTED)
async function generateContentWithRetry(ai: GoogleGenAI, params: any, retries = 3, delayMs = 1000): Promise<any> {
  try {
    return await ai.models.generateContent(params);
  } catch (error: any) {
    const errorStr = JSON.stringify(error) || error.message || '';
    const isTransient = 
      errorStr.includes('503') || 
      errorStr.includes('UNAVAILABLE') || 
      errorStr.includes('429') || 
      errorStr.includes('RESOURCE_EXHAUSTED') ||
      errorStr.includes('high demand') ||
      (error.status && [429, 503].includes(error.status)) ||
      (error.code && [429, 503].includes(error.code));

    if (retries > 0 && isTransient) {
      console.warn(`Gemini API returned transient error. Retrying in ${delayMs}ms... (Retries left: ${retries})`, error);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return generateContentWithRetry(ai, params, retries - 1, delayMs * 2);
    }
    throw error;
  }
}

// API endpoint for parsing roster text with Gemini
app.post('/api/parse-roster', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text content is required' });
    }

    if (!ai) {
      return res.status(503).json({
        error: 'Gemini service is unavailable. Please make sure the GEMINI_API_KEY is set in your application settings.',
      });
    }

    const systemInstruction = `You are an expert PDF roster parser.
Your task is to analyze extracted text from a roster PDF (which may have complex columns or misaligned lines) and reconstruct a clean, correct 2D table grid (representing rows of cells).
Strictly look for student/participant details like Name, Student ID, Contact, Phone, T-Shirt, Token, Roll, or Email.
- Organize the parsed content into a single cohesive table where the first row contains the header column names, and each subsequent row represents a single student/participant.
- Ensure all rows have the exact same number of columns as the header row.
- If a value is missing for a particular cell, use an empty string "" in its place.
- Do not lose or truncate any names or student IDs. Correct any split-word or spacing errors caused by PDF extraction.
- Output a single JSON object containing a "table" field which is a 2D array of strings.`;

    const response = await generateContentWithRetry(ai, {
      model: 'gemini-3.5-flash',
      contents: [
        {
          text: `Here is the raw extracted text from the PDF roster. Reconstruct and parse it into a clean table:\n\n${text}`,
        },
      ],
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            table: {
              type: Type.ARRAY,
              description: 'A 2D array of strings representing the table rows. The first item is the header row.',
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.STRING,
                },
              },
            },
          },
          required: ['table'],
        },
      },
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error('No response text received from the Gemini API.');
    }

    const parsedData = JSON.parse(resultText.trim());
    return res.json(parsedData);
  } catch (error: any) {
    console.error('Error parsing roster with Gemini:', error);
    return res.status(500).json({
      error: `Failed to parse PDF: ${error.message || 'An error occurred during parsing.'}`,
    });
  }
});

// Setup Vite middleware or static serving
async function setupServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Vite development server mounted as middleware.');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('Production static build serving enabled.');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

setupServer().catch((err) => {
  console.error('Failed to start server:', err);
});
