import { importParsedRecords, parseClientsSpreadsheet, parsePropertiesSpreadsheet } from '../../services/data-import.service.js';

const PAGE_CONFIG = Object.freeze({
  clients: {
    tabLabel: 'Clientes',
    title: 'Base de clientes',
    eyebrow: 'Cadastros',
    description: 'Importe a planilha de contratos para consolidar proprietários, inquilinos, fiadores e beneficiários em uma única base de clientes.',
    acceptLabel: 'Planilha de contratos',
    collectionLabel: 'clientes',
    parser: parseClientsSpreadsheet,
    columns: [
      ['name', 'Nome'], ['types', 'Perfis'], ['document', 'CPF/CNPJ'], ['phone', 'Telefone'], ['email', 'E-mail'], ['contractNumbers', 'Contratos']
    ]
  },
  properties: {
    tabLabel: 'Imóveis',
    title: 'Base de imóveis',
    eyebrow: 'Cadastros',
    description: 'Importe a planilha de imóveis para atualizar referências, endereços, valores, áreas, características e dados comerciais.',
    acceptLabel: 'Planilha de imóveis',
    collectionLabel: 'imóveis',
    parser: parsePropertiesSpreadsheet,
    columns: [
      ['reference', 'Referência'], ['type', 'Tipo'], ['address', 'Endereço'], ['neighborhood', 'Bairro'], ['rentValue', 'Locação'], ['brokerName', 'Corretor']
    ]
  }
});

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '\"': '&quot;' }[char]));
}

function formatCell(key, value) {
  if (Array.isArray(value)) return value.join(', ') || '—';
  if (key === 'rentValue') return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return value === '' || value == null ? '—' : String(value);
}

function previewRows(config, records) {
  return records.slice(0, 10).map((record) => `
    <tr>${config.columns.map(([key]) => `<td>${escapeHtml(formatCell(key, record[key]))}</td>`).join('')}</tr>
  `).join('');
}

function renderImportSummary(parsed) {
  const duplicateInfo = parsed.duplicatesInFile
    ? `<div><strong>${parsed.duplicatesInFile}</strong><span>duplicados ignorados na planilha</span></div>`
    : '';
  return `
    <div><strong>${parsed.sourceRows}</strong><span>linhas lidas</span></div>
    <div><strong>${parsed.records.length}</strong><span>registros preparados</span></div>
    ${duplicateInfo}
  `;
}

function template(type, { embedded = false } = {}) {
  const config = PAGE_CONFIG[type];
  return `
    <section class="data-page" data-import-type="${type}">
      ${embedded ? `
        <div class="upload-tab-intro">
          <h2>${config.title}</h2>
          <p class="muted-text">${config.description}</p>
        </div>
      ` : `
        <header class="page-heading data-heading">
          <div>
            <p class="eyebrow">${config.eyebrow}</p>
            <h1>${config.title}</h1>
            <p class="muted-text">${config.description}</p>
          </div>
        </header>
      `}

      <section class="panel import-panel">
        <div class="import-step-label">1. Selecione a fonte</div>
        <label class="upload-dropzone" for="${type}-spreadsheet">
          <span class="upload-icon" aria-hidden="true">⇧</span>
          <strong>${config.acceptLabel}</strong>
          <span>Arraste ou selecione um arquivo .xlsx, .xls ou .csv</span>
          <input id="${type}-spreadsheet" type="file" accept=".xlsx,.xls,.csv" hidden>
        </label>
        <div class="import-file" hidden>
          <div><strong class="import-file-name"></strong><span class="import-file-meta"></span></div>
          <button class="secondary import-change" type="button">Trocar arquivo</button>
        </div>
      </section>

      <section class="panel import-preview" hidden>
        <div class="import-preview-header">
          <div>
            <div class="import-step-label">2. Confira antes de salvar</div>
            <h2>Pré-visualização</h2>
            <p class="muted-text">Mostrando os primeiros 10 registros. A importação usa atualização por chave única para não duplicar dados.</p>
          </div>
          <div class="import-summary"></div>
        </div>
        <div class="table-scroll">
          <table class="data-preview-table">
            <thead><tr>${config.columns.map(([, label]) => `<th>${label}</th>`).join('')}</tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="import-actions">
          <p class="import-warning">Registros já existentes com a mesma chave serão atualizados; os demais serão criados.</p>
          <button class="primary import-save" type="button">Salvar ${config.collectionLabel} na base</button>
        </div>
      </section>

      <section class="panel import-result" hidden aria-live="polite"></section>
    </section>
  `;
}

async function bindImportPage(container, type) {
  const config = PAGE_CONFIG[type];
  const root = container.querySelector('[data-import-type]');
  const input = root.querySelector('input[type="file"]');
  const dropzone = root.querySelector('.upload-dropzone');
  const fileBox = root.querySelector('.import-file');
  const preview = root.querySelector('.import-preview');
  const result = root.querySelector('.import-result');
  const save = root.querySelector('.import-save');
  let parsed = null;

  async function processFile(file) {
    if (!file) return;
    result.hidden = true;
    preview.hidden = true;
    dropzone.classList.add('is-loading');
    dropzone.querySelector('span:last-of-type').textContent = 'Lendo e validando a planilha...';
    try {
      parsed = await config.parser(file);
      root.querySelector('.import-file-name').textContent = file.name;
      root.querySelector('.import-file-meta').textContent = `${parsed.sheetName} · ${parsed.sourceRows} linhas de origem`;
      fileBox.hidden = false;
      dropzone.hidden = true;
      root.querySelector('.import-summary').innerHTML = renderImportSummary(parsed);
      root.querySelector('tbody').innerHTML = previewRows(config, parsed.records);
      preview.hidden = false;
    } catch (error) {
      parsed = null;
      result.className = 'panel import-result is-error';
      result.innerHTML = `<strong>Não foi possível ler esta planilha.</strong><p>${escapeHtml(error.message)}</p>`;
      result.hidden = false;
    } finally {
      dropzone.classList.remove('is-loading');
      dropzone.querySelector('span:last-of-type').textContent = 'Arraste ou selecione um arquivo .xlsx, .xls ou .csv';
    }
  }

  input.addEventListener('change', () => processFile(input.files?.[0]));
  root.querySelector('.import-change').addEventListener('click', () => {
    input.value = '';
    parsed = null;
    fileBox.hidden = true;
    preview.hidden = true;
    result.hidden = true;
    dropzone.hidden = false;
    input.click();
  });

  ['dragenter', 'dragover'].forEach((eventName) => dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add('is-dragging');
  }));
  ['dragleave', 'drop'].forEach((eventName) => dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.remove('is-dragging');
  }));
  dropzone.addEventListener('drop', (event) => processFile(event.dataTransfer?.files?.[0]));

  save.addEventListener('click', async () => {
    if (!parsed || !parsed.records.length) return;
    save.disabled = true;
    const original = save.textContent;
    save.textContent = 'Salvando...';
    result.hidden = true;
    try {
      const imported = await importParsedRecords(parsed);
      result.className = 'panel import-result is-success';
      result.innerHTML = `<strong>Importação concluída.</strong><p>${imported.written} ${escapeHtml(config.collectionLabel)} foram criados ou atualizados com sucesso.</p>`;
      result.hidden = false;
      result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (error) {
      result.className = 'panel import-result is-error';
      result.innerHTML = `<strong>Não foi possível salvar a importação.</strong><p>${escapeHtml(error.message)}</p>`;
      result.hidden = false;
    } finally {
      save.disabled = false;
      save.textContent = original;
    }
  });
}

export async function renderUploads(container, { allowedTypes = ['clients', 'properties'], initialType = 'clients' } = {}) {
  const availableTypes = allowedTypes.filter((type) => PAGE_CONFIG[type]);
  if (!availableTypes.length) {
    container.innerHTML = '<section class="panel"><h1>Acesso não autorizado</h1><p>Você não possui permissão para importar clientes ou imóveis.</p></section>';
    return;
  }

  let activeType = availableTypes.includes(initialType) ? initialType : availableTypes[0];
  container.innerHTML = `
    <section class="uploads-page">
      <header class="page-heading data-heading">
        <div>
          <p class="eyebrow">Base de dados</p>
          <h1>Uploads</h1>
          <p class="muted-text">Importe e atualize as bases operacionais da Baroli a partir das planilhas oficiais.</p>
        </div>
      </header>
      <div class="upload-tabs" role="tablist" aria-label="Tipos de upload">
        ${availableTypes.map((type) => `<button type="button" class="upload-tab" role="tab" data-upload-tab="${type}">${PAGE_CONFIG[type].tabLabel}</button>`).join('')}
      </div>
      <div class="upload-tab-content"></div>
    </section>
  `;

  const content = container.querySelector('.upload-tab-content');
  const tabs = [...container.querySelectorAll('[data-upload-tab]')];

  async function activate(type) {
    if (!availableTypes.includes(type)) return;
    activeType = type;
    tabs.forEach((tab) => {
      const active = tab.dataset.uploadTab === activeType;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    content.innerHTML = template(activeType, { embedded: true });
    await bindImportPage(content, activeType);
  }

  tabs.forEach((tab) => tab.addEventListener('click', () => activate(tab.dataset.uploadTab)));
  await activate(activeType);
}

export async function renderClients(container) {
  container.innerHTML = template('clients');
  await bindImportPage(container, 'clients');
}

export async function renderProperties(container) {
  container.innerHTML = template('properties');
  await bindImportPage(container, 'properties');
}
