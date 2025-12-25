
import { GoogleGenAI, Type } from "@google/genai";
import { GeminiPortResponse, PortData, PortSource, GeminiAppConfig } from "../types";

/**
 * Safely retrieves the default API Key from environment variables.
 */
const getDefaultApiKey = () => {
  try {
    // In some local environments, process might not be defined
    return typeof process !== 'undefined' ? process.env.API_KEY || '' : '';
  } catch {
    return '';
  }
};

/**
 * Creates a dynamic AI client based on user-defined configuration.
 */
const getAIClient = (config: GeminiAppConfig) => {
  const apiKey = config.apiKey || getDefaultApiKey();
  const clientConfig: { apiKey: string; baseUrl?: string } = { apiKey };
  
  if (config.baseUrl && config.baseUrl.trim() !== '') {
    clientConfig.baseUrl = config.baseUrl.trim();
  }
  
  return new GoogleGenAI(clientConfig);
};

export const matchPortsBatch = async (
  ports: string[],
  config: GeminiAppConfig
): Promise<GeminiPortResponse[]> => {
  const ai = getAIClient(config);
  const modelName = config.model || "gemini-3-flash-preview";
  
  const prompt = `Please verify and match the following port names against official UN/LOCODE databases and shipping directories. 
  Confirm the 5-digit code, standard Chinese name, and country for each:
  ${ports.join(', ')}`;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      systemInstruction: "You are an elite logistics data auditor. Use Google Search to verify every port against official sources (like UNECE). Provide the 5-digit UN/LOCODE, official Chinese translation, and country name. Output MUST be valid JSON.",
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
    
    return results.map(r => ({
      ...r,
      sources: sources.slice(0, 3)
    }));
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    throw error;
  }
};

export const generateChineseSummary = async (ports: PortData[], config: GeminiAppConfig): Promise<string> => {
  const ai = getAIClient(config);
  const modelName = config.model || "gemini-3-flash-preview";
  const completedPorts = ports.filter(p => p.status === 'completed');
  
  if (completedPorts.length === 0) return "没有已完成匹配的港口数据。";

  const dataString = completedPorts.map(p => 
    `${p.originalName} -> ${p.chineseName} (${p.portCode}), 国家: ${p.countryName}`
  ).join('\n');

  const prompt = `请基于以下已通过联网验证的港口数据，进行深度的物流分析总结：
  ${dataString}`;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      systemInstruction: "你是一个资深的国际物流合规专家。请总结匹配结果，指出是否有港口代码在近期有变动。使用专业中文。",
      tools: [{ googleSearch: {} }]
    },
  });

  return response.text || "无法生成总结。";
};
