import { expect, test } from '@playwright/test';
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

test('desenhos "onde medir": os 15 abrem, legíveis em 360 px (texto ≥ 14 px, traço ≥ 2 px, nada cortado)', async ({
  page,
}) => {
  await page.goto('./');
  await importarFixture(page);
  const vistos = new Set<string>();

  for (const tag of ['XA-TC-01', 'XA-EC-01', 'XB-PV-01']) {
    await page.goto('./#/');
    await abrirFicha(page, tag);
    const resumos = page.locator('details.desenhos > summary');
    const n = await resumos.count();
    // Botão de 48 px numa linha só (o nome curto cabe em 360 px).
    const alturas = await resumos.evaluateAll((els) =>
      els.map((e) => e.getBoundingClientRect().height),
    );
    expect(Math.min(...alturas)).toBeGreaterThanOrEqual(48);
    expect(Math.max(...alturas)).toBeLessThan(60);
    for (let k = 0; k < n; k++) await resumos.nth(k).click();
    // Cada desenho aberto mostra a figura (o SVG só é montado ao abrir).
    await expect(page.locator('details.desenhos[open]')).toHaveCount(n);
    await expect(page.locator('details.desenhos[open]:not(:has(figure))')).toHaveCount(0);

    for (const nome of await page
      .locator('.desenho-svg')
      .evaluateAll((svgs) => svgs.map((s) => s.getAttribute('aria-label') ?? '')))
      vistos.add(nome);

    expect(await page.evaluate(problemasDeLeitura)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      360,
    );
  }

  expect(vistos.size).toBe(15);
});

test('cada desenho tem seu botão: fechado por padrão, abre e fecha com um toque grande', async ({
  page,
}) => {
  await page.goto('./');
  await importarFixture(page);
  await abrirFicha(page, 'XA-TC-01');
  const tapete = page
    .locator('li.item')
    .filter({ has: page.getByRole('heading', { name: 'TAPETE', exact: true }) });
  const deCima = tapete.locator('summary', { hasText: 'Desenho: vista de cima' });
  await expect(tapete.locator('summary', { hasText: 'Desenho: corte' })).toBeVisible();
  await expect(tapete.getByRole('img')).toHaveCount(0);
  expect((await deCima.boundingBox())!.height).toBeGreaterThanOrEqual(48);

  await deCima.click();
  await expect(tapete.getByRole('img')).toHaveCount(1); // só o desenho tocado
  await expect(tapete.getByRole('img', { name: /Tapete visto de cima/ })).toBeVisible();
  const fechar = tapete.locator('summary', { hasText: 'Fechar desenho' });
  await fechar.click();
  await expect(tapete.getByRole('img')).toHaveCount(0);
});
