
import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Trash2, 
  Plus, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  X,
  ExternalLink,
  Globe,
  Settings,
  Key,
  Cpu,
  Save,
  Check
} from 'lucide-react';
import { PortData, GeminiAppConfig } from './types';
import { matchPortsBatch, generateChineseSummary } from './services/geminiService';

const BATCH_SIZE = 5;

const RECOMMENDED_MODELS = [
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash' },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro' },
  { id: 'gemini-2.5-flash-lite-latest', name: 'Flash Lite' },
];

const App: React.FC = () => {
  const [inputRaw, setInputRaw] = useState('');
  const [ports, setPorts] = useState<PortData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  
  // Settings state
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState<GeminiAppConfig>(() => {
    const saved = localStorage.getItem('gemini_port_matcher_config');
    if (saved) return JSON.parse(saved);
    return {
      apiKey: '',
      baseUrl: '',
      model: 'gemini-3-flash-preview'
    };
  });

  useEffect(() => {
    localStorage.setItem('gemini_port_matcher_config', JSON.stringify(config));
  }, [config]);

  const parseInput = () => {
    const lines = inputRaw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const newPorts: PortData[] = lines.map(name => ({
      originalName: name,
      querySentence: `${name}五位港口代码、港口中文名称和所属国家`,
      portCode: '',
      chineseName: '',
      countryName: '',
      remarks: '',
      status: 'pending'
    }));
    setPorts(prev => [...prev, ...newPorts]);
    setInputRaw('');
  };

  const clearAll = () => {
    if (confirm('确定要清除所有数据吗？')) {
      setPorts([]);
      setSummary(null);
      setProgress({ current: 0, total: 0 });
    }
  };

  const processPorts = async () => {
    const pendingPorts = ports.filter(p => p.status === 'pending' || p.status === 'error');
    if (pendingPorts.length === 0) return;

    setIsProcessing(true);
    setSummary(null);
    setProgress({ current: 0, total: pendingPorts.length });

    const totalToProcess = pendingPorts.length;
    let completedCount = 0;

    for (let i = 0; i < totalToProcess; i += BATCH_SIZE) {
      const batch = pendingPorts.slice(i, i + BATCH_SIZE);
      const batchNames = batch.map(p => p.originalName);

      setPorts(prev => prev.map(p => 
        batchNames.includes(p.originalName) ? { ...p, status: 'processing' as const } : p
      ));

      try {
        const results = await matchPortsBatch(batchNames, config);
        
        setPorts(prev => prev.map(p => {
          const matched = results.find(r => r.originalName.toLowerCase() === p.originalName.toLowerCase());
          if (matched) {
            return {
              ...p,
              portCode: matched.portCode,
              chineseName: matched.chineseName,
              countryName: matched.countryName,
              remarks: matched.remarks,
              sources: matched.sources,
              status: 'completed' as const
            };
          }
          return p;
        }));
      } catch (error: any) {
        console.error("Batch processing failed:", error);
        setPorts(prev => prev.map(p => 
          batchNames.includes(p.originalName) ? { ...p, status: 'error' as const, remarks: error?.message || '验证失败' } : p
        ));
      }

      completedCount += batch.length;
      setProgress(prev => ({ ...prev, current: completedCount }));
    }

    setIsProcessing(false);
  };

  const handleGenerateSummary = async () => {
    if (ports.filter(p => p.status === 'completed').length === 0) {
      alert('请先完成港口匹配。');
      return;
    }
    setIsSummarizing(true);
    try {
      const result = await generateChineseSummary(ports, config);
      setSummary(result);
    } catch (error) {
      console.error("Summary generation failed:", error);
      alert('生成总结失败。');
    } finally {
      setIsSummarizing(false);
    }
  };

  const downloadCSV = () => {
    const headers = ['原始名称', '港口代码', '中文名称', '所属国家', '验证备注'];
    const rows = ports.map(p => [
      p.originalName, p.portCode, p.chineseName, p.countryName, p.remarks
    ]);
    const csvContent = "\ufeff" + [headers.join(','), ...rows.map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `verified_ports_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <header className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-3 rounded-xl shadow-lg shadow-indigo-100">
              <Globe className="w-8 h-8 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Port Auditor Pro</h1>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-500 text-sm">
                  Model: <span className="text-indigo-600 font-mono font-bold">{config.model || 'Default'}</span>
                </span>
                {config.baseUrl && <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-bold rounded uppercase border border-amber-100">Proxy Active</span>}
                {config.apiKey && <span className="px-1.5 py-0.5 bg-rose-50 text-rose-600 text-[10px] font-bold rounded uppercase border border-rose-100">Custom Key</span>}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${showSettings ? 'bg-indigo-600 text-white shadow-indigo-100 shadow-lg' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
              title="配置设置"
            >
              <Settings className="w-6 h-6" />
              <span className="text-sm font-medium pr-1">配置</span>
            </button>
            <div className="w-px h-8 bg-slate-200 mx-1 hidden md:block" />
            <button 
              onClick={clearAll}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              清空
            </button>
            <button 
              onClick={handleGenerateSummary}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-medium transition-colors"
            >
              {isSummarizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              AI 报告
            </button>
            <button 
              onClick={downloadCSV}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              导出 CSV
            </button>
          </div>
        </div>

        {/* Dynamic Settings Panel */}
        {showSettings && (
          <div className="mt-6 p-6 bg-slate-50 rounded-2xl border border-slate-200 shadow-inner animate-in slide-in-from-top-4 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* API Key Section */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <Key className="w-3.5 h-3.5" /> API Key
                </label>
                <input 
                  type="password"
                  value={config.apiKey}
                  onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                  placeholder="在此输入您的 API 密钥"
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono shadow-sm"
                />
                <p className="text-[10px] text-slate-400">留空将使用默认的环境变量 Key。</p>
              </div>

              {/* Base URL Section */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <Globe className="w-3.5 h-3.5" /> 自定义代理 Base URL
                </label>
                <input 
                  type="text"
                  value={config.baseUrl}
                  onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
                  placeholder="例如: https://your-proxy.com"
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono shadow-sm"
                />
                <p className="text-[10px] text-slate-400">仅在需要通过代理访问 Google API 时填写。</p>
              </div>

              {/* Model Section */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <Cpu className="w-3.5 h-3.5" /> Gemini 模型名称
                </label>
                <input 
                  type="text"
                  value={config.model}
                  onChange={(e) => setConfig({ ...config, model: e.target.value })}
                  placeholder="手动输入模型 ID (如 gemini-3-flash-preview)"
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono shadow-sm"
                />
                <div className="flex flex-wrap gap-2 pt-1">
                  {RECOMMENDED_MODELS.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setConfig({ ...config, model: m.id })}
                      className={`text-[10px] px-2 py-1 rounded-full border transition-all flex items-center gap-1 ${config.model === m.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'}`}
                    >
                      {config.model === m.id && <Check className="w-2.5 h-2.5" />}
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="mt-8 flex justify-end">
              <button 
                onClick={() => setShowSettings(false)}
                className="flex items-center gap-2 px-10 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold shadow-xl hover:bg-slate-800 transition-all active:scale-95"
              >
                <Save className="w-4 h-4" />
                应用并保存配置
              </button>
            </div>
          </div>
        )}
      </header>

      {summary && (
        <div className="bg-white border-l-4 border-indigo-500 rounded-r-2xl p-6 relative animate-in fade-in slide-in-from-top-4 duration-300 shadow-lg">
          <button 
            onClick={() => setSummary(null)}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
          <h3 className="text-indigo-900 font-bold mb-3 flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-500" />
            联网审计报告
          </h3>
          <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
            {summary}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Input */}
        <section className="lg:col-span-1 space-y-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-500" />
              待验证港口列表
            </h2>
            <textarea
              value={inputRaw}
              onChange={(e) => setInputRaw(e.target.value)}
              placeholder="每行输入一个港口名，例如：&#10;USLAX&#10;Vancouver Apt&#10;SHEKOU"
              className="w-full h-64 p-4 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none font-mono"
            />
            <div className="mt-4 flex gap-3">
              <button 
                onClick={parseInput}
                disabled={!inputRaw.trim() || isProcessing}
                className="flex-1 bg-slate-100 text-slate-700 px-4 py-3 rounded-xl font-medium hover:bg-slate-200 disabled:opacity-50 transition-colors"
              >
                加入队列
              </button>
              <button 
                onClick={processPorts}
                disabled={isProcessing || ports.filter(p => p.status === 'pending').length === 0}
                className="flex-1 items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-md shadow-indigo-100"
              >
                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "联网验证"}
              </button>
            </div>
          </div>

          {isProcessing && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-3">
              <div className="flex justify-between items-center text-sm font-medium">
                <span className="text-slate-600">正在搜索与审计...</span>
                <span className="text-indigo-600">{progress.current} / {progress.total}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-indigo-600 h-full transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </section>

        {/* Right: Table */}
        <section className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                验证结果
              </h2>
            </div>
            
            <div className="overflow-x-auto max-h-[700px]">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-white z-10 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-slate-600">状态</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">名称</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">代码</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">中文名</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">国家</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">来源</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ports.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-16 text-center text-slate-400 italic">
                        请添加港口开始。
                      </td>
                    </tr>
                  ) : (
                    ports.map((port, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3">
                          {port.status === 'completed' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                          {port.status === 'processing' && <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />}
                          {port.status === 'error' && <AlertCircle className="w-5 h-5 text-rose-500" />}
                          {port.status === 'pending' && <div className="w-5 h-5 rounded-full border-2 border-slate-200" />}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">{port.originalName}</td>
                        <td className="px-4 py-3 font-mono text-indigo-600 font-bold">{port.portCode || '-'}</td>
                        <td className="px-4 py-3 text-slate-700">{port.chineseName || '-'}</td>
                        <td className="px-4 py-3 text-slate-600">{port.countryName || '-'}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            {port.sources?.map((s, i) => (
                              <a key={i} href={s.uri} target="_blank" rel="noreferrer" className="p-1.5 bg-slate-100 rounded-md hover:bg-indigo-100 transition-colors" title={s.title}>
                                <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                              </a>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default App;
