import { importParsedRecords, parseClientsSpreadsheet, parsePropertiesSpreadsheet } from '../../services/data-import.service.js';

const PAGE_CONFIG = Object.freeze({
  clients: {
    tabLabel: 'Clientes',
    title: 'Base de clientes',
    description: 'Importe a planilha de contratos para consolidar proprietários, inquilinos, fiadores e beneficiários em uma única base de clientes.',
    acceptLabel: 'Planilha de contratos',
    helper: 'Arquivo .xlsx, .xls ou .csv',
    collectionLabel: 'clientes',
    parser: parseClientsSpreadsheet,
    columns: [
      ['name', 'Nome'], ['types', 'Perfis'], ['document', 'CPF/CNPJ'], ['phone', 'Telefone'], ['email', 'E-mail'], ['contractNumbers', 'Contratos']
    ]
  },
  properties: {
    tabLabel: 'Imóveis',
    title: 'Base de imóveis',
    description: 'Importe a planilha de imóveis para atualizar referências, endereços, valores, áreas, características e dados comerciais.',
    acceptLabel: 'Planilha de imóveis',
    helper: 'Arquivo .xlsx, .xls ou .csv',
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
    ? `<div class="import-stat"><span class="import-stat-value">${parsed.duplicatesInFile}</span><span class="import-stat-label">Duplicados ignorados</span></div>`
    : '';
  return `
    <div class="import-stat"><span class="import-stat-value">${parsed.sourceRows}</span><span class="import-stat-label">Linhas lidas</span></div>
    <div class="import-stat"><span class="import-stat-value">${parsed.records.length}</span><span class="import-stat-label">Registros preparados</span></div>
    ${duplicateInfo}
  `;
}

function template(type, { embedded = false } = {}) {
  const config = PAGE_CONFIG[type];
  return `
    <section class="data-page" data-import-type="${type}">
      ${embedded ? `
        <div class="upload-section-heading">
          <div>
            <p class="upload-section-kicker">Importação de dados</p>
            <h2>${config.title}</h2>
            <p>${config.description}</p>
          </div>
        </div>
      ` : `
        <header class="page-header">
          <p class="eyebrow">Base de dados</p>
          <h1>${config.title}</h1>
          <p>${config.description}</p>
        </header>
      `}

      <section class="panel import-panel">
        <div class="import-panel-heading">
          <span class="import-step">01</span>
          <div>
            <h3>Selecione a planilha</h3>
            <p>Escolha o arquivo oficial que será validado antes de qualquer alteração na base.</p>
          </div>
        </div>

        <label class="upload-dropzone" for="${type}-spreadsheet">
          <span class="upload-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M5 20h14"/></svg>
          </span>
          <span class="upload-dropzone-copy">
            <strong>${config.acceptLabel}</strong>
            <span>Arraste o arquivo para cá ou clique para selecionar</span>
            <small>${config.helper}</small>
          </span>
          <span class="upload-select-action">Selecionar arquivo</span>
          <input id="${type}-spreadsheet" type="file" accept=".xlsx,.xls,.csv" hidden>
        </label>

        <div class="import-file" hidden>
          <span class="import-file-icon" aria-hidden="true">XLS</span>
          <div class="import-file-copy">
            <strong class="import-file-name"></strong>
            <span class="import-file-meta"></span>
          </div>
          <button class="secondary compact import-change" type="button">Trocar arquivo</button>
        </div>
      </section>

      <section class="panel import-preview" hidden>
        <div class="import-preview-header">
          <div class="import-panel-heading import-panel-heading--compact">
            <span class="import-step">02</span>
            <div>
              <h3>Confira antes de salvar</h3>
              <p>Mostramos os primeiros 10 registros. A gravação utiliza chave única para evitar duplicidades.</p>
            </div>
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
          <div class="import-safety-note">
            <strong>Atualização segura</strong>
            <span>Registros existentes serão atualizados; novos registros serão criados.</span>
          </div>
          <button class="primary import-save" type="button">Salvar ${config.collectionLabel}</button>
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
    const instruction = dropzone.querySelector('.upload-dropzone-copy > span');
    const originalInstruction = instruction.textContent;
    instruction.textContent = 'Lendo e validando a planilha...';
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
      instruction.textContent = originalInstruction;
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
      <header class="page-header uploads-header">
        <p class="eyebrow">Base de dados</p>
        <div class="uploads-title-row">
          <div>
            <h1>Uploads</h1>
            <p>Importe e mantenha atualizadas as bases operacionais da Baroli a partir das planilhas oficiais.</p>
          </div>
          <span class="uploads-status-badge">Importação assistida</span>
        </div>
      </header>

      <section class="uploads-workspace">
        <div class="upload-tabs" role="tablist" aria-label="Tipos de upload">
          ${availableTypes.map((type) => `<button type="button" class="upload-tab" role="tab" data-upload-tab="${type}"><span>${PAGE_CONFIG[type].tabLabel}</span></button>`).join('')}
        </div>
        <div class="upload-tab-content"></div>
      </section>
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
      tab.setAttribute('tabindex', active ? '0' : '-1');
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
