import fetch from "node-fetch";


const messageTracker = new Map();
const messageAliases = new Map();
const reverseLookup = new Map(); 

// ================= Outage/Pemadaman Parsing Function 4 kelolaanee =================
function detectCustomer(text) {
  const t = text.toUpperCase();
  if (/\bATMI\b/i.test(t)) return "ATMi";
  if (/\bARTAJASA\b/.test(t)) return "ARTAJASA";
  if (/\bBRINKS\b/.test(t)) return "BRINKS";
  if (/\bJALIN\b/.test(t)) return "JALIN";
  return "";
}

// Helper function untuk mengecek apakah line adalah customer line
function isCustomerLine(line) {
  const cleanLine = line.trim().toUpperCase();
  return /^(JALIN|JALIN-BTN|JALIN-MANDIRI|ATMi|ARTAJASA|BRINKS)\b/.test(cleanLine);
}

// Helper function untuk membersihkan text dari karakter yang bisa merusak parsing
function cleanText(text) {
  if (!text) return '';
  return text.replace(/[\t\r\n*]+/g, ' ').trim();
}

// Helper function untuk format tanggal dengan leading zero
function formatDateWithLeadingZero(dateString) {
  if (!dateString) return '';
  
  const dateMatch = dateString.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (dateMatch) {
    const day = parseInt(dateMatch[1]).toString().padStart(2, '0');
    const month = dateMatch[2];
    const year = dateMatch[3];
    return `${day} ${month} ${year}`;
  }
  return dateString;
}

// Helper function untuk format waktu dengan leading zero
function formatTimeWithLeadingZero(timeString) {
  if (!timeString) return '';
  
  const timeMatch = timeString.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (timeMatch) {
    const hour = timeMatch[1].padStart(2, '0');
    const minute = timeMatch[2].padStart(2, '0');
    const second = timeMatch[3] ? timeMatch[3].padStart(2, '0') : '';
    
    return second ? `${hour}:${minute}:${second}` : `${hour}:${minute}`;
  }
  return timeString;
}

function parseMultipleOutageData(rawText) {
  if (!rawText) return [];
  
  // Split text (ATMI, ARTAJASA, BRINKS, JALIN) penting ada keempat itu
  const lines = rawText.split('\n');
  let currentBlock = [];
  const blocks = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Cek kondisinya kalau ada di 4 kelolaan
    if (/^(ATMI|ATMi|ARTAJASA|BRINKS|JALIN)\s*$/i.test(line)) {
      // If we have a current block, save it
      if (currentBlock.length > 0) {
        blocks.push(currentBlock.join('\n'));
      }
      // Blok baru berdasarkan kelolaan
      currentBlock = [line];
    } else if (line) {
      // kalau ada isinya push line nya
      currentBlock.push(line);
    }
  }
  
  // Cek kalau diblok pesannya lebih dari satu di join terus dipisah.
  if (currentBlock.length > 0) {
    blocks.push(currentBlock.join('\n'));
  }
  
  console.log(`📊 [MULTI-PARSE] Found ${blocks.length} data blocks`);
  
  // Parse blok satu" ben ra nabrak (unit testing bree)
  const results = [];
  blocks.forEach((block, index) => {
    console.log(`🔍 [BLOCK ${index + 1}] Processing:`, block.substring(0, 50) + "...");
    const parsed = parseOutageData(block);
    if (parsed && parsed.customer) {
      results.push(parsed);
      console.log(`✅ [BLOCK ${index + 1}] Berhasil parse: ${parsed.customer}`);
    } else {
      console.log(`❌ [BLOCK ${index + 1}] Gagal parse atau kelolaan gaada`);
    }
  });
  
  return results;
}

function parseOutageData(rawText) {
  if (!rawText) return null;
  try {
    const text = rawText.replace(/^\[[^\]]+\]\s*[^:]*:\s*/gm, "");
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const afterFirstColon = (l) => l.replace(/^[^:]*:\s*/, "").trim();
    
    console.log(`🔍 [PARSE] Input lines:`, lines.map((l, i) => `${i}: "${l}"`));

    const parsed = {
      customer: detectCustomer(text),
      idAtm: "",
      lokasi: "",
      area: "",
      downtimeDate: "",
      downtimeTime: "",
      uptimeDate: "",
      uptimeTime: "",
      duration: "",
      confirmBy: "",
      remarks: ""
    };

    const idLocLine = lines.find(l => /-/.test(l) && !/^(JALIN|ATMi|ARTAJASA|BRINKS)/i.test(l));
    if (idLocLine) {
      console.log(`🔍 [ID-LOC] Processing line: "${idLocLine}"`);
      
      // Untuk format seperti: T0800146-S1AN1ABV - PLG IM TJ API-API 01
      // atau T2004866 - KLINIK BUNDA RGJ
      // atau S1AW12Z0-T0802163 - TNG IM BINTARO 2
      
      // Cari pola: ID_COMPLEX - LOKASI
      // ID bisa mengandung dash internal, tapi ada spasi sebelum dash pemisah
      const separatorMatch = idLocLine.match(/^(.+?)\s+-\s+(.+)$/);
      
      if (separatorMatch) {
        parsed.idAtm = separatorMatch[1].trim();
        parsed.lokasi = separatorMatch[2].trim();
        console.log(`✅ [ID-LOC] Parsed - ID: "${parsed.idAtm}", Lokasi: "${parsed.lokasi}"`);
      } else {
        // Fallback untuk format tanpa spasi sebelum dash
        // Cari dash terakhir sebagai pemisah
        const lastDashIndex = idLocLine.lastIndexOf('-');
        if (lastDashIndex > 0 && lastDashIndex < idLocLine.length - 1) {
          parsed.idAtm = idLocLine.substring(0, lastDashIndex).trim();
          parsed.lokasi = idLocLine.substring(lastDashIndex + 1).trim();
          console.log(`⚠️ [ID-LOC] Fallback - ID: "${parsed.idAtm}", Lokasi: "${parsed.lokasi}"`);
        } else {
          // Final fallback - ambil seluruh line sebagai ID jika tidak ada dash yang valid
          parsed.idAtm = idLocLine.trim();
          parsed.lokasi = "";
          console.log(`❌ [ID-LOC] No valid separator - ID: "${parsed.idAtm}", Lokasi: empty`);
        }
      }
    }

    const areaLine = lines.find(l => /^Area\s*:/i.test(l));
    if (areaLine) parsed.area = afterFirstColon(areaLine);

    const problemLine = lines.find(l => /^Problem\s*:/i.test(l));
    if (problemLine) parsed.remarks = afterFirstColon(problemLine);

    const timeLine = lines.find(l => /^Pukul\s*:|^Pukul/i.test(l));
    if (timeLine) {
      const raw = afterFirstColon(timeLine);
      const timeMatch = raw.match(/\b(\d{1,2}:\d{2}(?::\d{2})?)\b/);
      if (timeMatch) {
        const timeStr = timeMatch[1];
        const timeParts = timeStr.split(':');
        // Pastikan jam dan menit menggunakan leading zero
        const formattedHour = timeParts[0].padStart(2, '0');
        const formattedMinute = timeParts[1].padStart(2, '0');
        const formattedSecond = timeParts[2] ? timeParts[2].padStart(2, '0') : '';
        
        parsed.downtimeTime = formattedSecond ? 
          `${formattedHour}:${formattedMinute}:${formattedSecond}` : 
          `${formattedHour}:${formattedMinute}`;
        
        console.log(`⏰ [TIME] Formatted: "${timeStr}" -> "${parsed.downtimeTime}"`);
      } else {
        parsed.downtimeTime = raw.trim();
        console.log(`⏰ [TIME] Kept original: "${raw}"`);
      }
    }

    const infoLine = lines.find(l => /^Info\s*:/i.test(l));
    if (infoLine) parsed.confirmBy = afterFirstColon(infoLine);

    // Parsing tanggal dengan berbagai format dan pastikan menggunakan leading zero
    const dateMatch = text.match(/\b(\d{1,2}\s+[A-Za-z]+\s+\d{4})\b/);
    if (dateMatch) {
      const rawDate = dateMatch[1];
      
      // Parse komponen tanggal
      const dateParts = rawDate.split(/\s+/);
      if (dateParts.length === 3) {
        let day = parseInt(dateParts[0]);
        let month = dateParts[1];
        let year = dateParts[2];
        
        // Pastikan day menggunakan leading zero (01, 02, dst)
        const formattedDay = day.toString().padStart(2, '0');
        
        // Standardisasi nama bulan ke format Indonesia
        const months = {
          'january': 'Januari', 'februari': 'Februari', 'march': 'Maret', 'april': 'April',
          'may': 'Mei', 'june': 'Juni', 'july': 'Juli', 'august': 'Agustus',
          'september': 'September', 'october': 'Oktober', 'november': 'November', 'december': 'December',
          'januari': 'Januari', 'maret': 'Maret', 'mei': 'Mei', 'juni': 'Juni',
          'juli': 'Juli', 'agustus': 'Agustus', 'oktober': 'Oktober', 'desember': 'December'
        };
        
        const formattedMonth = months[month.toLowerCase()] || month;
        
        parsed.downtimeDate = `${formattedDay} ${formattedMonth} ${year}`;
        console.log(`📅 [DATE] Parsed: "${rawDate}" -> "${parsed.downtimeDate}"`);
      } else {
        // Fallback jika format tidak sesuai
        parsed.downtimeDate = rawDate;
        console.log(`📅 [DATE] Kept original: "${rawDate}"`);
      }
    } else {
      // Fallback ke tanggal hari ini dengan leading zero
      const bulan = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
      const now = new Date();
      const formattedDay = now.getDate().toString().padStart(2, '0');
      parsed.downtimeDate = `${formattedDay} ${bulan[now.getMonth()]} ${now.getFullYear()}`;
      console.log(`📅 [DATE] Using today: "${parsed.downtimeDate}"`);
    }

    // Validasi dan cleanup final
    console.log(`📋 [PARSE-FINAL] Result before cleanup:`, {
      customer: `"${parsed.customer}"`,
      idAtm: `"${parsed.idAtm}"`,
      lokasi: `"${parsed.lokasi}"`,
      area: `"${parsed.area}"`,
      downtimeDate: `"${parsed.downtimeDate}"`,
      downtimeTime: `"${parsed.downtimeTime}"`,
      confirmBy: `"${parsed.confirmBy}"`,
      remarks: `"${parsed.remarks}"`
    });
    
    // Pastikan tidak ada field yang mengandung karakter aneh atau tab
    Object.keys(parsed).forEach(key => {
      if (typeof parsed[key] === 'string') {
        // Hapus karakter tab, newline, dan whitespace berlebih
        parsed[key] = parsed[key].replace(/[\t\r\n]+/g, ' ').trim();
        
        // Hapus karakter khusus yang bisa merusak format sheet
        parsed[key] = parsed[key].replace(/[*]/g, '').trim();
      }
    });
    
    console.log(`✅ [PARSE-FINAL] Cleaned result:`, {
      customer: `"${parsed.customer}"`,
      idAtm: `"${parsed.idAtm}"`,
      lokasi: `"${parsed.lokasi}"`,
      area: `"${parsed.area}"`
    });

    return parsed;
  } catch (e) {
    console.error("❌ [PARSE] Parse outage error", e);
    return null;
  }
}

// ================= Google Sheets Functions buat Outage atau Pemadaman =================
async function appendToOutageSheet(values, getAccessToken, SHEET_ID, getOutageSheetName) {
  try {
    const accessToken = await getAccessToken();
    const sheetName = getOutageSheetName();
    
    console.log(`📋 [OUTAGE] Sheet yg dipakai: ${sheetName}`);

    // Kolom B dari baris 4-1000 untuk cari baris kosong
    const checkUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${sheetName}!B4:B1000`;
    const checkRes = await fetch(checkUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const checkData = await checkRes.json();
    const existing = checkData.values || [];

    // Cari baris kosong pertama (customer kosong)
    let nextRow = 4;
    for (let i = 0; i < 997; i++) { // 997 baris = 4 sampai 1000
      const cell = existing[i] ? existing[i][0] : "";
      if (!cell || cell.trim() === "") {
        nextRow = 4 + i;
        break;
      }
    }

    console.log(`📍 [OUTAGE] Baris kosong ada di ${nextRow}`);

    // 2. Tembak baris kosong (pakai append bug terus bzirlah, pakai PUT!)
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${sheetName}!B${nextRow}:L${nextRow}?valueInputOption=USER_ENTERED`;

    const valuesWithoutNo = values.slice(1); // skip kolom A
    const body = { values: [valuesWithoutNo] };

    const res = await fetch(updateUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    console.log("📡 [OUTAGE] Response status:", res.status);

    if (!res.ok) {
      const errorText = await res.text();
      console.error("❌ [OUTAGE] Gagal update sheet:", errorText);
      return null;
    } else {
      const responseData = await res.json();
      console.log("✅ [OUTAGE] Data berhasil ditambahkan di baris:", nextRow);
      console.log("📍 [OUTAGE] updatedRange:", responseData.updatedRange || responseData);
      return nextRow; // Return row number untuk tracking
    }
  } catch (error) {
    console.error("❌ [OUTAGE] Error dalam appendToOutageSheet:", error);
    return null;
  }
}

// ================= Kondisi nek satu chat ada beberapa block!! =================
// ================= Helper Functions untuk Message Tracking =================
function findMessageData(messageId) {
  // Cari langsung di tracker utama
  if (messageTracker.has(messageId)) {
    return { id: messageId, data: messageTracker.get(messageId) };
  }
  
  // Cari di aliases
  if (messageAliases.has(messageId)) {
    const primaryId = messageAliases.get(messageId);
    if (messageTracker.has(primaryId)) {
      return { id: primaryId, data: messageTracker.get(primaryId) };
    }
  }
  
  // Cari berdasarkan similarity (untuk ID yang mirip tapi beda karakter)
  for (const [trackId, data] of messageTracker.entries()) {
    // Check jika ID mirip (contoh: 3F99E5602246487A66B1 vs 3F87728FDC2E34A74EC9)
    if (trackId.length === messageId.length && trackId.length >= 16) {
      let similarChars = 0;
      let prefixMatch = 0;
      let suffixMatch = 0;
      
      // Count overall similarity
      for (let i = 0; i < trackId.length; i++) {
        if (trackId[i] === messageId[i]) {
          similarChars++;
          
          // Check prefix (first 4 chars)
          if (i < 4) prefixMatch++;
          
          // Check suffix (last 4 chars) 
          if (i >= trackId.length - 4) suffixMatch++;
        }
      }
      
      const overallSimilarity = similarChars / trackId.length;
      const prefixSimilarity = prefixMatch / 4;
      const suffixSimilarity = suffixMatch / 4;
      
      // Relaxed threshold for WhatsApp message ID patterns
      // WhatsApp IDs often share prefix but differ significantly in body
      if (prefixSimilarity >= 0.5 || // At least 2/4 prefix chars match (like "3F")
          overallSimilarity >= 0.15 || // Or 15% overall similarity  
          (similarChars >= 3 && trackId.substring(0, 2) === messageId.substring(0, 2))) { // Or first 2 chars + 3 total matches
        
        console.log(`🔍 [SIMILARITY] Found similar ID: ${trackId} for ${messageId}`);
        console.log(`📊 [SIMILARITY] Overall: ${Math.round(overallSimilarity*100)}%, Prefix: ${Math.round(prefixSimilarity*100)}%, Suffix: ${Math.round(suffixSimilarity*100)}%`);
        
        // Simpan alias untuk next time
        messageAliases.set(messageId, trackId);
        return { id: trackId, data: data };
      }
    }
  }
  
  return null;
}

function addMessageToTracker(messageId, sheetRow, data, customer, idAtm) {
  if (sheetRow) {
    messageTracker.set(messageId, {
      sheetRow: sheetRow,
      data: data,
      timestamp: Date.now(),
      customer: customer,
      idAtm: idAtm
    });
    
    // Reverse lookup
    reverseLookup.set(sheetRow, messageId);
    
    console.log(`📌 [TRACKER] Message ${messageId} tracked at row ${sheetRow}`);
  } else {
    console.log(`⚠️ [TRACKER] No row number, cannot track message ${messageId}`);
  }
}

function removeMessageFromTracker(messageId) {
  const found = findMessageData(messageId);
  if (found) {
    // Remove from tracker
    messageTracker.delete(found.id);
    
    // Remove reverse lookup
    if (found.data.sheetRow) {
      reverseLookup.delete(found.data.sheetRow);
    }
    
    // Remove aliases pointing to this message
    for (const [alias, primary] of messageAliases.entries()) {
      if (primary === found.id) {
        messageAliases.delete(alias);
      }
    }
    
    console.log(`📌 [TRACKER] Removed message ${found.id} and its aliases`);
    return true;
  }
  return false;
}

// ================= Message Edit/Delete Handlers =================
async function handleMessageEdit(originalMessageId, newText, messageInfo, getAccessToken, SHEET_ID, formatWaTimestamp, getOutageSheetName) {
  console.log("✏️ [EDIT] Handling message edit for ID:", originalMessageId);
  console.log("📝 [EDIT] New text length:", newText.length);
  console.log("🔍 [EDIT] Current tracker size:", messageTracker.size);
  
  // Debug: tampilkan semua message yang sedang ditrack
  for (const [id, data] of messageTracker.entries()) {
    console.log(`📌 [TRACKER] ID: ${id}, Row: ${data.sheetRow}, Customer: ${data.customer}`);
  }
  
  // Cek apakah pesan asli ada di tracker (gunakan helper function)
  const foundMessage = findMessageData(originalMessageId);
  
  if (!foundMessage) {
    console.log("⚠️ [EDIT] Original message not found in tracker, treating as new message");
    console.log("📋 [EDIT] Available message IDs:", Array.from(messageTracker.keys()));
    return await processOutageEntries(newText, messageInfo, getAccessToken, SHEET_ID, formatWaTimestamp, getOutageSheetName, originalMessageId);
  }
  
  const originalData = foundMessage.data;
  const primaryId = foundMessage.id;
  console.log("📝 [EDIT] Found original message data:", originalData);
  console.log("🔍 [EDIT] Primary ID:", primaryId);
  
  // Parse pesan baru
  const outageParsedArray = parseMultipleOutageData(newText);
  console.log("🔍 [EDIT] Parsed entries from new text:", outageParsedArray.length);
  
  if (outageParsedArray.length > 0) {
    try {
      // Untuk edit: UPDATE data di row yang sama, jangan hapus dan tambah baru
      const outageParsed = outageParsedArray[0]; // Ambil entry pertama
      console.log(`📝 [EDIT] Updating existing row ${originalData.sheetRow} with new data:`, outageParsed.customer, outageParsed.idAtm);
      
      const values = [
        "", // kolom A diskip
        outageParsed.customer || "",
        outageParsed.idAtm || "",
        outageParsed.lokasi || "",
        outageParsed.area || "",
        outageParsed.downtimeDate || "",
        outageParsed.downtimeTime || "",
        outageParsed.uptimeDate || "",
        outageParsed.uptimeTime || "",
        outageParsed.duration || "",
        outageParsed.confirmBy || "",
        outageParsed.remarks || ""
      ];

      // Update data di row yang sama (bukan delete + add baru)
      const updateResult = await updateOutageSheetRow(originalData.sheetRow, values, getAccessToken, SHEET_ID, getOutageSheetName);
      
      if (updateResult) {
        console.log(`✅ [EDIT] Row ${originalData.sheetRow} updated successfully`);
        
        // Update tracker dengan data baru tapi tetap di row yang sama
        messageTracker.set(primaryId, {
          ...originalData,
          data: values,
          timestamp: Date.now(),
          customer: outageParsed.customer,
          idAtm: outageParsed.idAtm
        });
        
        // Jika ada alias, update tracker untuk originalMessageId juga
        if (originalMessageId !== primaryId) {
          messageAliases.set(originalMessageId, primaryId);
        }
        
        console.log(`📌 [EDIT] Tracker updated for ID ${primaryId} (row ${originalData.sheetRow} unchanged)`);
        console.log(`✅ [EDIT] Data updated: ${outageParsed.customer} - ${outageParsed.idAtm}`);
      } else {
        console.error("❌ [EDIT] Failed to update sheet row");
        return false;
      }
      
      // Jika ada multiple entries, handle sebagai error atau tambahan
      if (outageParsedArray.length > 1) {
        console.log("⚠️ [EDIT] Multiple entries in edit - only first entry updated in existing row");
        console.log("📋 [EDIT] Additional entries ignored for edit operation");
      }
      
      return true;
    } catch (error) {
      console.error("❌ [EDIT] Error processing edit:", error);
      return false;
    }
  } else {
    console.log("⚠️ [EDIT] No valid outage data found in edited message");
    // Jika tidak ada data valid, hapus saja data lama
    await deleteFromOutageSheet(originalData.sheetRow, getAccessToken, SHEET_ID, getOutageSheetName);
    removeMessageFromTracker(primaryId);
    return true;
  }
}

async function handleMessageDelete(messageId, getAccessToken, SHEET_ID, getOutageSheetName) {
  console.log("🗑️ [DELETE] Handling message delete for ID:", messageId);
  console.log("🔍 [DELETE] Current tracker size:", messageTracker.size);
  
  // Debug: tampilkan semua message yang sedang ditrack
  for (const [id, data] of messageTracker.entries()) {
    console.log(`📌 [TRACKER] ID: ${id}, Row: ${data.sheetRow}, Customer: ${data.customer}`);
  }
  
  // Cek apakah pesan ada di tracker (gunakan helper function)
  const foundMessage = findMessageData(messageId);
  
  if (!foundMessage) {
    console.log("⚠️ [DELETE] Message not found in tracker");
    console.log("📋 [DELETE] Available message IDs:", Array.from(messageTracker.keys()));
    console.log("📋 [DELETE] Available aliases:", Array.from(messageAliases.keys()));
    return false;
  }
  
  const messageData = foundMessage.data;
  const primaryId = foundMessage.id;
  console.log("📝 [DELETE] Found message data:", messageData);
  console.log("🔍 [DELETE] Primary ID:", primaryId);
  
  try {
    // Hapus dari sheet
    console.log(`🗑️ [DELETE] Deleting from sheet row ${messageData.sheetRow}`);
    await deleteFromOutageSheet(messageData.sheetRow, getAccessToken, SHEET_ID, getOutageSheetName);
    
    // Hapus dari tracker menggunakan helper function
    const removed = removeMessageFromTracker(primaryId);
    console.log(`📌 [DELETE] Removed from tracker: ${primaryId} (${removed})`);
    
    console.log("✅ [DELETE] Message and sheet data deleted successfully");
    return true;
  } catch (error) {
    console.error("❌ [DELETE] Error processing delete:", error);
    return false;
  }
}

async function updateOutageSheetRow(rowNumber, values, getAccessToken, SHEET_ID, getOutageSheetName) {
  try {
    const accessToken = await getAccessToken();
    const sheetName = getOutageSheetName();
    
    console.log(`✏️ [SHEET-UPDATE] Updating row ${rowNumber} in ${sheetName}`);
    
    // Update the specific row (kolom B sampai L) dengan data baru
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(sheetName)}!B${rowNumber}:L${rowNumber}?valueInputOption=USER_ENTERED`;
    
    const valuesWithoutNo = values.slice(1); // skip kolom A (nomor)
    const body = { values: [valuesWithoutNo] };
    
    const response = await fetch(updateUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ [SHEET-UPDATE] Failed to update row:", errorText);
      return false;
    } else {
      const responseData = await response.json();
      console.log("✅ [SHEET-UPDATE] Row updated successfully:", responseData.updatedRange || responseData);
      return true;
    }
  } catch (error) {
    console.error("❌ [SHEET-UPDATE] Error:", error);
    return false;
  }
}

async function deleteFromOutageSheet(rowNumber, getAccessToken, SHEET_ID, getOutageSheetName) {
  try {
    const accessToken = await getAccessToken();
    const sheetName = getOutageSheetName();
    
    console.log(`🗑️ [SHEET-DELETE] Deleting row ${rowNumber} from ${sheetName}`);
    
    // Clear the specific row (kolom B sampai L) - gunakan endpoint clear yang benar
    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(sheetName)}!B${rowNumber}:L${rowNumber}:clear`;
    
    const response = await fetch(clearUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({}) // Empty body untuk clear
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ [SHEET-DELETE] Failed to delete row:", errorText);
      
      // Fallback: gunakan update dengan empty values
      const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(sheetName)}!B${rowNumber}:L${rowNumber}?valueInputOption=USER_ENTERED`;
      const emptyValues = [["", "", "", "", "", "", "", "", "", "", ""]]; // 11 kolom kosong
      
      const fallbackResponse = await fetch(updateUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ values: emptyValues })
      });
      
      if (fallbackResponse.ok) {
        console.log(`✅ [SHEET-DELETE] Row ${rowNumber} cleared successfully (fallback method)`);
      } else {
        const fallbackError = await fallbackResponse.text();
        console.error("❌ [SHEET-DELETE] Fallback also failed:", fallbackError);
      }
    } else {
      console.log(`✅ [SHEET-DELETE] Row ${rowNumber} cleared successfully`);
    }
  } catch (error) {
    console.error("❌ [SHEET-DELETE] Error:", error);
  }
}

// ================= Process Multiple Outage Entries =================
async function processOutageEntries(text, messageInfo, getAccessToken, SHEET_ID, formatWaTimestamp, getOutageSheetName, messageId = null) {
  console.log("⚡ Processing as OUTAGE data...");
  const outageParsedArray = parseMultipleOutageData(text);
  
  if (outageParsedArray.length > 0) {
    console.log(`✅ Found ${outageParsedArray.length} OUTAGE entries`);
    
    // Process beberapa entry masuk
    for (let i = 0; i < outageParsedArray.length; i++) {
      const outageParsed = outageParsedArray[i];
      const values = [
        "", // kolom A diskip
        outageParsed.customer || "",
        outageParsed.idAtm || "",
        outageParsed.lokasi || "",
        outageParsed.area || "",
        outageParsed.downtimeDate || "",
        outageParsed.downtimeTime || "",
        outageParsed.uptimeDate || "",
        outageParsed.uptimeTime || "",
        outageParsed.duration || "",
        outageParsed.confirmBy || "",
        outageParsed.remarks || ""
      ];
      
      console.log(`📊 [SHEET-PREP] Values to be sent to sheet:`);
      values.forEach((val, idx) => {
        const colNames = ['No', 'Customer', 'ID ATM', 'Lokasi', 'Area', 'Downtime Date', 'Downtime Time', 'Uptime Date', 'Uptime Time', 'Duration', 'Confirm By', 'Remarks'];
        console.log(`   ${colNames[idx]}: "${val}"`);
      });

      const sheetRow = await appendToOutageSheet(values, getAccessToken, SHEET_ID, getOutageSheetName);
      
      // Simpan ke message tracker untuk edit/delete detection
      const trackingId = messageId || messageInfo.messageId;
      if (trackingId) {
        addMessageToTracker(trackingId, sheetRow, values, outageParsed.customer, outageParsed.idAtm);
      }
      
      const tsSeconds = messageInfo.messageTimestamp ? Number(messageInfo.messageTimestamp) : null;
      const timestamp = tsSeconds ? formatWaTimestamp(tsSeconds) : "";
      
      console.log(`✅ [OUTAGE ${i + 1}/${outageParsedArray.length}] Data tersimpan:`, { 
        from: messageInfo.remoteJid, 
        customer: outageParsed.customer,
        idAtm: outageParsed.idAtm,
        messageId: trackingId,
        sheetRow: sheetRow,
        timestamp 
      });
    }
    return true;
  }
  return false;
}

// ================= Utility Functions =================
function getMessageTrackerInfo() {
  return {
    totalTracked: messageTracker.size,
    totalAliases: messageAliases.size,
    messages: Array.from(messageTracker.entries()).map(([id, data]) => ({
      messageId: id,
      sheetRow: data.sheetRow,
      customer: data.customer,
      idAtm: data.idAtm,
      timestamp: new Date(data.timestamp).toISOString()
    })),
    aliases: Array.from(messageAliases.entries()).map(([alias, primary]) => ({
      alias: alias,
      primary: primary
    }))
  };
}

function cleanupOldTrackedMessages(maxAgeHours = 24) {
  const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds
  const now = Date.now();
  let cleaned = 0;
  
  for (const [messageId, data] of messageTracker.entries()) {
    if (now - data.timestamp > maxAge) {
      messageTracker.delete(messageId);
      cleaned++;
    }
  }
  
  console.log(`🧹 [CLEANUP] Removed ${cleaned} old tracked messages (older than ${maxAgeHours}h)`);
  return cleaned;
}

export {
  parseMultipleOutageData,
  parseOutageData,
  detectCustomer,
  processOutageEntries,
  handleMessageEdit,
  handleMessageDelete,
  getMessageTrackerInfo,
  cleanupOldTrackedMessages,
  findMessageData,
  addMessageToTracker,
  removeMessageFromTracker
};