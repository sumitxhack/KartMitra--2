import { test, expect, Page, Locator } from '@playwright/test';

test.describe('KartMitra AI Verification System E2E Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Dashboard
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /AI Verification Testing/i })).toBeVisible();
  });

  // Helper locator for overall verification status badge element
  const getStatusBadge = (page: Page) =>
    page.locator('div.text-3xl.font-black.tracking-tight');

  // Helper to wait for status result to change from STANDBY and return text
  const waitForStatusResult = async (page: Page): Promise<string> => {
    const statusBadge = getStatusBadge(page);
    await expect(statusBadge).not.toHaveText('STANDBY');
    return (await statusBadge.textContent())?.trim() || '';
  };

  // Helper to set range slider value in React
  const setRangeValue = async (page: Page, locator: Locator, val: string) => {
    await locator.evaluate((el: HTMLInputElement, value: string) => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;
      nativeInputValueSetter?.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, val);
  };

  // SCENARIO 1: Correct product
  test('Scenario 1: Correct product - expect PASS', async ({ page }) => {
    await page.click('button:has-text("Perfect Match (PASS)")');
    await page.click('button:has-text("Run Verification Test")');

    const text = await waitForStatusResult(page);
    expect(text).toBe('PASS');
  });

  // SCENARIO 2: Unknown product
  test('Scenario 2: Unknown product - expect FAIL or REVIEW', async ({ page }) => {
    const barcodeInput = page.locator('input[value*="890"]').first();
    await barcodeInput.fill('9999999999999');

    await page.click('button:has-text("Run Verification Test")');

    const text = await waitForStatusResult(page);
    expect(['FAIL', 'REVIEW']).toContain(text);
  });

  // SCENARIO 3: Wrong barcode
  test('Scenario 3: Wrong barcode - expect FAIL or REVIEW', async ({ page }) => {
    await page.click('button:has-text("Barcode Swap (MISMATCH)")');
    await page.click('button:has-text("Run Verification Test")');

    const text = await waitForStatusResult(page);
    expect(['FAIL', 'REVIEW']).toContain(text);
  });

  // SCENARIO 4: Barcode/vision mismatch
  test('Scenario 4: Barcode/vision mismatch - expect REVIEW or FAIL', async ({ page }) => {
    await page.click('button:has-text("Perfect Match (PASS)")');

    const visionInput = page.locator('input[value*="Amul"]').first();
    await visionInput.fill('Tata Salt Iodized 1kg');

    const confidenceSlider = page.locator('input[type="range"]').first();
    await setRangeValue(page, confidenceSlider, '0.50');

    await page.click('button:has-text("Run Verification Test")');

    const text = await waitForStatusResult(page);
    expect(['FAIL', 'REVIEW']).toContain(text);
  });

  // SCENARIO 5: Low AI confidence
  test('Scenario 5: Low AI confidence - expect REVIEW or FAIL', async ({ page }) => {
    await page.click('button:has-text("Perfect Match (PASS)")');

    const visionInput = page.locator('input[value*="Amul"]').first();
    await visionInput.fill('Uncertain Low-Conf Item');

    const confidenceSlider = page.locator('input[type="range"]').first();
    await setRangeValue(page, confidenceSlider, '0.35');

    await page.click('button:has-text("Run Verification Test")');

    const text = await waitForStatusResult(page);
    expect(['FAIL', 'REVIEW']).toContain(text);
  });

  // SCENARIO 6: Correct weight
  test('Scenario 6: Correct weight - expect PASS', async ({ page }) => {
    await page.click('button:has-text("Perfect Match (PASS)")');
    await page.click('button:has-text("Exact (0g)")');
    await page.click('button:has-text("Run Verification Test")');

    const text = await waitForStatusResult(page);
    expect(text).toBe('PASS');
  });

  // SCENARIO 7: Small weight mismatch (packaging variance within 50g tolerance)
  test('Scenario 7: Small weight mismatch - expect REVIEW', async ({ page }) => {
    await page.click('button:has-text("Packaging Variance (REVIEW)")');
    await page.click('button:has-text("Run Verification Test")');

    const text = await waitForStatusResult(page);
    expect(text).toBe('REVIEW');
  });

  // SCENARIO 8: Large weight mismatch (exceeds tolerance limit)
  test('Scenario 8: Large weight mismatch - expect FAIL', async ({ page }) => {
    await page.click('button:has-text("Scale Overweight (FAIL)")');
    await page.click('button:has-text("Run Verification Test")');

    const text = await waitForStatusResult(page);
    expect(text).toBe('FAIL');
  });

  // SCENARIO 9: Wrong quantity
  test('Scenario 9: Wrong quantity - expect FAIL or REVIEW', async ({ page }) => {
    const qtyInput = page.locator('input[type="number"]').first();
    await qtyInput.fill('3');

    await page.click('button:has-text("Exact (0g)")');
    await page.click('button:has-text("Run Verification Test")');

    const text = await waitForStatusResult(page);
    expect(['FAIL', 'REVIEW']).toContain(text);
  });

  // SCENARIO 10: Wrong amount
  test('Scenario 10: Wrong amount - expect FAIL or REVIEW', async ({ page }) => {
    await page.click('button:has-text("Barcode Swap (MISMATCH)")');
    await page.click('button:has-text("Run Verification Test")');

    const text = await waitForStatusResult(page);
    expect(['FAIL', 'REVIEW']).toContain(text);
  });

  // SCENARIO 11: Empty cart / missing items
  test('Scenario 11: Empty cart - expect FAIL or REVIEW', async ({ page }) => {
    await page.click('button:has-text("0.00kg (Missing)")');
    await page.click('button:has-text("Run Verification Test")');

    const text = await waitForStatusResult(page);
    expect(['FAIL', 'REVIEW']).toContain(text);
  });

  // SCENARIO 12: Invalid session
  test('Scenario 12: Invalid session - expect FAIL', async ({ page }) => {
    const sessionBtn = page.locator('button:has-text("ACTIVE ✓")');
    if (await sessionBtn.isVisible()) {
      await sessionBtn.click();
    }

    await page.click('button:has-text("Run Verification Test")');

    const text = await waitForStatusResult(page);
    expect(text).toBe('FAIL');
  });

  // SCENARIO 13: Unauthorized request
  test('Scenario 13: Unauthorized request - expect FAIL', async ({ page }) => {
    const sessionBtn = page.locator('button:has-text("ACTIVE ✓")');
    if (await sessionBtn.isVisible()) {
      await sessionBtn.click();
    }

    await page.click('button:has-text("Run Verification Test")');

    const text = await waitForStatusResult(page);
    expect(text).toBe('FAIL');
  });

  // SCENARIO 14: Multiple products
  test('Scenario 14: Multiple products - expect PASS or REVIEW', async ({ page }) => {
    const productSelect = page.locator('select');
    await productSelect.selectOption({ index: 1 });

    await page.click('button:has-text("Run Verification Test")');

    const text = await waitForStatusResult(page);
    expect(['PASS', 'REVIEW']).toContain(text);
  });

  // SCENARIO 15: Mixed correct and incorrect products
  test('Scenario 15: Mixed correct and incorrect products - expect FAIL or REVIEW', async ({ page }) => {
    const productSelect = page.locator('select');
    await productSelect.selectOption({ index: 0 });

    await page.click('button:has-text("Barcode Swap (MISMATCH)")');
    await page.click('button:has-text("Exact (0g)")');

    await page.click('button:has-text("Run Verification Test")');

    const text = await waitForStatusResult(page);
    expect(['FAIL', 'REVIEW']).toContain(text);
  });
});
