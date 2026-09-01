const DAY_MS = 86_400_000;

function asNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function parseDate(value, field) {
  if (!value) throw new Error(`Informe ${field}.`);
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`Data inválida em ${field}.`);
  return date;
}

function diffDays(start, end) {
  return Math.round((end.getTime() - start.getTime()) / DAY_MS);
}

function inclusiveDays(start, end, maximum = Number.POSITIVE_INFINITY) {
  if (end < start) return 0;
  return Math.min(diffDays(start, end) + 1, maximum);
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/**
 * Calcula a rescisão de contrato de locação conforme o modelo administrativo
 * utilizado pela Baroli Imóveis. Valores positivos representam cobrança ao
 * inquilino; valores negativos representam ressarcimento.
 *
 * @param {object} input
 * @returns {object}
 */
export function calculateLeaseTermination(input) {
  const contractStart = parseDate(input.contractStart, 'o início do contrato');
  const contractEnd = parseDate(input.contractEnd, 'o término previsto');
  const terminationDate = parseDate(input.terminationDate, 'a data da rescisão');
  const rentPeriodStart = parseDate(input.rentPeriodStart, 'o início do período de aluguel');

  if (contractEnd <= contractStart) throw new Error('O término previsto deve ser posterior ao início do contrato.');
  if (terminationDate < contractStart) throw new Error('A rescisão não pode ser anterior ao início do contrato.');
  if (rentPeriodStart > terminationDate) throw new Error('O início do período de aluguel não pode ser posterior à rescisão.');

  const monthlyRent = asNumber(input.monthlyRent);
  if (monthlyRent < 0) throw new Error('O aluguel atual não pode ser negativo.');

  const rentDays = inclusiveDays(rentPeriodStart, terminationDate, 30);
  const dailyRent = monthlyRent / 30;
  const proportionalRent = dailyRent * rentDays;

  const totalContractDays = Math.max(diffDays(contractStart, contractEnd), 0);
  const remainingContractDays = Math.max(diffDays(terminationDate, contractEnd), 0);
  const terminationFeeBase = monthlyRent * 3;
  const terminationFeeFraction = totalContractDays > 0 ? remainingContractDays / totalContractDays : 0;
  const terminationFee = input.applyTerminationFee && terminationDate < contractEnd
    ? terminationFeeBase * terminationFeeFraction
    : 0;

  const annualIptu = asNumber(input.annualIptu);
  const terminationYear = terminationDate.getUTCFullYear();
  const yearDays = isLeapYear(terminationYear) ? 366 : 365;
  const yearStart = new Date(Date.UTC(terminationYear, 0, 1, 12));
  const iptuDays = inclusiveDays(yearStart, terminationDate, yearDays);
  const dailyIptu = annualIptu / yearDays;
  const proportionalIptu = dailyIptu * iptuDays;
  const iptuPaid = asNumber(input.iptuPaid);
  const tenantIptuPaid = input.iptuPaidBy === 'tenant' ? iptuPaid : 0;
  const iptuBalance = proportionalIptu - tenantIptuPaid;

  const condoTotal = asNumber(input.condoTotal);
  const extraFee = asNumber(input.condoExtraFee);
  const reserveFund = asNumber(input.condoReserveFund);
  const punctualityDiscount = asNumber(input.condoPunctualityDiscount);
  const individualExpenses = [
    input.gas,
    input.water,
    input.laundry,
    input.otherIndividualExpenses
  ].reduce((sum, value) => sum + asNumber(value), 0);

  const condoMonthlyBase = Math.max(
    condoTotal - extraFee - reserveFund - individualExpenses - punctualityDiscount,
    0
  );
  const condoPeriodStart = new Date(Date.UTC(
    terminationDate.getUTCFullYear(),
    terminationDate.getUTCMonth(),
    1,
    12
  ));
  const condoDays = inclusiveDays(condoPeriodStart, terminationDate, 30);
  const condoProportionalBase = (condoMonthlyBase / 30) * condoDays;
  const tenantCondoResponsibility = condoProportionalBase + individualExpenses;
  const condoPaid = asNumber(input.condoPaid);
  const tenantCondoPaid = input.condoPaidBy === 'tenant' ? condoPaid : 0;
  const condoBalance = tenantCondoResponsibility - tenantCondoPaid;

  const inspectionCount = Math.max(Math.trunc(asNumber(input.inspectionCount)), 0);
  const additionalInspections = Math.max(inspectionCount - 1, 0);
  const inspectionUnitPrice = Math.max(asNumber(input.inspectionUnitPrice), 0);
  const inspectionsTotal = additionalInspections * inspectionUnitPrice;

  const otherCharges = Math.max(asNumber(input.otherCharges), 0);
  const reimbursements = Math.max(asNumber(input.reimbursements), 0);

  const finalBalance = proportionalRent
    + terminationFee
    + iptuBalance
    + condoBalance
    + inspectionsTotal
    + otherCharges
    - reimbursements;

  return {
    rent: { days: rentDays, dailyValue: dailyRent, proportional: proportionalRent },
    terminationFee: {
      applied: Boolean(input.applyTerminationFee && terminationDate < contractEnd),
      base: terminationFeeBase,
      totalContractDays,
      remainingContractDays,
      fraction: terminationFeeFraction,
      proportional: terminationFee
    },
    iptu: {
      year: terminationYear,
      yearDays,
      days: iptuDays,
      dailyValue: dailyIptu,
      proportional: proportionalIptu,
      paidByTenant: tenantIptuPaid,
      balance: iptuBalance
    },
    condo: {
      days: condoDays,
      individualExpenses,
      monthlyBase: condoMonthlyBase,
      proportionalBase: condoProportionalBase,
      responsibility: tenantCondoResponsibility,
      paidByTenant: tenantCondoPaid,
      balance: condoBalance
    },
    inspections: { total: inspectionCount, additional: additionalInspections, unitPrice: inspectionUnitPrice, value: inspectionsTotal },
    adjustments: { otherCharges, reimbursements },
    finalBalance,
    result: finalBalance > 0.005 ? 'TENANT_PAYS' : finalBalance < -0.005 ? 'TENANT_RECEIVES' : 'SETTLED'
  };
}
