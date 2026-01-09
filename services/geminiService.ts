
import { GoogleGenAI, Type } from "@google/genai";
import { Bed } from "../types";

// Note: Using gemini-3-flash-preview for general text reasoning task.
export const generateOccupancyReport = async (beds: Bed[]) => {
  // Always initialize GoogleGenAI with the latest API key from process.env.API_KEY
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const summary = beds.reduce((acc, bed) => {
    const dept = bed.department as string;
    acc[dept] = acc[dept] || { occupied: 0, total: 0 };
    acc[dept].total++;
    if (bed.status === 'Occupied') acc[dept].occupied++;
    return acc;
  }, {} as Record<string, { occupied: number; total: number }>);

  const prompt = `
    Generate a professional hospital bed occupancy report based on the following data:
    Total Beds: ${beds.length}
    Current Occupancy: ${beds.filter(b => b.status === 'Occupied').length}
    Departmental Breakdown: ${JSON.stringify(summary)}
    
    Please provide:
    1. A strategic summary of the current situation.
    2. Identification of any critical shortages or bottlenecks.
    3. Three actionable recommendations for the facility manager.
    4. A prediction for the next 24 hours based on standard medical occupancy patterns.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
            insights: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  content: { type: Type.STRING },
                  priority: { type: Type.STRING },
                  recommendation: { type: Type.STRING }
                },
                required: ["title", "content", "priority", "recommendation"]
              }
            }
          },
          required: ["title", "summary", "insights"]
        }
      }
    });

    // response.text is a property, not a method.
    const textOutput = response.text || "{}";
    return JSON.parse(textOutput.trim());
  } catch (error) {
    console.error("Failed to generate report:", error);
    throw error;
  }
};
