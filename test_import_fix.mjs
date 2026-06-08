import XLSX from 'xlsx';
import fs from 'fs';

// Simular o que useImportacaoPlanilha.ts faz
const filePath = '/mnt/user-uploads/modelo_importacao_preenchido_8_colaboradores.xlsx';
const wb = XLSX.read(fs.readFileSync(filePath), { type: 'buffer', cellDates: false });
const ws = wb.Sheets[wb.SheetNames[0]];

// Simulate lerArquivoHeaders (FIXED version)
function lerArquivoHeaders_FIXED(sheet) {
  const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '', blankrows: false });
  
  // CRITICAL: Do NOT filter headers — keep raw indices in sync
  const headers = jsonData[0].map(h => String(h || '').trim()); // NO .filter()
  const sampleRows = jsonData.slice(1, 4);
  
  return { headers, sampleRows };
}

// Simulate autoDetectMapping with guards
function normalize(text) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, "").trim();
}

function autoDetectMapping(fileHeaders) {
  const AUTO_DETECT = {
    cnpjEmpresa: ["cnpj", "cpf empresa", "documento empresa", "empresa"],
    nome: ["nome", "funcionario", "colaborador", "name"],
    cpf: ["cpf", "documento"],
    sexo: ["sexo", "genero", "gênero", "gender"],
  };
  
  const mapping = {};
  const usedHeaders = new Set();

  // Process cnpjEmpresa first
  for (const header of fileHeaders) {
    if (usedHeaders.has(header)) continue;
    const normalizedHeader = normalize(header);
    for (const kw of AUTO_DETECT.cnpjEmpresa) {
      if (normalizedHeader.includes(normalize(kw))) {
        mapping.cnpjEmpresa = header;
        usedHeaders.add(header);
        break;
      }
    }
    if (mapping.cnpjEmpresa) break;
  }

  // Process cpf with guard
  for (const header of fileHeaders) {
    if (usedHeaders.has(header)) continue;
    const normalizedHeader = normalize(header);
    
    // GUARD: if looking for 'cpf', skip headers containing 'empresa'
    if (normalizedHeader.includes("empresa")) continue;
    
    for (const kw of AUTO_DETECT.cpf) {
      if (normalizedHeader.includes(normalize(kw))) {
        mapping.cpf = header;
        usedHeaders.add(header);
        break;
      }
    }
    if (mapping.cpf) break;
  }

  for (const header of fileHeaders) {
    if (usedHeaders.has(header)) continue;
    const normalizedHeader = normalize(header);
    for (const kw of AUTO_DETECT.nome) {
      if (normalizedHeader.includes(normalize(kw))) {
        mapping.nome = header;
        usedHeaders.add(header);
        break;
      }
    }
    if (mapping.nome) break;
  }

  return mapping;
}

// Test it
const { headers, sampleRows } = lerArquivoHeaders_FIXED(ws);

console.log('\n=== HEADERS ===');
headers.forEach((h, i) => console.log(`[${i}] ${h}`));

console.log('\n=== FIRST 3 SAMPLE ROWS ===');
sampleRows.forEach((row, idx) => {
  console.log(`Row ${idx}:`, row.slice(0, 6));
});

const mapping = autoDetectMapping(headers);
console.log('\n=== MAPPING ===');
console.log(JSON.stringify(mapping, null, 2));

// Verify CPF column
if (mapping.cpf) {
  const cpfColIdx = headers.indexOf(mapping.cpf);
  console.log('\n=== CPF VERIFICATION ===');
  console.log(`CPF mapped to header: "${mapping.cpf}" (index ${cpfColIdx})`);
  console.log('CPF values in sample rows:');
  sampleRows.forEach((row, idx) => {
    console.log(`  Row ${idx}: ${row[cpfColIdx]}`);
  });
}

// Verify CNPJ/CPF Empresa column
if (mapping.cnpjEmpresa) {
  const empresaColIdx = headers.indexOf(mapping.cnpjEmpresa);
  console.log('\n=== CNPJ/CPF EMPRESA VERIFICATION ===');
  console.log(`CNPJ/CPF Empresa mapped to header: "${mapping.cnpjEmpresa}" (index ${empresaColIdx})`);
  console.log('CNPJ/CPF Empresa values in sample rows:');
  sampleRows.forEach((row, idx) => {
    console.log(`  Row ${idx}: ${row[empresaColIdx]}`);
  });
}
