import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DoubleEntryLedger, type DoubleEntryLedgerProps } from '@/components/react/DoubleEntryLedger';

const render = (props: DoubleEntryLedgerProps = {}) =>
  renderToStaticMarkup(createElement(DoubleEntryLedger, props));

const spanish = {
  currencyPrefix: '€',
  locale: 'es-ES',
  moneyInMessage: '{description}: {previous} más {amount} de entrada da {balance}.',
  moneyOutMessage: '{description}: {previous} menos {amount} de salida da {balance}.',
};

describe('DoubleEntryLedger posting messages', () => {
  test('keeps the existing English default message', () => {
    const html = render({
      entries: [
        { date: '1 Nov', description: 'Opening', in: 500 },
        { date: '2 Nov', description: 'Electricity', out: 95 },
      ],
    });
    expect(html).toContain('Electricity: $500.00 minus $95.00 out makes $405.00.');
  });

  test('localizes deposits in the visible live output', () => {
    const html = render({
      ...spanish,
      entries: [
        { date: '1 nov', description: 'Saldo inicial', in: 500 },
        { date: '2 nov', description: 'Devolución', in: 60 },
      ],
    });
    expect(html).toContain('Devolución: €500,00 más €60,00 de entrada da €560,00.');
    expect(html).not.toContain(' in makes ');
  });

  test('localizes withdrawals without changing the running balance', () => {
    const html = render({
      ...spanish,
      entries: [
        { date: '1 nov', description: 'Saldo inicial', in: 500 },
        { date: '2 nov', description: 'Electricidad', out: 95 },
      ],
    });
    expect(html).toContain('Electricidad: €500,00 menos €95,00 de salida da €405,00.');
    expect(html).not.toContain(' out makes ');
  });
});

describe('DoubleEntryLedger entry validation', () => {
  test('rejects a dual entry instead of showing contradictory arithmetic', () => {
    expect(() => render({ entries: [{ date: '1 Nov', description: 'Both', in: 100, out: 40 }] }))
      .toThrow('needs exactly one of in or out');
  });

  test('rejects missing and invalid amounts', () => {
    expect(() => render({ entries: [{ date: '1 Nov', description: 'Missing' }] }))
      .toThrow('needs exactly one of in or out');
    for (const amount of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => render({ entries: [{ date: '1 Nov', description: 'Invalid', in: amount }] }))
        .toThrow('needs a finite non-negative amount');
    }
  });

  test('requires a nonempty ledger and named rows', () => {
    expect(() => render({ entries: [] })).toThrow('requires at least one entry');
    expect(() => render({ entries: [{ date: '', description: 'Opening', in: 1 }] }))
      .toThrow('needs a date and description');
    expect(() => render({ entries: [{ date: '1 Nov', description: ' ', in: 1 }] }))
      .toThrow('needs a date and description');
  });

  test('supports a zero opening balance', () => {
    expect(render({ entries: [{ date: '1 Nov', description: 'Opening', in: 0 }] }))
      .toContain('Opening: $0.00 plus $0.00 in makes $0.00.');
  });
});
