import React, { useState } from 'react';
import noeleImg from '../assets/noele.jpeg';

type Customer = 'ATMi' | 'ARTAJASA' | 'BRINKS' | 'JALIN' | '';

interface ParsedOutageData {
  customer: Customer;
  idAtm: string;
  lokasi: string;
  area: string;
  downtimeDate: string;
  downtimeTime: string;
  uptimeDate: string;   // optional, blank for now
  uptimeTime: string;   // optional, blank for now
  duration: string;     // optional, blank for now
  confirmBy: string;    // Info
  remarks: string;      // Problem normalized
}

const LogPemadamanListrikNew: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [parsedData, setParsedData] = useState<ParsedOutageData[] | null>(null);
  const [excelOutput, setExcelOutput] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  const detectCustomer = (text: string): Customer => {
    const t = text.toUpperCase();
    if (/\bATMI\b/.test(t)) return 'ATMi';
    if (/\bARTAJASA\b/.test(t)) return 'ARTAJASA';
    if (/\bBRINKS\b/.test(t)) return 'BRINKS';
    if (/\bJALIN\b/.test(t)) return 'JALIN';
    return '';
  };

  const parseOutage = (rawText: string): ParsedOutageData | null => {
    try {
      // Remove WhatsApp timestamp prefixes like: [7:39 PM, 9/25/2025] Name:
      const text = rawText.replace(/^\[[^\]]+\]\s*[^:]*:\s*/gm, '');
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      const afterFirstColon = (l: string) => l.replace(/^[^:]*:\s*/, '').trim();
      const parsed: ParsedOutageData = {
        customer: detectCustomer(text),
        idAtm: '', lokasi: '', area: '',
        downtimeDate: '', downtimeTime: '', uptimeDate: '', uptimeTime: '', duration: '',
        confirmBy: '', remarks: ''
      };

      // ID ATM dan Lokasi: line format: "<ID> - <LOKASI>" (ID bisa huruf/angka)
      const idLocLine = lines.find(l => /-/.test(l) && /\d|[A-Za-z]/.test(l) && !/^Area\s*:/i.test(l) && !/^PEMADAMAN\s+LISTRIK/i.test(l));
      if (idLocLine) {
        if (parsed.customer === 'JALIN') {
          // Prefer delimiter hyphen with optional spaces between ID and lokasi
          const m1 = idLocLine.match(/^([A-Za-z0-9]+-[A-Za-z0-9]+)\s*-\s*(.+)$/);
          if (m1) {
            parsed.idAtm = m1[1].trim();
            parsed.lokasi = m1[2].trim();
          } else {
            // Fallback: composite ID at start, then any remainder after optional lone '-' becomes lokasi
            const m2 = idLocLine.match(/^([A-Za-z0-9]+-[A-Za-z0-9]+)(.*)$/);
            if (m2) {
              parsed.idAtm = m2[1].trim();
              let rem = (m2[2] || '').trim();
              if (rem.startsWith('-')) rem = rem.slice(1).trim();
              parsed.lokasi = rem;
            } else {
              // Last resort: split once on hyphen
              const idx = idLocLine.indexOf('-');
              if (idx !== -1) {
                parsed.idAtm = idLocLine.slice(0, idx).trim();
                parsed.lokasi = idLocLine.slice(idx + 1).trim();
              }
            }
          }
        } else {
          const [left, right] = idLocLine.split(/\s*-\s*/, 2);
          parsed.idAtm = (left || '').replace(/[^A-Za-z0-9\-]/g, '');
          parsed.lokasi = (right || '').trim();
        }
      }

      // Area
      const areaLine = lines.find(l => /^Area\s*:/i.test(l));
      if (areaLine) parsed.area = afterFirstColon(areaLine);

      // Problem → remarks in lowercase sentence
      const problemLine = lines.find(l => /^Problem\s*:/i.test(l));
      if (problemLine) {
        const content = afterFirstColon(problemLine);
        parsed.remarks = content || '';
      }

      // Pukul (time) + today date as default date (user likely paste with today context)
      const timeLine = lines.find(l => /^Pukul\s*:|^Pukul/i.test(l));
      if (timeLine) {
        const raw = afterFirstColon(timeLine);
        const timeMatch = raw.match(/\b(\d{1,2}:\d{2}(?::\d{2})?)\b/);
        parsed.downtimeTime = (timeMatch ? timeMatch[1] : raw).trim();
      }

      // Info → confirmBy
      const infoLine = lines.find(l => /^Info\s*:/i.test(l));
      if (infoLine) parsed.confirmBy = afterFirstColon(infoLine);

      // Downtime date: detect in input; else use today's date (locale Indonesian style)
      const dateMatch = text.match(/\b(\d{1,2}\s+[A-Za-z]+\s+\d{4})\b/);
      if (dateMatch) {
        parsed.downtimeDate = dateMatch[1];
      } else {
        const bulan: string[] = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
        const now = new Date();
        const day = now.getDate();
        const monthName = bulan[now.getMonth()];
        const year = now.getFullYear();
        parsed.downtimeDate = `${day} ${monthName} ${year}`;
      }

      return parsed;
    } catch (e) {
      console.error('Parse outage error', e);
      return null;
    }
  };

  const copyToClipboard = async (t: string) => {
    try {
      await navigator.clipboard.writeText(t);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('copy fail', err);
    }
  };

  const generateTsv = (d: ParsedOutageData) => {
    const values = [
      d.customer,
      d.idAtm,
      d.lokasi,
      d.area,
      d.downtimeDate,
      d.downtimeTime,
      d.uptimeDate,
      d.uptimeTime,
      d.duration,
      d.confirmBy,
      d.remarks || ''
    ];
    return values.join('\t');
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const t = e.target.value;
    setInputText(t);
    if (t.trim()) {
      // Normalize line endings
      const txt = t.replace(/\r\n?/g, '\n');
      const lines = txt.split('\n');
      const blocks: string[] = [];
      let current: string[] = [];
      const isCustomer = (s: string) => /^(ATMi|ARTAJASA|BRINKS|JALIN)\s*$/i.test(s.trim());

      for (const line of lines) {
        const trimmed = line.trim();
        if (isCustomer(trimmed)) {
          if (current.length) {
            blocks.push(current.join('\n').trim());
            current = [];
          }
          current.push(trimmed);
        } else if (trimmed === '' && current.length === 0) {
          // skip leading blanks
          continue;
        } else {
          current.push(line);
        }
      }
      if (current.length) blocks.push(current.join('\n').trim());
      // Fallback: if splitting by header yields 0 or 1, also try blank-line split to catch pasted formats
      if (blocks.length <= 1) {
        const alt = txt.split(/\n\s*\n+/).map(b => b.trim()).filter(b => b);
        if (alt.length > blocks.length) {
          blocks.splice(0, blocks.length, ...alt);
        }
      }
      // Secondary fallback: regex-based header segmentation (supports optional WA prefix on same line)
      if (blocks.length <= 1) {
        const headerRe = /^(?:\[[^\]]+\]\s*[^:]*:\s*)?(ATMi|ARTAJASA|BRINKS|JALIN)\s*$/gmi;
        const indices: number[] = [];
        let m: RegExpExecArray | null;
        while ((m = headerRe.exec(txt)) !== null) {
          indices.push(m.index);
        }
        if (indices.length) {
          indices.push(txt.length);
          const segs: string[] = [];
          for (let i = 0; i < indices.length - 1; i++) {
            const seg = txt.slice(indices[i], indices[i + 1]).trim();
            if (seg) segs.push(seg);
          }
          if (segs.length) {
            blocks.splice(0, blocks.length, ...segs);
          }
        }
      }
      const results: ParsedOutageData[] = [];
      for (const block of blocks) {
        const rec = parseOutage(block);
        if (rec) results.push(rec);
      }
      if (results.length) {
        setParsedData(results);
        setExcelOutput(results.map(generateTsv).join('\n'));
      } else {
        setParsedData(null);
        setExcelOutput('');
      }
    } else {
      setParsedData(null);
      setExcelOutput('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-8">
      <div className="w-full max-w-6xl mx-auto px-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden transition-colors">
          <div className="animated-lightning px-6 py-4">
            <div className="flex items-center justify-center space-x-3">
              <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center overflow-hidden">
                <img 
                  src={noeleImg} 
                  alt="Noele" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-bold force-white">Log Pemadaman Listrik (NEW)</h2>
                <p className="text-white/90 mt-1">Ctrl C + V ae</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-800 dark:text-slate-200 mb-2">Input</label>
                <textarea
                  value={inputText}
                  onChange={handleChange}
                  placeholder="Paste drag wa langsung aja "
                  className="w-full h-64 p-4 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400"
                />
                <p className="text-xs text-gray-500 mt-2">Kolom: Customer, ID ATM, LOKASI, AREA, DOWNTIME (date, time), UPTIME (date, time), DURATION, CONFIRM BY, REMAKS</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-800 dark:text-slate-200">Output Excel (TSV)</label>
                  {excelOutput && (
                    <button
                      onClick={() => copyToClipboard(excelOutput)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center space-x-2 ${
                        copySuccess ? 'bg-green-500 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'
                      }`}
                    >
                      {copySuccess ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                <textarea
                  value={excelOutput}
                  readOnly
                  placeholder="Hasil e Kingg"
                  className="w-full h-64 p-4 border border-gray-300 dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-900 dark:text-slate-100 resize-none"
                />
              </div>
            </div>

            {parsedData && (
              <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-300 mb-3">Preview</h3>
                <div className="space-y-4">
                  {parsedData.map((item, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-900 p-3 rounded border border-gray-200 dark:border-slate-700">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Object.entries(item).map(([key, value]) => (
                          <div key={key} className="">
                            <div className="text-sm font-medium text-gray-600 dark:text-slate-300 capitalize">
                              {key.replace(/([A-Z])/g, ' $1').trim()}:
                            </div>
                            <div className="text-sm text-gray-900 dark:text-slate-100 mt-1">{value || '-'}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogPemadamanListrikNew;


