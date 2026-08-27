const nodemailer = require("nodemailer");

const getPositiveNumber = (value, fallback) => {
  const parsedValue = Number.parseInt(value, 10);

  return Number.isFinite(parsedValue) && parsedValue > 0
    ? parsedValue
    : fallback;
};

const transporter = nodemailer.createTransport({
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
  socketTimeout: getPositiveNumber(process.env.MAIL_SOCKET_TIMEOUT_MS, 30000)
});

const sendEmail = async ({ to, subject, text, html }) => {
  const mailOptions = {
    from: process.env.MAIL_FROM,
    to,
    subject,
    text,
    html
  };

  return transporter.sendMail(mailOptions);
};

module.exports = {
  sendEmail
};
