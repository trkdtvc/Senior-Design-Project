const nodemailer = require("nodemailer");

const DEFAULT_RESEND_API_URL = "https://api.resend.com/emails";

const getPositiveNumber = (value, fallback) => {
  const parsedValue = Number.parseInt(value, 10);

  return Number.isFinite(parsedValue) && parsedValue > 0
    ? parsedValue
    : fallback;
};

const getEmailProvider = () =>
  String(process.env.EMAIL_PROVIDER || "smtp").trim().toLowerCase();

let smtpTransporter;

const getSmtpTransporter = () => {
  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: Number(process.env.MAIL_PORT),
      secure: process.env.MAIL_SECURE === "true",
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
      },
      connectionTimeout: getPositiveNumber(
        process.env.MAIL_CONNECTION_TIMEOUT_MS,
        15000
      ),
      greetingTimeout: getPositiveNumber(
        process.env.MAIL_GREETING_TIMEOUT_MS,
        10000
      ),
      socketTimeout: getPositiveNumber(process.env.MAIL_SOCKET_TIMEOUT_MS, 30000),
      disableFileAccess: true,
      disableUrlAccess: true
    });
  }

  return smtpTransporter;
};

const sendWithSmtp = ({ to, subject, text, html }) =>
  getSmtpTransporter().sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject,
    text,
    html
  });

const sendWithResend = async ({ to, subject, text, html }) => {
  const response = await fetch(
    process.env.RESEND_API_URL || DEFAULT_RESEND_API_URL,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM,
        to: Array.isArray(to) ? to : [to],
        subject,
        text,
        html
      }),
      signal: AbortSignal.timeout(
        getPositiveNumber(process.env.EMAIL_API_TIMEOUT_MS, 15000)
      )
    }
  );

  const responseBody = await response.text();

  if (!response.ok) {
    throw new Error(
      `Resend email request failed with status ${response.status}: ${responseBody}`
    );
  }

  return responseBody ? JSON.parse(responseBody) : {};
};

const sendEmail = async (email) => {
  const provider = getEmailProvider();

  if (provider === "resend") {
    return sendWithResend(email);
  }

  if (provider === "smtp") {
    return sendWithSmtp(email);
  }

  throw new Error(`Unsupported email provider: ${provider}`);
};

module.exports = {
  sendEmail
};
