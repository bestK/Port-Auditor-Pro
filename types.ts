
export interface PortSource {
  uri: string;
  title: string;
}

export interface PortData {
  originalName: string;
  querySentence: string;
  portCode: string;
  chineseName: string;
  countryName: string;
  remarks: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  sources?: PortSource[];
}

export interface GeminiPortResponse {
  originalName: string;
  portCode: string;
  chineseName: string;
  countryName: string;
  remarks: string;
  sources?: PortSource[];
}

export interface GeminiAppConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}
