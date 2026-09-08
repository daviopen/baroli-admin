import { getFirebaseServices } from './firebase.service.js';

const XLSX_CDN = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
const BATCH_SIZE = 350;
let xlsxPromise;

function clean(value) {
  return String(value ?? '').trim();
}

function numberValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const normalized = clean(value).replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function digits(value) {
  return clean(value).replace(/\D/g, '');
}

function slug(value) {
  return clean(value)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function fallbackHash(value) {
  let hash = 2166136261;
  for (const char of clean(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function loadXlsx() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (!xlsxPromise) {
    xlsxPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = XLSX_CDN;
      script.async = true;
      script.onload = () => window.XLSX ? resolve(window.XLSX) : reject(new Error('Biblioteca de planilhas indisponível.'));
      script.onerror = () => reject(new Error('Não foi possível carregar o leitor de planilhas. Verifique sua conexão.'));
      document.head.appendChild(script);
    });
  }
  return xlsxPromise;
}

async function rowsFromFile(file) {
  const XLSX = await loadXlsx();
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('A planilha não possui abas legíveis.');
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', raw: false });
  if (!rows.length) throw new Error('A planilha está vazia.');
  return { rows, sheetName };
}

function first(row, names) {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(row, name) && clean(row[name])) return row[name];
  }
  return '';
}

function parseParty(raw, type, contractNumber) {
  const source = clean(raw);
  if (!source) return null;
  const emailMatch = source.match(/E-?Mail:\s*([^\s,;]+)/i);
  const phoneMatch = source.match(/Fone:\s*([^E]+?)(?=\s+E-?Mail:|$)/i);
  const documentMatch = source.match(/(?:^|\s-\s)(\d{2,3}\.\d{3}\.\d{3}[\/-]\d{2,4}|\d{11,14})(?=\s|$)/);
  const markerIndex = source.search(/\s-\s(?:\d{2,3}[.]|\d{11,14}|Fone:)/i);
  const name = clean(markerIndex > 0 ? source.slice(0, markerIndex) : source.split(/\s+Fone:/i)[0]);
  const document = documentMatch ? digits(documentMatch[1]) : '';
  const email = clean(emailMatch?.[1]).toLowerCase();
  const phone = digits(phoneMatch?.[1]);
  const identity = document ? `doc-${document}` : email ? `email-${slug(email)}` : `party-${fallbackHash(`${name}|${phone}`)}`;
  return {
    id: identity,
    name,
    document,
    email,
    phone,
    types: [type],
    contractNumbers: contractNumber ? [clean(contractNumber)] : [],
    sourceText: source
  };
}

function splitSimpleParties(raw, type, contractNumber) {
  const source = clean(raw);
  if (!source) return [];
  return source.split(/\s+-\s+(?=[A-Za-zÀ-ÿ])/).map((part) => parseParty(part, type, contractNumber)).filter(Boolean);
}

function mergeClient(map, client) {
  const existing = map.get(client.id);
  if (!existing) {
    map.set(client.id, client);
    return;
  }
  existing.types = [...new Set([...existing.types, ...client.types])];
  existing.contractNumbers = [...new Set([...existing.contractNumbers, ...client.contractNumbers])];
  if (!existing.document && client.document) existing.document = client.document;
  if (!existing.email && client.email) existing.email = client.email;
  if (!existing.phone && client.phone) existing.phone = client.phone;
}

export async function parseClientsSpreadsheet(file) {
  const { rows, sheetName } = await rowsFromFile(file);
  const clients = new Map();

  for (const row of rows) {
    const contractNumber = first(row, ['Nº contrato', 'N° contrato', 'Contrato']);
    const parties = [
      parseParty(first(row, ['Proprietarios', 'Proprietários']), 'PROPRIETARIO', contractNumber),
      parseParty(first(row, ['Inquilinos', 'Inquilino']), 'INQUILINO', contractNumber),
      ...splitSimpleParties(first(row, ['Fiadores', 'Fiador']), 'FIADOR', contractNumber),
      ...splitSimpleParties(first(row, ['Beneficiários', 'Beneficiarios']), 'BENEFICIARIO', contractNumber)
    ].filter(Boolean);
    parties.forEach((party) => mergeClient(clients, party));
  }

  const records = [...clients.values()].filter((client) => client.name);
  if (!records.length) throw new Error('Não encontrei clientes nas colunas Proprietários/Inquilinos/Fiadores/Beneficiários.');
  return { type: 'clients', fileName: file.name, sheetName, sourceRows: rows.length, records };
}

export async function parsePropertiesSpreadsheet(file) {
  const { rows, sheetName } = await rowsFromFile(file);
  const seen = new Set();
  let duplicatesInFile = 0;
  const records = [];

  for (const row of rows) {
    const reference = clean(first(row, ['Referência', 'Referencia']));
    const address = clean(first(row, ['Endereço', 'Endereco']));
    if (!reference && !address) continue;
    const id = reference ? `ref-${slug(reference)}` : `addr-${fallbackHash(address)}`;
    if (seen.has(id)) { duplicatesInFile += 1; continue; }
    seen.add(id);
    records.push({
      id,
      reference,
      type: clean(first(row, ['Tipo'])),
      address,
      neighborhood: clean(first(row, ['Bairro'])),
      commercialNeighborhood: clean(first(row, ['Bairro Comercial'])),
      city: clean(first(row, ['Cidade'])),
      state: clean(first(row, ['Estado'])),
      saleValue: numberValue(first(row, ['Valor venda'])),
      saleFee: numberValue(first(row, ['Taxa venda'])),
      rentValue: numberValue(first(row, ['Valor locação', 'Valor locacao'])),
      monthlyAdminFee: numberValue(first(row, ['Taxa adm mensal'])),
      createdAtSource: clean(first(row, ['Criado em'])),
      capturedAtSource: clean(first(row, ['Data captação', 'Data captacao'])),
      iptuValue: numberValue(first(row, ['Valor iptu', 'Valor IPTU'])),
      condominiumValue: numberValue(first(row, ['Valor condomínio', 'Valor condominio'])),
      registration: clean(first(row, ['Matricula', 'Matrícula'])),
      parkingSpaces: numberValue(first(row, ['Garagens'])),
      suites: numberValue(first(row, ['Suítes', 'Suites'])),
      bedrooms: numberValue(first(row, ['Quartos'])),
      bathrooms: numberValue(first(row, ['Banheiros'])),
      rooms: numberValue(first(row, ['Salas'])),
      usableArea: numberValue(first(row, ['Área util', 'Area util'])),
      totalArea: numberValue(first(row, ['Área total', 'Area total'])),
      landArea: numberValue(first(row, ['Área tereno Total', 'Área terreno Total', 'Area terreno Total'])),
      brokerName: clean(first(row, ['Nome corretor'])).replace(/^(Corretor|Captador):\s*/i, ''),
      link: clean(first(row, ['Link'])),
      features: clean(first(row, ['Características', 'Caracteristicas']))
        .split(',').map((item) => item.trim()).filter(Boolean)
    });
  }

  if (!records.length) throw new Error('Não encontrei imóveis com Referência ou Endereço.');
  return { type: 'properties', fileName: file.name, sheetName, sourceRows: rows.length, duplicatesInFile, records };
}

export async function importParsedRecords(parsed) {
  const { db, firestoreSdk, auth } = await getFirebaseServices();
  const user = auth.currentUser;
  if (!user) throw new Error('Sessão expirada. Entre novamente.');
  const collectionName = parsed.type === 'clients' ? 'clients' : 'properties';
  const { collection, doc, writeBatch, serverTimestamp } = firestoreSdk;
  let written = 0;

  for (let offset = 0; offset < parsed.records.length; offset += BATCH_SIZE) {
    const batch = writeBatch(db);
    const slice = parsed.records.slice(offset, offset + BATCH_SIZE);
    for (const record of slice) {
      const ref = doc(collection(db, collectionName), record.id);
      const { id, ...payload } = record;
      batch.set(ref, {
        ...payload,
        sourceFile: parsed.fileName,
        sourceSheet: parsed.sheetName,
        importedAt: serverTimestamp(),
        importedBy: user.uid,
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
    await batch.commit();
    written += slice.length;
  }

  return { written, collectionName };
}
