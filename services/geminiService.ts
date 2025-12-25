
import { GoogleGenAI, Type } from "@google/genai";
import { GeminiPortResponse, PortData, PortSource } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const matchPortsBatch = async (
  ports: string[]
): Promise<GeminiPortResponse[]> => {
  const model = "gemini-3-flash-preview";
  
  const prompt = `Please verify and match the following port names against official UN/LOCODE databases and shipping directories. 
  Confirm the 5-digit code, standard Chinese name, and country for each:
  ${ports.join(', ')}`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction: "You are an elite logistics data auditor. Use Google Search to verify every port against official sources (like UNECE). Provide the 5-digit UN/LOCODE, official Chinese translation, and country name. If the input is an airport (APT), specify that in remarks. Output MUST be valid JSON.",
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            originalName: { type: Type.STRING },
            portCode: { type: Type.STRING, description: "Official 5-digit UN/LOCODE" },
            chineseName: { type: Type.STRING, description: "Official Chinese name" },
            countryName: { type: Type.STRING, description: "Country name" },
            remarks: { type: Type.STRING, description: "Verification details or error notes" },
          },
          required: ["originalName", "portCode", "chineseName", "countryName", "remarks"],
          propertyOrdering: ["originalName", "portCode", "chineseName", "countryName", "remarks"]
        },
      },
    },
  });

  // Extract grounding chunks as sources
  const sources: PortSource[] = [];
  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (groundingChunks) {
    groundingChunks.forEach((chunk: any) => {
      if (chunk.web && chunk.web.uri) {
        sources.push({
          uri: chunk.web.uri,
          title: chunk.web.title || 'Source'
        });
      }
    });
  }

  try {
    const text = response.text;
    if (!text) throw new Error("Empty response from AI");
    const results: any[] = JSON.parse(text);
    
    // Attach sources to each result for display (simplified: same sources for the batch)
    return results.map(r => ({
      ...r,
      sources: sources.slice(0, 3) // Limit to top 3 relevant sources
    }));
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    throw error;
  }
};

export const generateChineseSummary = async (ports: PortData[]): Promise<string> => {
  const model = "gemini-3-flash-preview";
  const completedPorts = ports.filter(p => p.status === 'completed');
  
  if (completedPorts.length === 0) return "没有已完成匹配的港口数据。";

  const dataString = completedPorts.map(p => 
    `${p.originalName} -> ${p.chineseName} (${p.portCode}), 国家: ${p.countryName}`
  ).join('\n');

  const prompt = `请基于以下已通过联网验证的港口数据，进行深度的物流分析总结：
  ${dataString}`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction: "你是一个资深的国际物流合规专家。请总结匹配结果，指出是否有港口代码在近期有变动，或者某些港口（如温哥华）的多重属性（海运港vs机场）。使用专业中文。",
      tools: [{ googleSearch: {} }]
    },
  });

  return response.text || "无法生成总结。";
};
