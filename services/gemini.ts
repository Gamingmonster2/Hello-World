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

3. **ASSET HANDLING**:
    - If the user provides assets (Images/Audio), you MUST embed them directly into the HTML code.
    - Use Data URIs (base64) for 'src' attributes.
    - DO NOT create broken links to local files like './assets/'. Use the provided BASE64 data.

4. **Self-Contained**:
    - Return ONLY the raw HTML code. Start immediately with <!DOCTYPE html>.
`;

export interface AssetFile {
  name: string;
  mimeType: string;
  data: string; // Base64 string
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

export async function bringToLife(prompt: string, assets: AssetFile[] = []): Promise<string> {
  // Initialize client per-request
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const parts: any[] = [];
  
  // Construct the prompt with explicit asset mapping instructions
  let constructedPrompt = `Voice Command: "${prompt || "Build a web interface based on these assets."}".`;

  if (assets.length > 0) {
      constructedPrompt += `\n\n[ATTACHED ASSETS DETECTED]\n`;
      constructedPrompt += `The user has uploaded the following files. You must use them in the generated code.\n`;
      constructedPrompt += `IMPORTANT: To make them work, you must use the BASE64 data provided below as the 'src'.\n`;
      
      assets.forEach((asset, index) => {
          // Clean filename for variable usage
          const virtualPath = `/assets/uploads/${asset.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
          
          constructedPrompt += `\n--- ASSET ${index + 1} ---\n`;
          constructedPrompt += `Filename: ${asset.name}\n`;
          constructedPrompt += `Virtual Path: ${virtualPath}\n`;
          constructedPrompt += `MIME: ${asset.mimeType}\n`;
          constructedPrompt += `DATA (Base64): data:${asset.mimeType};base64,${asset.data}\n`;
          constructedPrompt += `INSTRUCTION: Wherever the code would logically use "${virtualPath}" (or if the user asked for this file), insert the DATA string above.\n`;
      });
  }

  constructedPrompt += `\nGenerate the fully functional HTML application now.`;

  parts.push({ text: constructedPrompt });

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

export async function refineCode(currentHtml: string, refinementPrompt: string, newAssets: AssetFile[] = []): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  let assetContext = "";
  if (newAssets.length > 0) {
      assetContext += `\n\n[NEW ASSETS PROVIDED]\n`;
      assetContext += `The user has uploaded new files to be added to the project:\n`;
      newAssets.forEach((asset, index) => {
          const virtualPath = `/assets/uploads/${asset.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
          assetContext += `\n--- NEW ASSET ${index + 1} ---\n`;
          assetContext += `Filename: ${asset.name}\n`;
          assetContext += `Virtual Path: ${virtualPath}\n`;
          assetContext += `MIME: ${asset.mimeType}\n`;
          assetContext += `DATA (Base64): data:${asset.mimeType};base64,${asset.data}\n`;
          assetContext += `INSTRUCTION: Integrate this new asset into the code. Use the Base64 data for 'src' attributes.\n`;
      });
  }

  const prompt = `
    CURRENT CODE:
    ${currentHtml}

    USER REQUEST FOR IMPROVEMENT:
    "${refinementPrompt}"

    ${assetContext}

    INSTRUCTIONS:
    1. Update the CURRENT CODE to match the USER REQUEST.
    2. Maintain the same visual style and structure unless asked to change.
    3. If new assets are provided, ensure they are implemented correctly using the Data URIs.
    4. Return the FULL updated HTML file (do not return just snippets).
    5. Ensure the code remains self-contained.
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