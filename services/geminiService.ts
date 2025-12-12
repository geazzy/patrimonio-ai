import { GoogleGenAI } from "@google/genai";
import { Asset } from "../types";

// Initialize the API
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Uses Gemini to analyze natural language queries against the dataset.
 * Since the dataset is currently client-side and relatively small (filtered),
 * we can pass relevant context to the model.
 */
export const askGeminiAboutAssets = async (
  query: string,
  assetContext: Asset[]
): Promise<string> => {
  try {
    // Limit context to avoid token limits if list is huge. 
    // For this demo, we take top 100 or a summary string.
    // Ideally, we would use RAG, but for this standalone app, we summarize.
    
    // Group by category for summary
    const catCounts: Record<string, number> = {};
    assetContext.forEach(a => { catCounts[a.category] = (catCounts[a.category] || 0) + 1; });

    const summary = `
    Total Assets: ${assetContext.length}
    Total Value: ${assetContext.reduce((sum, a) => sum + a.value, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
    Unique Locations: ${[...new Set(assetContext.map(a => a.location))].join(', ')}
    Categories: ${JSON.stringify(catCounts)}
    Sample Data (first 20 items):
    ${JSON.stringify(assetContext.slice(0, 20).map(a => ({
      id: a.id,
      desc: a.description,
      val: a.value,
      loc: a.location,
      cat: a.category,
      tags: a.tags.join(',')
    })))}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are a helpful asset manager assistant. 
      Here is the data context (Inventory): ${summary}
      
      User Question: "${query}"
      
      Provide a concise, professional answer in Portuguese. 
      If the user asks for a calculation (sum, count), perform it based on the data provided or explain the trend.
      If the answer is not in the sample data, extrapolate based on the summary stats or ask for more specific filtering.`,
    });

    return response.text || "Desculpe, não consegui processar a resposta.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Erro ao conectar com a Inteligência Artificial. Verifique sua chave de API.";
  }
};
