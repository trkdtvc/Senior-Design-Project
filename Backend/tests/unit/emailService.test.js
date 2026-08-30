const mockSendMail = jest.fn();

jest.mock("nodemailer", () => ({
  createTransport: jest.fn(() => ({ sendMail: mockSendMail }))
}));

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = global.fetch;

const loadService = () => {
  jest.resetModules();
  return require("../../src/services/emailService");
};

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  global.fetch = ORIGINAL_FETCH;
  mockSendMail.mockReset();
  jest.clearAllMocks();
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
  global.fetch = ORIGINAL_FETCH;
});

describe("email service", () => {
  test("uses SMTP when EMAIL_PROVIDER is smtp", async () => {
    process.env.EMAIL_PROVIDER = "smtp";
    process.env.MAIL_HOST = "smtp.example.com";
    process.env.MAIL_PORT = "587";
    process.env.MAIL_SECURE = "false";
    process.env.MAIL_USER = "sender@example.com";
    process.env.MAIL_PASS = "password";
    process.env.MAIL_FROM = "YFNC <sender@example.com>";
    mockSendMail.mockResolvedValue({ messageId: "smtp-message" });

    const { sendEmail } = loadService();

    await expect(
      sendEmail({
        to: "user@example.com",
        subject: "Test",
        text: "Hello",
        html: "<p>Hello</p>"
      })
    ).resolves.toEqual({ messageId: "smtp-message" });

    expect(mockSendMail).toHaveBeenCalledWith({
      from: "YFNC <sender@example.com>",
      to: "user@example.com",
      subject: "Test",
      text: "Hello",
      html: "<p>Hello</p>"
    });
  });

  test("uses the Resend HTTPS API when EMAIL_PROVIDER is resend", async () => {
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.MAIL_FROM = "YFNC <no-reply@mail.yfnc.dev>";
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue('{"id":"email-id"}')
    });

    const { sendEmail } = loadService();

    await expect(
      sendEmail({
        to: "user@example.com",
        subject: "Verify",
        text: "Verify your account",
        html: "<p>Verify your account</p>"
      })
    ).resolves.toEqual({ id: "email-id" });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer re_test_key",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: "YFNC <no-reply@mail.yfnc.dev>",
          to: ["user@example.com"],
          subject: "Verify",
          text: "Verify your account",
          html: "<p>Verify your account</p>"
        })
      })
    );
  });

  test("throws when Resend returns an error", async () => {
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.MAIL_FROM = "YFNC <no-reply@mail.yfnc.dev>";
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: jest.fn().mockResolvedValue('{"message":"forbidden"}')
    });

    const { sendEmail } = loadService();

    await expect(
      sendEmail({ to: "user@example.com", subject: "Test", text: "Hello" })
    ).rejects.toThrow(/Resend email request failed with status 403/);
  });
});
