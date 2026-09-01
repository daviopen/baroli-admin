import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLeaseTermination } from '../src/services/lease-termination.service.js';

const base = {
  contractStart: '2025-03-01',
  contractEnd: '2028-02-29',
  terminationDate: '2026-08-13',
  monthlyRent: 2184.89,
  applyTerminationFee: false,
  rentPeriodStart: '2026-08-10',
  annualIptu: 933.9,
  iptuPaid: 622.6,
  iptuPaidBy: 'tenant',
  condoTotal: 423.19,
  condoExtraFee: 0,
  condoReserveFund: 0,
  condoPunctualityDiscount: 0,
  gas: 0,
  water: 0,
  laundry: 0,
  otherIndividualExpenses: 0,
  condoPaid: 423.19,
  condoPaidBy: 'tenant',
  inspectionCount: 1,
  inspectionUnitPrice: 0,
  otherCharges: 0,
  reimbursements: 0
};

function close(actual, expected, tolerance = 0.01) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

test('reproduz o exemplo principal da planilha de rescisão', () => {
  const result = calculateLeaseTermination(base);

  assert.equal(result.rent.days, 4);
  close(result.rent.proportional, 291.3186667);
  assert.equal(result.iptu.days, 225);
  close(result.iptu.balance, -46.90821918);
  assert.equal(result.condo.days, 13);
  close(result.condo.balance, -239.81);
  close(result.finalBalance, 4.600447489);
  assert.equal(result.result, 'TENANT_PAYS');
});

test('aplica multa de três aluguéis proporcional ao prazo restante', () => {
  const result = calculateLeaseTermination({ ...base, applyTerminationFee: true });
  assert.equal(result.terminationFee.applied, true);
  assert.ok(result.terminationFee.proportional > 0);
  close(
    result.terminationFee.proportional,
    result.terminationFee.base * (result.terminationFee.remainingContractDays / result.terminationFee.totalContractDays)
  );
});

test('pagamento de IPTU por proprietário não reduz responsabilidade do inquilino', () => {
  const result = calculateLeaseTermination({ ...base, iptuPaidBy: 'landlord' });
  close(result.iptu.paidByTenant, 0);
  close(result.iptu.balance, result.iptu.proportional);
});

test('despesas individuais de condomínio são cobradas integralmente', () => {
  const result = calculateLeaseTermination({
    ...base,
    condoTotal: 523.19,
    gas: 60,
    water: 40,
    condoPaid: 0,
    condoPaidBy: 'landlord'
  });

  close(result.condo.individualExpenses, 100);
  close(result.condo.monthlyBase, 423.19);
  close(result.condo.responsibility, (423.19 / 30) * 13 + 100);
});

test('primeira vistoria é gratuita e adicionais são cobradas', () => {
  const result = calculateLeaseTermination({ ...base, inspectionCount: 3, inspectionUnitPrice: 120 });
  assert.equal(result.inspections.additional, 2);
  close(result.inspections.value, 240);
});

test('rejeita datas inconsistentes', () => {
  assert.throws(
    () => calculateLeaseTermination({ ...base, rentPeriodStart: '2026-08-14' }),
    /início do período de aluguel/i
  );
});
