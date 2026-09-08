function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[char]));
}

function optionParts(option) {
  const text = option.textContent.trim();
  const chunks = text.split(' · ');
  const contract = chunks.shift() || 'Sem nº';
  const closed = chunks.at(-1) === 'baixado';
  if (closed) chunks.pop();
  return { contract, detail: chunks.join(' · ') || 'Dados da locação importada', closed, text };
}

function enhance(select) {
  if (!select || select.dataset.searchableLease === '1') return;
  select.dataset.searchableLease = '1';
  select.classList.add('lease-native-select');
  select.style.display = 'none';

  const picker = document.createElement('div');
  picker.className = 'lease-picker';
  picker.innerHTML = `
    <button type="button" class="lease-picker-trigger" data-lease-trigger aria-haspopup="listbox" aria-expanded="false">
      <span class="lease-picker-trigger-copy">
        <strong data-lease-title>Carregando locações...</strong>
        <small data-lease-subtitle>Aguarde enquanto consultamos a base</small>
      </span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>
    </button>
    <div class="lease-picker-popover" data-lease-popover hidden>
      <div class="lease-picker-search-wrap">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>
        <input type="search" data-lease-search placeholder="Buscar por contrato, referência ou endereço..." autocomplete="off">
      </div>
      <div class="lease-picker-results" data-lease-results role="listbox"></div>
      <div class="lease-picker-footer"><span>Digite para filtrar a base</span><span>Enter seleciona o primeiro resultado · Esc fecha</span></div>
    </div>`;

  select.insertAdjacentElement('afterend', picker);
  const trigger = picker.querySelector('[data-lease-trigger]');
  const title = picker.querySelector('[data-lease-title]');
  const subtitle = picker.querySelector('[data-lease-subtitle]');
  const popover = picker.querySelector('[data-lease-popover]');
  const search = picker.querySelector('[data-lease-search]');
  const results = picker.querySelector('[data-lease-results]');

  function selectableOptions() {
    return [...select.options].filter((option) => option.value);
  }

  function renderResults() {
    const query = normalize(search.value);
    const matches = selectableOptions()
      .filter((option) => !query || normalize(option.textContent).includes(query))
      .slice(0, query ? 60 : 24);

    if (!matches.length) {
      results.innerHTML = `<div class="lease-picker-empty"><strong>Nenhum contrato encontrado</strong><span>Tente buscar pelo número do contrato, referência ou parte do endereço.</span></div>`;
      return;
    }

    results.innerHTML = matches.map((option) => {
      const item = optionParts(option);
      return `<button type="button" class="lease-picker-option" role="option" data-value="${escapeHtml(option.value)}">
        <span class="lease-option-main">
          <span class="lease-option-title"><strong>${escapeHtml(item.contract)}</strong></span>
          <span class="lease-option-address">${escapeHtml(item.detail)}</span>
        </span>
        <span class="lease-option-status ${item.closed ? 'is-closed' : ''}">${item.closed ? 'Baixado' : 'Ativo'}</span>
      </button>`;
    }).join('');
  }

  function syncTrigger() {
    const options = selectableOptions();
    const current = select.selectedOptions?.[0];
    const hasValue = Boolean(select.value && current);
    trigger.classList.toggle('has-value', hasValue);
    trigger.disabled = select.disabled || options.length === 0;

    if (hasValue) {
      const item = optionParts(current);
      title.textContent = item.contract;
      subtitle.textContent = item.detail;
      return;
    }

    const placeholder = select.options[0]?.textContent?.trim() || 'Selecione o contrato ou imóvel';
    const loading = /carregando|não foi possível|nenhuma/i.test(placeholder);
    title.textContent = loading ? placeholder : 'Selecione o contrato ou imóvel';
    subtitle.textContent = options.length
      ? `${options.length} locações disponíveis · clique para pesquisar`
      : 'Aguardando base de locações';
  }

  function setOpen(open) {
    if (trigger.disabled) return;
    popover.hidden = !open;
    picker.classList.toggle('is-open', open);
    trigger.setAttribute('aria-expanded', String(open));
    if (open) {
      search.value = '';
      renderResults();
      queueMicrotask(() => search.focus());
    }
  }

  trigger.addEventListener('click', () => setOpen(popover.hidden));
  search.addEventListener('input', renderResults);
  search.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
    if (event.key === 'Enter') {
      const first = results.querySelector('[data-value]');
      if (first) {
        event.preventDefault();
        first.click();
      }
    }
  });
  results.addEventListener('click', (event) => {
    const option = event.target.closest('[data-value]');
    if (!option) return;
    select.value = option.dataset.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    syncTrigger();
    setOpen(false);
  });
  select.addEventListener('change', syncTrigger);
  document.addEventListener('click', (event) => {
    if (!popover.hidden && !picker.contains(event.target)) setOpen(false);
  });

  new MutationObserver(syncTrigger).observe(select, { childList: true, attributes: true, subtree: true });
  syncTrigger();
}

function scan() {
  document.querySelectorAll('select[name="leaseId"]:not([data-searchable-lease="1"])').forEach(enhance);
}

new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
scan();
