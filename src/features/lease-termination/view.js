import { calculateLeaseTermination } from '../../services/lease-termination.service.js';
import { loadLeaseTerminationOptions } from '../../services/lease-data.service.js';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

function value(form, name) {
  return form.elements[name]?.value ?? '';
}

function numericValue(form, name) {
  const raw = value(form, name).replace?.(',', '.') ?? value(form, name);
  return raw === '' ? 0 : Number(raw);
}

function todayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function collectInput(form) {
  return {
    property: value(form, 'property'),
    landlord: value(form, 'landlord'),
    tenant: value(form, 'tenant'),
    contractStart: value(form, 'contractStart'),
    contractEnd: value(form, 'contractEnd'),
    terminationDate: value(form, 'terminationDate'),
    monthlyRent: numericValue(form, 'monthlyRent'),
    applyTerminationFee: value(form, 'applyTerminationFee') === 'yes',
    rentPeriodStart: value(form, 'rentPeriodStart'),
    annualIptu: numericValue(form, 'annualIptu'),
    iptuPaid: numericValue(form, 'iptuPaid'),
    iptuPaidBy: value(form, 'iptuPaidBy'),
    condoTotal: numericValue(form, 'condoTotal'),
    condoExtraFee: numericValue(form, 'condoExtraFee'),
    condoReserveFund: numericValue(form, 'condoReserveFund'),
    condoPunctualityDiscount: numericValue(form, 'condoPunctualityDiscount'),
    gas: numericValue(form, 'gas'),
    water: numericValue(form, 'water'),
    laundry: numericValue(form, 'laundry'),
    otherIndividualExpenses: numericValue(form, 'otherIndividualExpenses'),
    condoPaid: numericValue(form, 'condoPaid'),
    condoPaidBy: value(form, 'condoPaidBy'),
    inspectionCount: numericValue(form, 'inspectionCount'),
    inspectionUnitPrice: numericValue(form, 'inspectionUnitPrice'),
    otherCharges: numericValue(form, 'otherCharges'),
    reimbursements: numericValue(form, 'reimbursements')
  };
}

function resultLabel(result) {
  if (result === 'TENANT_PAYS') return 'INQUILINO DEVE PAGAR';
  if (result === 'TENANT_RECEIVES') return 'RESSARCIR O INQUILINO';
  return 'SEM SALDO A AJUSTAR';
}

function setText(root, selector, text) {
  const node = root.querySelector(selector);
  if (node) node.textContent = text;
}

function renderResult(root, calculation) {
  setText(root, '[data-result="rent"]', money.format(calculation.rent.proportional));
  setText(root, '[data-result="iptu"]', money.format(calculation.iptu.balance));
  setText(root, '[data-result="condo"]', money.format(calculation.condo.balance));
  setText(root, '[data-result="fee"]', money.format(calculation.terminationFee.proportional));
  setText(root, '[data-result="inspections"]', money.format(calculation.inspections.value));
  setText(root, '[data-result="charges"]', money.format(calculation.adjustments.otherCharges));
  setText(root, '[data-result="reimbursements"]', money.format(-calculation.adjustments.reimbursements));
  setText(root, '[data-result="final"]', money.format(calculation.finalBalance));
  setText(root, '[data-result="label"]', resultLabel(calculation.result));

  setText(root, '[data-memory="rent"]', `${calculation.rent.days} dia(s) × ${money.format(calculation.rent.dailyValue)}`);
  setText(root, '[data-memory="fee"]', calculation.terminationFee.applied
    ? `${number.format(calculation.terminationFee.remainingContractDays)} dias restantes de ${number.format(calculation.terminationFee.totalContractDays)} dias do contrato`
    : 'Multa não aplicada');
  setText(root, '[data-memory="iptu"]', `${calculation.iptu.days} dia(s) no ano; responsabilidade ${money.format(calculation.iptu.proportional)}; pago pelo inquilino ${money.format(calculation.iptu.paidByTenant)}`);
  setText(root, '[data-memory="condo"]', `${calculation.condo.days} dia(s); base proporcional ${money.format(calculation.condo.proportionalBase)} + despesas individuais ${money.format(calculation.condo.individualExpenses)}; pago pelo inquilino ${money.format(calculation.condo.paidByTenant)}`);
  setText(root, '[data-memory="inspections"]', `${calculation.inspections.additional} vistoria(s) adicional(is) × ${money.format(calculation.inspections.unitPrice)}`);

  const summary = root.querySelector('.termination-summary');
  summary?.classList.toggle('is-credit', calculation.finalBalance < -0.005);
  summary?.classList.toggle('is-settled', Math.abs(calculation.finalBalance) <= 0.005);
}

function setField(form, name, nextValue) {
  const field = form.elements[name];
  if (field) field.value = nextValue ?? '';
}

function propertyDescription(lease) {
  const property = lease.property;
  if (!property) return lease.propertyRaw || lease.propertyReference || '';
  return [property.reference, property.type, property.address, property.neighborhood, property.city, property.state]
    .filter(Boolean).join(' · ');
}

function renderLinkedData(root, lease) {
  const card = root.querySelector('[data-linked-property]');
  if (!card) return;
  if (!lease) {
    card.hidden = true;
    return;
  }
  const property = lease.property;
  setText(card, '[data-linked="reference"]', property?.reference || lease.propertyReference || '—');
  setText(card, '[data-linked="address"]', property?.address || lease.propertyRaw || '—');
  setText(card, '[data-linked="contract"]', lease.contractNumber || '—');
  setText(card, '[data-linked="guarantee"]', lease.guarantee || '—');
  setText(card, '[data-linked="broker"]', property?.brokerName || lease.brokerName || '—');
  setText(card, '[data-linked="iptu"]', Number(property?.iptuValue || 0) > 0 ? money.format(Number(property.iptuValue)) : 'Não informado');
  setText(card, '[data-linked="condo"]', Number(property?.condominiumValue || 0) > 0 ? money.format(Number(property.condominiumValue)) : 'Não informado');
  card.hidden = false;
}

function applyLeaseToForm(root, form, lease) {
  if (!lease) {
    ['property', 'landlord', 'tenant', 'contractStart', 'contractEnd', 'monthlyRent', 'annualIptu', 'condoTotal'].forEach((name) => setField(form, name, ''));
    renderLinkedData(root, null);
    return;
  }
  setField(form, 'property', propertyDescription(lease));
  setField(form, 'landlord', lease.landlordName);
  setField(form, 'tenant', lease.tenantName);
  setField(form, 'contractStart', lease.startDate);
  setField(form, 'contractEnd', lease.endDate);
  setField(form, 'monthlyRent', Number(lease.rentValue || lease.property?.rentValue || 0) || '');
  // A coluna "Iptu" da planilha de contratos pode ser inscrição/código. O valor financeiro vem da base de imóveis.
  setField(form, 'annualIptu', Number(lease.property?.iptuValue || 0) || '');
  setField(form, 'condoTotal', Number(lease.property?.condominiumValue || 0) || '');
  if (!value(form, 'rentPeriodStart')) setField(form, 'rentPeriodStart', lease.startDate);
  renderLinkedData(root, lease);
}

export async function renderLeaseTermination(root) {
  root.innerHTML = `
    <section class="page-header termination-page-header">
      <div>
        <p class="eyebrow">Financeiro</p>
        <h1>Cálculo de rescisão</h1>
        <p>Selecione uma locação importada para carregar imóvel, proprietário, inquilino e dados contratuais diretamente da base.</p>
      </div>
      <a class="secondary compact termination-history-link" href="#/lease-terminations">Consultar rescisões</a>
    </section>

    <form id="termination-form" class="termination-layout" novalidate>
      <div class="termination-form-column">
        <section class="panel termination-section termination-lease-section">
          <div class="section-heading"><div><span class="section-step">1</span><h2>Locação vinculada</h2></div><span class="section-hint">Dados da base importada</span></div>
          <div class="form-grid two-columns">
            <label class="field full-span">Contrato / imóvel
              <select name="leaseId" required><option value="">Carregando locações...</option></select>
            </label>
            <label class="field full-span">Imóvel<input name="property" readonly></label>
            <label class="field">Locador<input name="landlord" readonly></label>
            <label class="field">Inquilino<input name="tenant" readonly></label>
            <label class="field">Início do contrato<input name="contractStart" type="date" required readonly aria-readonly="true"></label>
            <label class="field">Término previsto<input name="contractEnd" type="date" required readonly aria-readonly="true"></label>
            <label class="field">Data da rescisão / desocupação<input name="terminationDate" type="date" value="${todayIso()}" required></label>
            <label class="field">Aluguel atual<input name="monthlyRent" type="number" min="0" step="0.01" inputmode="decimal" required></label>
            <label class="field">Aplicar multa rescisória?
              <select name="applyTerminationFee"><option value="yes" selected>Sim</option><option value="no">Não</option></select>
            </label>
          </div>
          <div class="linked-property-card" data-linked-property hidden>
            <div><span>Referência</span><strong data-linked="reference">—</strong></div>
            <div><span>Contrato</span><strong data-linked="contract">—</strong></div>
            <div class="linked-property-address"><span>Endereço cadastrado</span><strong data-linked="address">—</strong></div>
            <div><span>Garantia</span><strong data-linked="guarantee">—</strong></div>
            <div><span>Corretor</span><strong data-linked="broker">—</strong></div>
            <div><span>IPTU cadastrado</span><strong data-linked="iptu">—</strong></div>
            <div><span>Condomínio cadastrado</span><strong data-linked="condo">—</strong></div>
          </div>
        </section>

        <section class="panel termination-section">
          <div class="section-heading"><div><span class="section-step">2</span><h2>Aluguel proporcional</h2></div><span class="section-hint">Mês comercial de 30 dias</span></div>
          <div class="form-grid two-columns">
            <label class="field">Início do período a cobrar<input name="rentPeriodStart" type="date" required></label>
            <div class="calculation-note"><strong>Regra</strong><span>Aluguel mensal ÷ 30 × dias cobrados, contando início e fim, limitado a 30 dias.</span></div>
          </div>
        </section>

        <section class="panel termination-section">
          <div class="section-heading"><div><span class="section-step">3</span><h2>IPTU</h2></div><span class="section-hint">Valor cadastrado no imóvel é preenchido automaticamente</span></div>
          <div class="form-grid three-columns">
            <label class="field">Valor anual do IPTU<input name="annualIptu" type="number" min="0" step="0.01" inputmode="decimal"></label>
            <label class="field">Valor efetivamente pago<input name="iptuPaid" type="number" min="0" step="0.01" inputmode="decimal"></label>
            <label class="field">Quem pagou?
              <select name="iptuPaidBy"><option value="tenant">Inquilino</option><option value="landlord">Proprietário</option><option value="agency">Imobiliária</option></select>
            </label>
          </div>
        </section>

        <section class="panel termination-section">
          <div class="section-heading"><div><span class="section-step">4</span><h2>Condomínio</h2></div><span class="section-hint">Base mensal importada; despesas individuais são integrais</span></div>
          <div class="form-grid three-columns">
            <label class="field">Valor total do boleto<input name="condoTotal" type="number" min="0" step="0.01"></label>
            <label class="field">Taxa extra<input name="condoExtraFee" type="number" min="0" step="0.01"></label>
            <label class="field">Fundo de reserva<input name="condoReserveFund" type="number" min="0" step="0.01"></label>
            <label class="field">Desconto de pontualidade<input name="condoPunctualityDiscount" type="number" min="0" step="0.01"></label>
            <label class="field">Gás individual<input name="gas" type="number" min="0" step="0.01"></label>
            <label class="field">Água individual<input name="water" type="number" min="0" step="0.01"></label>
            <label class="field">Lavanderia<input name="laundry" type="number" min="0" step="0.01"></label>
            <label class="field">Outras despesas individuais<input name="otherIndividualExpenses" type="number" min="0" step="0.01"></label>
            <label class="field">Valor efetivamente pago<input name="condoPaid" type="number" min="0" step="0.01"></label>
            <label class="field">Quem pagou o boleto?
              <select name="condoPaidBy"><option value="tenant">Inquilino</option><option value="landlord">Proprietário</option><option value="agency">Imobiliária</option></select>
            </label>
          </div>
        </section>

        <section class="panel termination-section">
          <div class="section-heading"><div><span class="section-step">5</span><h2>Vistorias e ajustes</h2></div></div>
          <div class="form-grid two-columns">
            <label class="field">Total de vistorias realizadas<input name="inspectionCount" type="number" min="0" step="1" value="1"></label>
            <label class="field">Valor por vistoria adicional<input name="inspectionUnitPrice" type="number" min="0" step="0.01"></label>
            <label class="field">Outras cobranças ao inquilino<input name="otherCharges" type="number" min="0" step="0.01"></label>
            <label class="field">Outros ressarcimentos ao inquilino<input name="reimbursements" type="number" min="0" step="0.01"></label>
            <label class="field full-span">Observações gerais<textarea name="notes" rows="3" placeholder="Informações relevantes para conferência da rescisão"></textarea></label>
          </div>
        </section>

        <p class="error-text" id="termination-error" role="alert" aria-live="polite"></p>
      </div>

      <aside class="termination-summary panel" aria-live="polite">
        <div class="summary-heading"><p class="eyebrow">Resumo da rescisão</p><span class="summary-status">Prévia</span></div>
        <div class="summary-list">
          <div><span>Aluguel proporcional</span><strong data-result="rent">R$ 0,00</strong></div>
          <small data-memory="rent">Preencha os dados para calcular.</small>
          <div><span>Proporcional de IPTU</span><strong data-result="iptu">R$ 0,00</strong></div>
          <small data-memory="iptu"></small>
          <div><span>Proporcional de condomínio</span><strong data-result="condo">R$ 0,00</strong></div>
          <small data-memory="condo"></small>
          <div><span>Multa proporcional</span><strong data-result="fee">R$ 0,00</strong></div>
          <small data-memory="fee"></small>
          <div><span>Vistorias adicionais</span><strong data-result="inspections">R$ 0,00</strong></div>
          <small data-memory="inspections"></small>
          <div><span>Outras cobranças</span><strong data-result="charges">R$ 0,00</strong></div>
          <div><span>Ressarcimentos</span><strong data-result="reimbursements">R$ 0,00</strong></div>
        </div>
        <div class="summary-total"><span>Saldo final</span><strong data-result="final">R$ 0,00</strong><b data-result="label">AGUARDANDO CÁLCULO</b></div>
        <p class="summary-rule">Positivo: cobrar do inquilino. Negativo: ressarcir o inquilino.</p>
        <div class="summary-warning">Ferramenta administrativa. Confira contrato, comprovantes, boleto de condomínio e IPTU antes de concluir a rescisão.</div>
        <div class="termination-actions termination-summary-actions">
          <button class="primary" type="submit">Calcular rescisão</button>
          <button class="secondary compact" type="reset">Limpar</button>
        </div>
      </aside>
    </form>
  `;

  const form = root.querySelector('#termination-form');
  const error = root.querySelector('#termination-error');
  const leaseSelect = form.elements.leaseId;
  let leases = [];

  try {
    leases = await loadLeaseTerminationOptions();
    leaseSelect.innerHTML = `<option value="">Selecione o contrato ou imóvel</option>${leases.map((lease) => {
      const closed = lease.closedAt ? ' · baixado' : '';
      return `<option value="${lease.id}">${lease.contractNumber || 'Sem nº'} · ${lease.propertyLabel}${closed}</option>`;
    }).join('')}`;
    if (!leases.length) {
      leaseSelect.innerHTML = '<option value="">Nenhuma locação importada</option>';
      error.textContent = 'Importe novamente a planilha de clientes/contratos para criar os vínculos de locação.';
    }
  } catch (cause) {
    leaseSelect.innerHTML = '<option value="">Não foi possível carregar as locações</option>';
    error.textContent = cause.message || 'Não foi possível acessar a base de contratos.';
  }

  leaseSelect.addEventListener('change', () => {
    const selected = leases.find((lease) => lease.id === leaseSelect.value);
    applyLeaseToForm(root, form, selected);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    error.textContent = '';
    if (!leaseSelect.value) {
      error.textContent = 'Selecione uma locação da base antes de calcular a rescisão.';
      return;
    }
    try {
      renderResult(root, calculateLeaseTermination(collectInput(form)));
    } catch (cause) {
      error.textContent = cause.message || 'Não foi possível calcular a rescisão.';
    }
  });

  form.addEventListener('reset', () => {
    queueMicrotask(() => {
      applyLeaseToForm(root, form, null);
      setField(form, 'terminationDate', todayIso());
      setField(form, 'applyTerminationFee', 'yes');
      root.querySelector('.termination-summary')?.classList.remove('is-credit', 'is-settled');
      root.querySelectorAll('[data-result]').forEach((node) => {
        node.textContent = node.dataset.result === 'label' ? 'AGUARDANDO CÁLCULO' : 'R$ 0,00';
      });
      root.querySelectorAll('[data-memory]').forEach((node) => { node.textContent = ''; });
      error.textContent = '';
    });
  });
}