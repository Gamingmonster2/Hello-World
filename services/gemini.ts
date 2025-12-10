/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const GEMINI_MODEL = 'gemini-3-pro-preview';

const SYSTEM_INSTRUCTION = `You are the "Gemini Smart Browser Engine".
Your goal is to satisfy the user's voice search or command by INSTANTLY generating a fully functional, single-page HTML/JS/CSS web experience that represents the result.

CORE DIRECTIVES:
1. **Interpret Voice Intent**: 
    - If the user says "Show me the news", generate a news dashboard.
    - If the user says "Play a game of chess", generate a playable chess game.
    - If the user says "Calculate my mortgage", generate a mortgage calculator tool.
    - If the user uploads an image and says "What is this?", build a page explaining the object with interactive annotations.

2. **Visual Style**:
    - Use a clean, "Google Material" or modern aesthetic.
    - Responsive design is mandatory.

3. **NO EXTERNAL RESOURCES**:
    - Do NOT use external images (<img> src). Use CSS, SVGs, or Emojis.
    - You may use Tailwind CSS (via CDN).

4. **Self-Contained**:
    - Return ONLY the raw HTML code. Start immediately with <!DOCTYPE html>.
`;

export interface ImagePart {
  inlineData: {
    data: string;
    mimeType: string;
  };
}

/**
 * Helper to retry functions that might hit rate limits.
 * Uses exponential backoff (2s, 4s, 8s).
 */
async function generateWithRetry<T>(
  operation: () => Promise<T>, 
  retries = 3, 
  delay = 2000
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    // Inspect error for 429 (Too Many Requests) or 503 (Service Unavailable)
    // The error object structure can vary, so we check multiple paths
    const status = error?.status || error?.response?.status || error?.error?.code;
    const message = (error?.message || JSON.stringify(error)).toLowerCase();
    
    const isRateLimit = 
      status === 429 || 
      status === 503 || 
      message.includes('429') || 
      message.includes('quota') || 
      message.includes('resource_exhausted');

    if (isRateLimit && retries > 0) {
      console.warn(`API Limit hit. Retrying in ${delay}ms... (${retries} attempts remaining)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return generateWithRetry(operation, retries - 1, delay * 2);
    }
    
    throw error;
  }
}

export async function bringToLife(prompt: string, images: ImagePart[] = []): Promise<string> {
  // Initialize client per-request to ensure best practices and error handling context
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const parts: any[] = [];
  
  const finalPrompt = images.length > 0
    ? `Context: User uploaded an image. Voice Command: "${prompt || "Analyze this image and build a web interface based on it."}". Generate a web interface response.` 
    : `Voice Command: "${prompt}". Generate the web interface for this request.`;

  parts.push({ text: finalPrompt });

  // Add all images to the request
  images.forEach(img => {
    parts.push(img);
  });

  try {
    const response: GenerateContentResponse = await generateWithRetry(() => 
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: {
          parts: parts
        },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.6, 
        },
      })
    );

    let text = response.text || "<!-- Failed to generate content -->";
    text = text.replace(/^```html\s*/, '').replace(/^```\s*/, '').replace(/```$/, '');

    return text;
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
}

export async function refineCode(currentHtml: string, refinementPrompt: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    CURRENT CODE:
    ${currentHtml}

    USER REQUEST FOR IMPROVEMENT:
    "${refinementPrompt}"

    INSTRUCTIONS:
    1. Update the CURRENT CODE to match the USER REQUEST.
    2. Maintain the same visual style and structure unless asked to change.
    3. Return the FULL updated HTML file (do not return just snippets).
    4. Ensure the code remains self-contained (no external images except Tailwind CDN).
  `;

  try {
    const response: GenerateContentResponse = await generateWithRetry(() => 
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: {
          parts: [{ text: prompt }]
        },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.5,
        },
      })
    );

    let text = response.text || currentHtml;
    text = text.replace(/^```html\s*/, '').replace(/^```\s*/, '').replace(/```$/, '');
    return text;
  } catch (error) {
    console.error("Gemini Refine Error:", error);
    throw error;
  }
}