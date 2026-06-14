/* global process */
import { existsSync } from "node:fs";
import { Builder, By, until } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";

const APP_URL = process.env.E2E_APP_URL || "http://localhost:5173";
const HEADLESS = process.env.E2E_HEADLESS !== "false";
const CHROME_BINARY_PATH =
  process.env.CHROME_BINARY_PATH ||
  (["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find(
    (candidatePath) => existsSync(candidatePath)
  ) ?? "");

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

let driver;

try {
  driver = await createDriver();
  await driver.get(APP_URL);
  await driver.wait(until.elementLocated(By.css("body")), 10000);

  const bodyText = await driver.findElement(By.css("body")).getText();
  assertTextIncludes(bodyText, "Welcome back", "Login page");

  const loginInput = await driver.findElement(By.css('input[name="login"]'));
  const passwordInput = await driver.findElement(By.css('input[name="password"]'));
  await loginInput.sendKeys("selenium@example.com");
  await passwordInput.sendKeys("wrong-password");

  const loginButton = await driver.findElement(By.css("button[type='submit']"));
  await loginButton.click();

  await driver.wait(
    until.elementLocated(By.css(".auth-feedback-error, .auth-feedback-success")),
    10000
  );

  const feedback = await driver
    .findElement(By.css(".auth-feedback-error, .auth-feedback-success"))
    .getText();

  if (!feedback.trim()) {
    throw new Error("Login feedback should be visible after submitting the form.");
  }

  console.log("Selenium smoke test passed.");
} finally {
  if (driver) {
    await driver.quit();
  }
}
