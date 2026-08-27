/* global process */
import { existsSync } from "node:fs";
import { Builder, By, Key, until } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";

const APP_URL = process.env.E2E_APP_URL || "http://localhost:5173";
const HEADLESS = process.env.E2E_HEADLESS !== "false";
const E2E_USER_LOGIN = process.env.E2E_USER_LOGIN || "";
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD || "";
const E2E_CHANNEL_URL = process.env.E2E_CHANNEL_URL || "";
const E2E_MESSAGE_TEXT =
  process.env.E2E_MESSAGE_TEXT || `Selenium test ${Date.now()}`;

const CHROME_BINARY_PATH =
  process.env.CHROME_BINARY_PATH ||
  (["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find(
    (candidatePath) => existsSync(candidatePath)
  ) ?? "");

const resolveAppUrl = (pathOrUrl) => {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  return new URL(pathOrUrl, APP_URL).toString();
};

const createDriver = async () => {
  const options = new chrome.Options();

  if (HEADLESS) {
    options.addArguments("--headless=new");
  }

  if (CHROME_BINARY_PATH) {
    options.setChromeBinaryPath(CHROME_BINARY_PATH);
  }

  options.addArguments(
    "--window-size=1440,900",
    "--disable-dev-shm-usage",
    "--no-sandbox"
  );

  return new Builder().forBrowser("chrome").setChromeOptions(options).build();
};

const assertTextIncludes = (text, expected, label) => {
  if (!String(text || "").toLowerCase().includes(expected.toLowerCase())) {
    throw new Error(`${label} should include "${expected}", received "${text}".`);
  }
};

const getBodyText = async (driver) =>
  driver.findElement(By.css("body")).getText();

const testPublicAuthFlow = async (driver) => {
  await driver.get(resolveAppUrl("/login"));
  await driver.wait(until.elementLocated(By.css("body")), 10000);

  let bodyText = await getBodyText(driver);
  assertTextIncludes(bodyText, "Welcome back", "Login page");

  const forgotPasswordLink = await driver.findElement(
    By.css('a[href="/forgot-password"]')
  );
  await forgotPasswordLink.click();
  await driver.wait(until.urlContains("/forgot-password"), 10000);
  bodyText = await getBodyText(driver);
  assertTextIncludes(bodyText, "password", "Forgot-password page");

  await driver.get(resolveAppUrl("/register"));
  await driver.wait(until.elementLocated(By.css("body")), 10000);
  bodyText = await getBodyText(driver);
  assertTextIncludes(bodyText, "register", "Registration page");

  await driver.get(resolveAppUrl("/login"));
  const loginInput = await driver.findElement(By.css('input[name="login"]'));
  const passwordInput = await driver.findElement(By.css('input[name="password"]'));

  await loginInput.sendKeys("selenium@example.com");
  await passwordInput.sendKeys("wrong-password");

  const loginButton = await driver.findElement(By.css("button[type='submit']"));
  await loginButton.click();

  await driver.wait(
    until.elementLocated(By.css(".auth-feedback-error, .auth-feedback-warning")),
    10000
  );

  const feedback = await driver
    .findElement(By.css(".auth-feedback-error, .auth-feedback-warning"))
    .getText();

  if (!feedback.trim()) {
    throw new Error("Login feedback should be visible after invalid credentials.");
  }

  if (/unable to reach|network|failed to fetch/i.test(feedback)) {
    throw new Error(`Backend should be reachable during E2E testing, received "${feedback}".`);
  }
};

const testAuthenticatedFlow = async (driver) => {
  if (!E2E_USER_LOGIN || !E2E_USER_PASSWORD) {
    console.log(
      "Authenticated Selenium flow skipped. Set E2E_USER_LOGIN and E2E_USER_PASSWORD to enable it."
    );
    return;
  }

  await driver.get(resolveAppUrl("/login"));

  const loginInput = await driver.findElement(By.css('input[name="login"]'));
  const passwordInput = await driver.findElement(By.css('input[name="password"]'));

  await loginInput.clear();
  await passwordInput.clear();
  await loginInput.sendKeys(E2E_USER_LOGIN);
  await passwordInput.sendKeys(E2E_USER_PASSWORD);
  await driver.findElement(By.css("button[type='submit']")).click();

  await driver.wait(until.urlContains("/dashboard"), 15000);
  await driver.wait(until.elementLocated(By.css(".main-page-shell")), 15000);

  const bodyText = await getBodyText(driver);
  assertTextIncludes(bodyText, "Friends", "Authenticated dashboard");
  assertTextIncludes(bodyText, "Log out", "Authenticated dashboard");

  if (E2E_CHANNEL_URL) {
    await driver.get(resolveAppUrl(E2E_CHANNEL_URL));
    const composer = await driver.wait(
      until.elementLocated(By.css("textarea.discord-composer-input")),
      15000
    );
    await driver.wait(until.elementIsEnabled(composer), 15000);

    await composer.sendKeys(E2E_MESSAGE_TEXT, Key.ENTER);

    await driver.wait(async () => {
      const channelText = await getBodyText(driver);
      return channelText.includes(E2E_MESSAGE_TEXT);
    }, 15000);
  }

  const logoutButton = await driver.findElement(
    By.xpath("//button[contains(normalize-space(.), 'Log out')]")
  );
  await logoutButton.click();
  await driver.wait(until.urlContains("/login"), 10000);
};

let driver;

try {
  driver = await createDriver();
  await testPublicAuthFlow(driver);
  await testAuthenticatedFlow(driver);
  console.log("Selenium system/E2E test passed.");
} finally {
  if (driver) {
    await driver.quit();
  }
}
