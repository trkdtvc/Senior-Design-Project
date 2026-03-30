const { sendEmail } = require("../services/emailService");

const sendTestEmail = async (req, res, next) => {
  try {
    const { to } = req.body;

    if (!to) {
      return res.status(400).json({ message: "Recipient email is required" });
    }

    await sendEmail({
      to,
      subject: "YFNC Test Email",
      text: "This is a test email from Your Friendly Neighborhood Chatster.",
      html: "<h2>YFNC Test Email</h2><p>This is a test email from Your Friendly Neighborhood Chatster.</p>"
    });

    res.status(200).json({ message: "Test email sent successfully" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendTestEmail
};