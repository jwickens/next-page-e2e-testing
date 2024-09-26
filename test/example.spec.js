import { test, expect } from './playwright';

test.describe('Home page', () => {
  test('Can view the page', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', {
        name: 'About Futurama'
      })
    ).toBeVisible();

    await expect(
      page
        .getByRole('listitem')
        .filter(
          { hasText: 'Philip Fry' }
        )
    ).toBeVisible();

    await expect(
      page.getByText(' performing charitable tasks for tax deductions.')).toBeVisible();
  });
});
