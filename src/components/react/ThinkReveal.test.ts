import { expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThinkReveal } from '@/components/react/ThinkReveal';

test('offers a closed optional hint while keeping the solution undisclosed', () => {
  const html = renderToStaticMarkup(createElement(ThinkReveal, {
    prompt: 'What changes in the second year?',
    hint: 'Consider the balance used to calculate interest.',
    text: 'The previous interest is now part of the base.',
  }));
  expect(html).toContain('<details');
  expect(html).not.toContain('<details open');
  expect(html).not.toContain('The previous interest is now part of the base.');
  const controlledId = html.match(/aria-controls="([^"]+)"/)?.[1];
  expect(controlledId).toBeDefined();
  expect(html).toContain(`id="${controlledId}"`);
});
