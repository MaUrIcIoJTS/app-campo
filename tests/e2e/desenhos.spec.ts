import { expect, test, type Page } from '@playwright/test';
import { abrirFicha, importarFixture } from './apoio.ts';

/** Problemas de legibilidade dos desenhos abertos na página (vazio = tudo certo). */
function problemasDeLeitura() {
  const problemas: string[] = [];
  for (const svg of document.querySelectorAll<SVGSVGElement>('.desenho-svg')) {
    const nome = svg.getAttribute('aria-label');
    const vb = svg.viewBox.baseVal;
    const escala = svg.getScreenCTM()?.a ?? 0;
    for (const t of svg.querySelectorAll<SVGTextElement>('text')) {
      const px = parseFloat(getComputedStyle(t).fontSize) * escala;
      if (px < 14) problemas.push(`${nome}: "${t.textContent}" com ${px.toFixed(1)} px`);
      const c = t.getBBox(); // texto cortado na borda do desenho
      if (c.x < 0 || c.y < 0 || c.x + c.width > vb.width || c.y + c.height > vb.height)
        problemas.push(`${nome}: "${t.textContent}" sai do desenho`);
    }
    for (const el of svg.querySelectorAll<SVGGraphicsElement>(
      'line, rect, path, circle, polygon',
    )) {
      const estilo = getComputedStyle(el);
      if (estilo.stroke === 'none' || el.closest('text')) continue;
      const px = parseFloat(estilo.strokeWidth) * escala;
      if (px < 2) problemas.push(`${nome}: traço de ${px.toFixed(2)} px em <${el.tagName}>`);
    }
  }
  return problemas;
}

/** Guias de medida da ficha aberta (sem PCM, Fotos e Notas). */
const guiasDeMedida = (page: Page) =>
  page
    .getByRole('tab')
    .evaluateAll((els) =>
      els
        .map((e) => e.id.replace('guia-', ''))
        .filter((id) => !['pcm', 'fotos', 'notas'].includes(id)),
    );

test('desenhos "onde medir" e croquis: os 24 abrem, legíveis em 360 px (texto ≥ 14 px, traço ≥ 2 px, nada cortado)', async ({
  page,
}) => {
  await page.goto('./');
  await importarFixture(page);
  const vistos = new Set<string>();

  for (const tag of [
    'XA-TC-01',
    'XA-EC-01',
    'XB-PV-01',
    'XB-AS-01',
    'XB-VV-04',
    'XB-SL-01',
    'XB-FM-01',
    'XB-MO-01',
    'XB-EX-01',
    'XB-RT-01',
  ]) {
    await page.goto('./#/');
    await abrirFicha(page, tag);
    for (const id of await guiasDeMedida(page)) {
      await page.locator(`#guia-${id}`).evaluate((el: HTMLElement) => el.click());
      await expect(page.locator(`#guia-${id}`)).toHaveAttribute('aria-selected', 'true');
      // O desenho da guia (se houver) já vem aberto no alto, com a figura.
      await expect(page.locator('details.desenho-guia:not([open])')).toHaveCount(0);
      const resumos = page.locator('details.desenhos > summary');
      const n = await resumos.count();
      if (n > 0) {
        // Botão de 48 px numa linha só (o nome curto cabe em 360 px).
        const alturas = await resumos.evaluateAll((els) =>
          els.map((e) => e.getBoundingClientRect().height),
        );
        expect(Math.min(...alturas)).toBeGreaterThanOrEqual(48);
        expect(Math.max(...alturas)).toBeLessThan(60);
      }
      for (let k = 0; k < n; k++) await resumos.nth(k).click();
      // Cada desenho aberto mostra a figura (o SVG só é montado ao abrir).
      await expect(page.locator('details.desenhos[open]')).toHaveCount(n);
      await expect(page.locator('details[open]:not(:has(figure))')).toHaveCount(0);

      for (const nome of await page
        .locator('.desenho-svg')
        .evaluateAll((svgs) => svgs.map((s) => s.getAttribute('aria-label') ?? '')))
        vistos.add(nome);

      expect(await page.evaluate(problemasDeLeitura)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        360,
      );
    }
  }

  expect(vistos.size).toBe(24);
});

test('desenho da guia aberto no alto ("Ocultar" lembra); os do cartão abrem com um toque grande', async ({
  page,
}) => {
  await page.goto('./');
  await importarFixture(page);
  await abrirFicha(page, 'XA-TC-01');

  // Guia Correia: a vista de cima já aberta no alto, antes do cartão do tapete.
  const doTopo = page.locator('details.desenho-guia');
  await expect(doTopo).toHaveAttribute('open', '');
  await expect(doTopo.getByRole('img', { name: /Tapete visto de cima/ })).toBeVisible();
  const resumo = doTopo.locator('summary');
  expect((await resumo.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  await expect(resumo).toContainText('Ocultar');

  // No cartão, só o que não está no alto: o corte, fechado por padrão.
  const tapete = page
    .locator('li.item')
    .filter({ has: page.getByRole('heading', { name: 'TAPETE', exact: true }) });
  await expect(tapete.locator('summary', { hasText: 'Desenho: vista de cima' })).toHaveCount(0);
  const corte = tapete.locator('summary', { hasText: 'Desenho: corte' });
  await expect(tapete.getByRole('img')).toHaveCount(0);
  expect((await corte.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  await corte.click();
  await expect(tapete.getByRole('img')).toHaveCount(1); // só o desenho tocado
  await tapete.locator('summary', { hasText: 'Fechar desenho' }).click();
  await expect(tapete.getByRole('img')).toHaveCount(0);

  // "Ocultar" recolhe e fica assim na ficha seguinte (o técnico já sabe onde medir).
  await resumo.click();
  await expect(doTopo.getByRole('img')).toHaveCount(0);
  await expect(resumo).toContainText('Ver desenho');
  await page.goto('./#/');
  await abrirFicha(page, 'XA-TC-02');
  await expect(page.locator('details.desenho-guia')).not.toHaveAttribute('open');
  await page.locator('details.desenho-guia > summary').click();
  await expect(page.locator('details.desenho-guia').getByRole('img')).toBeVisible();
});
