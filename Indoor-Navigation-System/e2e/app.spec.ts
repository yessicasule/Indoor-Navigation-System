import { expect, test, type Page } from "@playwright/test";

// The template site (data/sites/_template): anchor A1 at the origin, scanned facing map +y;
// route to Room 201 goes A1 -> C1 (north, +y) -> C2 (east, +x) -> stairs -> R201.
const ANCHOR_URL = "/ar?site=_template&node=_template__A1";

// Simulated sensor: fires deviceorientationabsolute at ~30 Hz from window.__orientation.
// With the phone upright (beta 90), alpha = 0 means the camera faces map +y; alpha = 270 faces +x.
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    (window as unknown as { __orientation: object }).__orientation = { alpha: 0, beta: 90, gamma: 0 };
    setInterval(() => {
      const e = new Event("deviceorientationabsolute");
      Object.assign(e, { ...(window as unknown as { __orientation: object }).__orientation, absolute: true });
      window.dispatchEvent(e);
    }, 33);
  });
});

const face = (page: Page, alpha: number) =>
  page.evaluate(a => { (window as unknown as { __orientation: object }).__orientation = { alpha: a, beta: 90, gamma: 0 }; }, alpha);

/** Current arrow rotation in degrees (positive = clockwise = turn right). */
async function arrowRotation(page: Page): Promise<number> {
  await page.waitForTimeout(1500); // heading smoothing settles
  const style = await page.locator('[style*="rotate("]').getAttribute("style");
  return Number(/rotate\((-?[\d.]+)deg\)/.exec(style ?? "")?.[1]);
}

test("home page has no stale features and links to scanning", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Navigate Mumbai")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Scan" })).toBeVisible();
  await expect(page.getByText(/My Trips|Find Trains/)).toHaveCount(0);
});

test("anchor link: calibrates at the marker, routes across floors, arrow follows heading", async ({ page }) => {
  await page.goto(ANCHOR_URL);
  await expect(page.getByRole("heading", { name: "Main Entrance" })).toBeVisible();
  await expect(page.getByText("Template Building")).toBeVisible();
  await expect(page.getByText(/calibrated at this marker/)).toBeVisible();

  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Room 201" }).click();
  await page.getByRole("button", { name: /Start Navigation/ }).click();

  await expect(page.getByText("To Room 201")).toBeVisible();
  expect(Math.abs(await arrowRotation(page))).toBeLessThan(2); // facing the corridor: straight ahead

  await face(page, 90); // now facing map -x (west); corridor runs +y => turn right 90°
  expect(await arrowRotation(page)).toBeCloseTo(90, 0);

  await page.getByRole("button", { name: /I'm Here/ }).click(); // C1 -> C2 runs +x
  await face(page, 270); // facing +x
  expect(Math.abs(await arrowRotation(page))).toBeLessThan(2);

  await page.getByRole("button", { name: /I'm Here/ }).click();
  await page.getByRole("button", { name: /I'm Here/ }).click(); // STG -> ST1: stairs, no arrow
  await expect(page.getByText("Take the stairs/lift to floor 1").first()).toBeVisible();

  await page.getByRole("button", { name: /I'm Here/ }).click();
  await page.getByRole("button", { name: /I'm Here/ }).click();
  await expect(page.getByRole("heading", { name: "Arrived!" })).toBeVisible();

  await page.getByRole("link", { name: "Close navigation" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("rejects QR codes that are not anchors", async ({ page }) => {
  await page.goto("/ar?site=_template&node=does_not_exist");
  await expect(page.getByText(/Unknown anchor/)).toBeVisible();
});

test("study 2 logging uploads telemetry while navigating", async ({ page }) => {
  const stored: number[] = [];
  page.on("response", async res => {
    if (res.url().endsWith("/api/telemetry") && res.status() === 201) stored.push((await res.json()).stored);
  });
  await page.goto(`${ANCHOR_URL}&log=1&pid=E01&device=e2e`);
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Lab 101" }).click();
  await page.getByRole("button", { name: /Start Navigation/ }).click();
  await expect(page.getByText(/REC/)).toBeVisible();
  await page.waitForTimeout(6000); // ~30 samples at 5 Hz, flushed every 2 s
  const total = stored.reduce((a, b) => a + b, 0);
  expect(total).toBeGreaterThanOrEqual(20);
  expect(total).toBeLessThanOrEqual(35);
});

test("study 1 capture records ~50 north-referenced samples in 10 s", async ({ page }) => {
  test.setTimeout(45_000);
  await page.goto("/ar?study=1&site=_template&point=P07&device=e2e&pid=E01");
  await page.getByRole("button", { name: /Capture P07/ }).click();
  await expect(page.getByText(/P07: \d+ samples/)).toBeVisible({ timeout: 20_000 });
  const n = Number(/P07: (\d+) samples/.exec(await page.getByText(/P07: \d+ samples/).innerText())?.[1]);
  expect(n).toBeGreaterThanOrEqual(45);
  expect(n).toBeLessThanOrEqual(55);
  await expect(page.getByText("deviceorientationabsolute · absolute")).toBeVisible();
  await page.getByRole("button", { name: /Next point \(P08\)/ }).click();
  await expect(page).toHaveURL(/point=P08/);
});
