// cuman Replace modem ke , to, RBM33 / RB9511


import React, { useState } from 'react';
import erisImg from '../assets/eris.jpg';

type Kelolaan = 'ATMi' | 'BRINKS' | 'ARTAJASA' | 'JALIN' | '';

interface ParsedMaintenanceData {
  kelolaan: Kelolaan;
  tanggalKunjungan: string;
  idAtm: string;
  lokasi: string;
  area: string;
  waktuKunjungan: string;
  serialNumber: string;
  problems: string[];
  actions: string[];
  kegiatan: string;
  typeAction: string;
  typeModemBaru: string;
  status: string;
  keterangan: string;
  selesai: string;
  picMt: string;
  picToko: string;
  picFlm: string;
}

const LogMaintenanceAll: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [parsedData, setParsedData] = useState<ParsedMaintenanceData | null>(null);
  const [excelOutput, setExcelOutput] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  const detectKelolaan = (text: string): Kelolaan => {
    const rawLines = text.split('\n');
    // Ignore lines that declare CIT to avoid false positives (e.g., CIT: BRINKS)
    const lines = rawLines.filter(l => !/^\s*CIT\s*:/i.test(l));

    // Prefer explicit header patterns like "Preventive Maintenance <Kelolaan>", "Open Tiket <Kelolaan>", or "Kegiatan Preventive Maintenance <Kelolaan>"
    const headerLine = lines.find(l => 
      /Preventive\s+Maintenance/i.test(l) || 
      /Open\s*Tiket/i.test(l) || 
      /Open\s*Ticket/i.test(l) ||
      /Kegiatan\s+Preventive/i.test(l) ||
      /Kegiatan\s+Maintenance/i.test(l)
    );
    if (headerLine) {
      const h = headerLine;
      if (/\bATM[-\s]?I\b/i.test(h) || /\bATMI\b/i.test(h)) return 'ATMi';
      if (/\bBRINKS\b/i.test(h)) return 'BRINKS';
      if (/\bARTAJASA\b/i.test(h) || /\bAJ\b/i.test(h)) return 'ARTAJASA';
      if (/\bJALIN\b/i.test(h)) return 'JALIN';
    }

    // Fallback: scan early lines (still ignoring CIT)
    const firstChunk = lines.slice(0, 12).join(' ');
    if (/\bATM[-\s]?I\b/i.test(firstChunk) || /\bATMI\b/i.test(firstChunk)) return 'ATMi';
    if (/\bBRINKS\b/i.test(firstChunk)) return 'BRINKS';
    if (/\bARTAJASA\b/i.test(firstChunk) || /\bAJ\b/i.test(firstChunk)) return 'ARTAJASA';
    if (/\bJALIN\b/i.test(firstChunk)) return 'JALIN';
    return '';
  };

  const normalizeKegiatan = (raw: string) => {
    const s = raw.toUpperCase();
    if (s.includes('PREVENTIVE')) return 'PREVENTIVE MAINTENANCE (PM)';
    if (s.includes('OPEN TICKET') || s.includes('OPEN TIKET') || s.includes('(OT)') || s === 'OT') return 'OPEN TICKET (OT)';
    if (s.includes('DISMANTLE')) return 'DISMANTLE';
    if (s.includes('RELOKASI') || s.includes('RELOCATION')) return 'RELOKASI';
    if (s.includes('REAKTIVASI') || s.includes('REACTIVATION')) return 'REAKTIVASI';
    return raw.toUpperCase();
  };
  const normalizeTypeAction = (sourceActions: string[]) => {
    const joined = sourceActions.join(' ').toUpperCase();
    
    // Priority 1: REPLACE MODEM (termasuk pattern "Replace to RBM", "Replace ke RBM", dll)
    if (/(REPLACE\s*MODEM|GANTI\s*MODEM)/.test(joined)) return 'REPLACE MODEM';
    if (/(REPLACE.*(KE|TO)\s*(RBM|RB951)|REPLACE\s*(RBM|RB951)|GANTI.*(KE|TO)\s*(RBM|RB951)|GANTI\s*(RBM|RB951))/.test(joined)) return 'REPLACE MODEM';
    
    // Priority 2: REPLACE SIMCARD/PROVIDER (even with maintenance activities)
    // Jika ada kata "replace simcard" atau "replace provider", langsung dianggap REPLACE PROVIDER/SIMCARD
    // MESKIPUN ada juga maintenance activities (karena bisa ada 2 simcard: 1 replace, 1 maintenance)
    if (/(REPLACE.*(PROVIDER|SIM)|GANTI.*(PROVIDER|SIM))/.test(joined)) {
      return 'REPLACE PROVIDER/SIMCARD';
    }
    
    // Priority 3: OTHER (maintenance only, no replace)
    return 'OTHER';
  };
  const normalizeTypeModem = (raw: string) => {
    const s = raw.toUpperCase();
    if (s.includes('RBM33')) return 'RBM33';
    if (s.includes('RB951')) return 'RB951';
    return raw;
  };

  const parseMaintenanceData = (text: string): ParsedMaintenanceData | null => {
    try {
      const kelolaan = detectKelolaan(text);
      const rawLines = text.split('\n').map(line => line.trim());
      const lines = rawLines.filter(line => line.length > 0);

      const afterFirstColon = (l: string) => l.replace(/^[^:]*:\s*/, '').trim();
      const isBullet = (l: string) => /^[\s]*[-*]\s*/.test(l);
      const stripBullet = (l: string) => l.replace(/^[\s]*[-*]\s*/, '').trim();

      const parsed: ParsedMaintenanceData = {
        kelolaan,
        tanggalKunjungan: '',
        idAtm: '',
        lokasi: '',
        area: '',
        waktuKunjungan: '',
        serialNumber: '',
        problems: [],
        actions: [],
        kegiatan: '',
        typeAction: '',
        typeModemBaru: '',
        status: '',
        keterangan: '',
        selesai: '',
        picMt: '',
        picToko: '',
        picFlm: ''
      };

      let currentSection: 'PROBLEM' | 'ACTION' | null = null;

      lines.forEach(line => {
        // Check for section headers first
        if (/^Problem\s*:/.test(line)) {
          // capture inline problem text if present
          const inline = afterFirstColon(line);
          if (inline) parsed.problems.push(inline);
          currentSection = 'PROBLEM';
          return;
        }
        if (/^Action\s*:/.test(line)) {
          // capture inline actions if present (split by comma / dan / &)
          const inline = afterFirstColon(line);
          if (inline) {
            const parts = inline.split(/,|\s+dan\s+|\s+&\s+/i).map(s => s.trim()).filter(Boolean);
            if (parts.length) parsed.actions.push(...parts);
          }
          currentSection = 'ACTION';
          return;
        }

        // Handle bullet points in current section
        if (currentSection === 'PROBLEM' && isBullet(line)) { 
          parsed.problems.push(stripBullet(line)); 
          return; 
        }
        if (currentSection === 'ACTION' && isBullet(line)) { 
          parsed.actions.push(stripBullet(line)); 
          return; 
        }

        // Reset section if we encounter specific field lines that indicate end of bullet lists
        if (!isBullet(line) && currentSection) {
          // Known fields that come after Problem/Action sections
          if (/^(Simcard|Status|Selesai|PIC|CIT|Jarak|Jam|Tanggal|ID ATM|Lokasi|Area|Waktu|Serial|Kegiatan|Type)/i.test(line)) {
            currentSection = null;
          }
          // Or any line with colon that's not Problem/Action and not empty after colon
          else if (line.includes(':') && !(/^(Problem|Action)\s*:/i.test(line))) {
            const afterColon = afterFirstColon(line);
            if (afterColon.length > 0) { // Only reset if there's actual content after colon
              currentSection = null;
            }
          }
        }

        if (/Open\s*Tiket/i.test(line) || /\(OT\)/i.test(line)) parsed.kegiatan = 'OPEN TICKET (OT)';

        if (line.includes('Tanggal Kunjungan')) parsed.tanggalKunjungan = afterFirstColon(line);
        else if (/^Tgl\s*Kunjungan/i.test(line)) parsed.tanggalKunjungan = afterFirstColon(line);
        else if (line.startsWith('ID ATM')) parsed.idAtm = afterFirstColon(line);
        else if (line.toUpperCase().startsWith('LOKASI')) parsed.lokasi = afterFirstColon(line);
        else if (/^Relokasi\s*ke/i.test(line)) parsed.lokasi = afterFirstColon(line);
        else if (/^Lokasi\s+Lama/i.test(line)) {
          const oldLoc = afterFirstColon(line);
          if (oldLoc) parsed.keterangan = parsed.keterangan ? `${parsed.keterangan}\nLokasi Ex${oldLoc}` : `Lokasi Ex${oldLoc}`;
        }
        else if (line.toUpperCase().startsWith('AREA')) parsed.area = afterFirstColon(line);
        else if (line.startsWith('Waktu Kunjungan')) parsed.waktuKunjungan = afterFirstColon(line);
        else if (line.toUpperCase().startsWith('SERIAL NUMBER')) {
          let serial = afterFirstColon(line);
          // Clean up trailing commas and spaces
          serial = serial.replace(/[,\s]+$/, '').trim();
          parsed.serialNumber = serial;
        }
        else if (line.toUpperCase().startsWith('KEGIATAN')) parsed.kegiatan = normalizeKegiatan(afterFirstColon(line));
        else if (line.toUpperCase().startsWith('TYPE MODEM')) parsed.typeModemBaru = normalizeTypeModem(afterFirstColon(line));
        else if (line.startsWith('Status')) {
          const statusRaw = afterFirstColon(line);
          const s = statusRaw.toLowerCase();
          if (s.includes('atm online') && s.includes('dual')) {
            parsed.status = 'ATM Online, UP dual link';
          } else {
            parsed.status = statusRaw;
          }
          // extract UPS info inside parentheses or note
          const upsNote = statusRaw.match(/\(([^)]*ups[^)]*)\)/i);
          if (upsNote && upsNote[1]) {
            const text = upsNote[1].replace(/\s+/g,' ').trim();
            parsed.keterangan = parsed.keterangan ? `${parsed.keterangan} kelistrikan ATM dan Modem : ${text}` : `kelistrikan ATM dan Modem : ${text}`;
          }
        }
        else if (line.startsWith('Selesai')) parsed.selesai = afterFirstColon(line);
        else if (line.startsWith('PIC MT')) parsed.picMt = afterFirstColon(line);
        else if (line.startsWith('PIC Toko')) parsed.picToko = afterFirstColon(line);
        else if (line.startsWith('PIC FLM')) parsed.picFlm = afterFirstColon(line);
        else if ((/UPS/i.test(line) || /Kelistrikan/i.test(line)) && !/Jam Operasional/i.test(line)) {
          const val = afterFirstColon(line) || line;
          // Handle various UPS formats
          let cleanVal = val;
          if (/menggunakan\s+tidak\s+menggunakan\s+UPS/i.test(val)) {
            cleanVal = 'tidak menggunakan UPS';
          } else if (/Kelistrikan\s+ATM\s+dan\s+Modem\s*:\s*Menggunakan\s+UPS/i.test(line)) {
            cleanVal = 'ATM dan Modem menggunakan UPS';
          } else if (/Menggunakan\s+UPS/i.test(val)) {
            cleanVal = 'ATM dan Modem menggunakan UPS';
          } else if (/tidak\s+menggunakan\s+UPS/i.test(val)) {
            cleanVal = 'ATM dan Modem tidak menggunakan UPS';
          }
          parsed.keterangan = parsed.keterangan ? `${parsed.keterangan}\n${cleanVal}` : cleanVal;
        } else if (/RBM(33|951)/i.test(line)) {
          parsed.typeModemBaru = normalizeTypeModem(line);
        }
      });

      if (!parsed.kegiatan) {
        const textUpper = text.toUpperCase();
        // Check for header patterns first
        if (/KEGIATAN\s+MAINTENANCE/i.test(textUpper) || /KEGIATAN\s+PREVENTIVE\s+MAINTENANCE/i.test(textUpper) || /PREVENTIVE\s+MAINTENANCE/i.test(textUpper)) {
          parsed.kegiatan = 'PREVENTIVE MAINTENANCE (PM)';
        }
        else if (textUpper.includes('OPEN TICKET') || textUpper.includes('OPEN TIKET') || textUpper.includes('(OT)') || /\bOT\b/.test(textUpper)) parsed.kegiatan = 'OPEN TICKET (OT)';
        else if (textUpper.includes('DISMANTLE')) parsed.kegiatan = 'DISMANTLE';
        else if (textUpper.includes('RELOKASI')) parsed.kegiatan = 'RELOKASI';
        else if (textUpper.includes('REAKTIVASI')) parsed.kegiatan = 'REAKTIVASI';
      }
      parsed.typeAction = normalizeTypeAction(parsed.actions);

      // Infer TYPE Modem (Baru) from ACTION bullets if not explicitly provided
      if (!parsed.typeModemBaru && parsed.actions.length) {
        const joined = parsed.actions.join(' ').toUpperCase();
        
        // Deteksi RBM33 - baik dari nama langsung atau dari replace pattern
        if (/RBM\s*33|RBM33/.test(joined)) {
          parsed.typeModemBaru = 'RBM33';
        } 
        // Deteksi "Replace Modem ke RBM", "Replace to RBM", "Replace RBM", dll
        else if (/(REPLACE.*MODEM.*(KE|TO)\s*RBM|REPLACE.*RBM|GANTI.*MODEM.*(KE|TO)\s*RBM|GANTI.*RBM)/.test(joined)) {
          parsed.typeModemBaru = 'RBM33';
        }
        // Deteksi RB951 - baik dari nama langsung atau dari replace pattern  
        else if (/RB\s*951|RB951/.test(joined)) {
          parsed.typeModemBaru = 'RB951';
        }
        // Deteksi "Replace Modem ke RB951", dll
        else if (/(REPLACE.*MODEM.*(KE|TO)\s*RB951|REPLACE.*RB951|GANTI.*MODEM.*(KE|TO)\s*RB951|GANTI.*RB951)/.test(joined)) {
          parsed.typeModemBaru = 'RB951';
        }
      }

      return parsed;
    } catch (e) {
      console.error('Error parsing maintenance data ALL:', e);
      return null;
    }
  };

  const parseTime = (t: string): number | null => {
    const m = t.replace(/\bWIB\b/i, '').match(/(\d{1,2})[:.](\d{2})/);
    if (!m) return null;
    const h = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    if (Number.isNaN(h) || Number.isNaN(mm)) return null;
    return h * 60 + mm;
  };

  const stripWIB = (v: string): string => v.replace(/\bWIB\b/i, '').trim();
  const formatDurationHMS = (start: string, end: string): string => {
    const s = parseTime(start);
    const e = parseTime(end);
    if (s == null || e == null) return '';
    let diff = e - s;
    if (diff < 0) diff += 24 * 60;
    const hh = Math.floor(diff / 60).toString().padStart(2, '0');
    const mm = Math.floor(diff % 60).toString().padStart(2, '0');
    return `${hh}:${mm}:00`;
  };
  const pickPic = (d: ParsedMaintenanceData) => d.picMt || d.picFlm || d.picToko || '';
  const escapeTsvField = (value: string): string => {
    if (!value) return '';
    // Replace line breaks and clean up any extra tabs that might break TSV format
    return value.replace(/\r?\n/g, '\n').replace(/\t/g, ' ');
  };

  const generateExcelOutput = (data: ParsedMaintenanceData): string => {
    const awal = stripWIB(data.waktuKunjungan);
    const akhir = stripWIB(data.selesai);
    const durasi = awal && akhir ? formatDurationHMS(awal, akhir) : '';
    const customer = data.kelolaan; // jika kosong, kolom Customer di-skip

    const problemsField = data.problems.length > 1
      ? `"${data.problems.map(p => `- ${p}`).join('\r\n')}"`
      : (data.problems[0] || '');
    const actionsField = data.actions.length > 1
      ? `"${data.actions.map(a => `- ${a}`).join('\r\n')}"`
      : (data.actions[0] || '');

    const values = (
      customer
        ? [
            customer || '',
            data.tanggalKunjungan || '',
            data.kegiatan || '',
            data.idAtm || '',
            data.serialNumber || '',
            data.lokasi || '',
            problemsField,
            awal || '',
            data.typeAction || '',
            data.typeModemBaru || '',
            actionsField,
            akhir || '',
            durasi || '',
            pickPic(data) || '',
            data.status || '',
            data.keterangan || ''
          ]
        : [
            data.tanggalKunjungan || '',
            data.kegiatan || '',
            data.idAtm || '',
            data.serialNumber || '',
            data.lokasi || '',
            problemsField,
            awal || '',
            data.typeAction || '',
            data.typeModemBaru || '',
            actionsField,
            akhir || '',
            durasi || '',
            pickPic(data) || '',
            data.status || '',
            data.keterangan || ''
          ]
    );
    return values.map(escapeTsvField).join('\t');
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setInputText(text);
    if (text.trim()) {
      const parsed = parseMaintenanceData(text);
      if (parsed) {
        setParsedData(parsed);
        setExcelOutput(generateExcelOutput(parsed));
      }
    } else {
      setParsedData(null);
      setExcelOutput('');
    }
  };

  const headerColor = (kel: Kelolaan) => {
    switch (kel) {
      case 'ATMi': return 'from-indigo-500 to-sky-600';
      case 'BRINKS': return 'from-cyan-500 to-emerald-600';
      case 'ARTAJASA': return 'from-blue-500 to-purple-600';
      case 'JALIN': return 'from-pink-500 to-green-500';
      default: return 'from-rose-500 to-amber-500';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-8">
      <div className="w-full max-w-6xl mx-auto px-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden transition-colors">
          <div className={`
            ${!inputText.trim()
              ? 'animated-purple-gradient'
              : !parsedData?.kelolaan && inputText.trim()
                ? 'animated-red-yellow-flash'
                : parsedData?.kelolaan === 'JALIN'
                  ? 'animated-pink-green'
                  : parsedData?.kelolaan === 'BRINKS'
                    ? 'animated-blue-green'
                    : parsedData?.kelolaan === 'ARTAJASA'
                      ? 'animated-yellow-green'
                      : parsedData?.kelolaan === 'ATMi'
                        ? 'animated-pink-red'
                        : `bg-gradient-to-r ${headerColor(parsedData?.kelolaan || '')}`}
            px-6 py-4`}>
            <div className="flex items-center justify-center space-x-3">
              <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center overflow-hidden">
                <img 
                  src={erisImg} 
                  alt="Eris" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-bold force-white">LOG({
                  !inputText.trim()
                    ? 'Maintenance'
                    : (parsedData?.kelolaan || 'KELOLAAN RA DETEK, tambah manual wae')
                })</h2>
                <p className="text-white/80 mt-1">Ctrl C + V ae</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-800 dark:text-slate-200 mb-2">
                  Paste Log Maintenance (ATMi/BRINKS/ARTAJASA/JALIN)
                </label>
                <textarea
                  value={inputText}
                  onChange={handleInputChange}
                  placeholder="Paste aja, relokasi masih gatau"
                  className="w-full h-64 p-4 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Kolom Excel: Customer, Tanggal, Kegiatan, ID ATM, SERIAL NUMBER, Lokasi, PROBLEM, Awal Kunjungan, TYPE ACTION, TYPE Modem (Baru), ACTION, Akhir Kunjungan, Durasi, PIC, STATUS, Keterangan.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">
                    Output Spreadsheet (TSV)
                  </label>
                  {excelOutput && (
                    <button
                      onClick={() => copyToClipboard(excelOutput)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center space-x-2 ${
                        copySuccess 
                          ? 'bg-green-500 text-white' 
                          : 'bg-emerald-500 hover:bg-emerald-600 text-white'
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
                <p className="text-xs text-gray-500 mt-2">Format: TSV (tab-separated; bullets multiline di satu sel)</p>
              </div>
            </div>

            {parsedData && (
              <div className="mt-6 p-4 bg-emerald-50 rounded-lg">
                <h3 className="text-lg font-semibold text-emerald-800 mb-3">Preview Data yang Terparse:</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-white p-3 rounded border"><div className="text-sm font-medium text-gray-600">Customer</div><div className="text-sm mt-1 dark:text-black">{parsedData.kelolaan || '-'}</div></div>
                  <div className="bg-white p-3 rounded border"><div className="text-sm font-medium text-gray-600">Tanggal</div><div className="text-sm mt-1 dark:text-black">{parsedData.tanggalKunjungan || '-'}</div></div>
                  <div className="bg-white p-3 rounded border"><div className="text-sm font-medium text-gray-600">Kegiatan</div><div className="text-sm mt-1 dark:text-black">{parsedData.kegiatan || '-'}</div></div>
                  <div className="bg-white p-3 rounded border"><div className="text-sm font-medium text-gray-600">ID ATM</div><div className="text-sm mt-1 dark:text-black">{parsedData.idAtm || '-'}</div></div>
                  <div className="bg-white p-3 rounded border"><div className="text-sm font-medium text-gray-600">Serial Number</div><div className="text-sm mt-1 dark:text-black">{parsedData.serialNumber || '-'}</div></div>
                  <div className="bg-white p-3 rounded border md:col-span-2 lg:col-span-3"><div className="text-sm font-medium text-gray-600">Lokasi</div><div className="text-sm mt-1 dark:text-black">{parsedData.lokasi || '-'}</div></div>
                  <div className="bg-white p-3 rounded border md:col-span-2 lg:col-span-3"><div className="text-sm font-medium text-gray-600">Problem</div><div className="text-sm mt-1 dark:text-black">{parsedData.problems.length ? parsedData.problems.join(', ') : '-'}</div></div>
                  <div className="bg-white p-3 rounded border md:col-span-2 lg:col-span-3"><div className="text-sm font-medium text-gray-600">Action</div><div className="text-sm mt-1 dark:text-black">{parsedData.actions.length ? parsedData.actions.join(', ') : '-'}</div></div>
                  <div className="bg-white p-3 rounded border"><div className="text-sm font-medium text-gray-600">Awal Kunjungan</div><div className="text-sm mt-1 dark:text-black">{parsedData.waktuKunjungan || '-'}</div></div>
                  <div className="bg-white p-3 rounded border"><div className="text-sm font-medium text-gray-600">Akhir Kunjungan</div><div className="text-sm mt-1 dark:text-black">{parsedData.selesai || '-'}</div></div>
                  <div className="bg-white p-3 rounded border"><div className="text-sm font-medium text-gray-600">TYPE ACTION</div><div className="text-sm mt-1 dark:text-black">{parsedData.typeAction || '-'}</div></div>
                  <div className="bg-white p-3 rounded border"><div className="text-sm font-medium text-gray-600">TYPE Modem (Baru)</div><div className="text-sm mt-1 dark:text-black">{parsedData.typeModemBaru || '-'}</div></div>
                  <div className="bg-white p-3 rounded border md:col-span-2 lg:col-span-3"><div className="text-sm font-medium text-gray-600">Status</div><div className="text-sm mt-1 dark:text-black">{parsedData.status || '-'}</div></div>
                  <div className="bg-white p-3 rounded border md:col-span-2 lg:col-span-3"><div className="text-sm font-medium text-gray-600">Keterangan</div><div className="text-sm mt-1 dark:text-black" style={{ whiteSpace: 'pre-wrap' }}>{parsedData.keterangan || '-'}</div></div>
                  <div className="bg-white p-3 rounded border"><div className="text-sm font-medium text-gray-600">PIC</div><div className="text-sm mt-1 dark:text-black">{(parsedData.picMt || parsedData.picFlm || parsedData.picToko) || '-'}</div></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogMaintenanceAll;


