import { calculateLeaseTermination } from '../../services/lease-termination.service.js';
import { loadLeaseTerminationOptions } from '../../services/lease-data.service.js';
import { getLeaseTermination, saveLeaseTermination } from '../../services/lease-termination-records.service.js';

function value(form, name) {
  return form.elements[name]?.value ?? '';
}

function numericValue(form, name) {
  const raw = String(value(form, name)).replace(',', '.');
  return raw === '' ? 0 : Number(raw);
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

function setField(form, name, nextValue) {
  const field = form.elements[name];
  if (!field || nextValue == null) return;
  if (name === 'applyTerminationFee') field.value = nextValue ? 'yes' : 'no';
  else field.value = nextValue;
}

function hydrateInput(form, input = {}) {
  Object.entries(input).forEach(([name, nextValue]) => setField(form, name, nextValue));
}

function ensureSaveUi(root) {
  const actions = root.querySelector('.termination-actions');
  if (!actions) return {};
  const statusWrap = document.createElement('label');
  statusWrap.className = 'field termination-save-status';
  statusWrap.innerHTML = `Status ao salvar<select name="recordStatus"><option value="CALCULADA">Calculada</option><option value="EM_CONFERENCIA">Em conferência</option><option value="PENDENTE">Pendente</option><option value="FINALIZADA">Finalizada</option><option value="CANCELADA">Cancelada</option></select>`;
  actions.before(statusWrap);

  const saveButton = document.createElement('button');
  saveButton.type = 'button';
  saveButton.className = 'primary termination-save-button';
  saveButton.textContent = 'Salvar cálculo';
  actions.prepend(saveButton);

  const feedback = document.createElement('p');
  feedback.className = 'termination-save-feedback';
  feedback.setAttribute('aria-live', 'polite');
  actions.after(feedback);
  return { saveButton, feedback, statusSelect: statusWrap.querySelector('select') };
}

export async function bindLeaseTerminationPersistence(root) {
  const form = root.querySelector('#termination-form');
  if (!form) return;
  const { saveButton, feedback, statusSelect } = ensureSaveUi(root);
  if (!saveButton) return;

  let editingId = sessionStorage.getItem('baroli:termination-edit-id') || '';
  let leases = [];
  try {
    leases = await loadLeaseTerminationOptions();
  } catch {
    leases = [];
  }

  if (editingId) {
    try {
      const record = await getLeaseTermination(editingId);
      if (!record || record.deletedAt) {
        sessionStorage.removeItem('baroli:termination-edit-id');
        editingId = '';
      } else {
        const leaseSelect = form.elements.leaseId;
        leaseSelect.value = record.leaseId || '';
        leaseSelect.dispatchEvent(new Event('change'));
        hydrateInput(form, record.input || {});
        const notes = form.elements.notes;
        if (notes) notes.value = record.notes || '';
        if (statusSelect) statusSelect.value = record.status || 'CALCULADA';
        const title = root.querySelector('.page-header h1');
        if (title) title.textContent = 'Editar rescisão';
        saveButton.textContent = 'Salvar alterações';
        form.requestSubmit();
      }
    } catch (cause) {
      feedback.textContent = cause.message || 'Não foi possível carregar a rescisão para edição.';
      feedback.classList.add('is-error');
    }
  }

  saveButton.addEventListener('click', async () => {
    feedback.textContent = '';
    feedback.classList.remove('is-error', 'is-success');
    const leaseId = value(form, 'leaseId');
    if (!leaseId) {
      feedback.textContent = 'Selecione uma locação antes de salvar.';
      feedback.classList.add('is-error');
      return;
    }

    saveButton.disabled = true;
    const originalText = saveButton.textContent;
    saveButton.textContent = 'Salvando...';
    try {
      const input = collectInput(form);
      const calculation = calculateLeaseTermination(input);
      const lease = leases.find((item) => item.id === leaseId) || {
        id: leaseId,
        contractNumber: '',
        propertyLabel: input.property,
        landlordName: input.landlord,
        tenantName: input.tenant
      };
      editingId = await saveLeaseTermination({
        id: editingId,
        lease,
        input,
        calculation,
        notes: value(form, 'notes'),
        status: statusSelect?.value || 'CALCULADA'
      });
      sessionStorage.setItem('baroli:termination-edit-id', editingId);
      saveButton.textContent = 'Salvar alterações';
      feedback.textContent = 'Cálculo salvo com sucesso. Você pode continuar editando ou voltar para a consulta.';
      feedback.classList.add('is-success');
    } catch (cause) {
      saveButton.textContent = originalText;
      feedback.textContent = cause.message || 'Não foi possível salvar o cálculo.';
      feedback.classList.add('is-error');
    } finally {
      saveButton.disabled = false;
    }
  });

  form.addEventListener('reset', () => {
    sessionStorage.removeItem('baroli:termination-edit-id');
    editingId = '';
    saveButton.textContent = 'Salvar cálculo';
    if (statusSelect) statusSelect.value = 'CALCULADA';
    feedback.textContent = '';
  });
}
