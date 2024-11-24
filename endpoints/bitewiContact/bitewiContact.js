const express = require('express');
const nodemailer = require("nodemailer");
const router = express.Router();

router.post('/', (req, res) => {
  const webhookData = req.body;
  console.log('Received webhook:', webhookData);

  let transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: "iws@iwschool.co.uk",
      pass: "cbrfcouineuuwyhm",
    },
  });

  const mailOptions = {
    from: 'gullyyevv@gmail.com',
    to: 'gullyyevv@gmail.com, dev.gullyyew@gmail.com',
    subject: 'Webhook Notification',
    text: `Received webhook data: ${JSON.stringify(webhookData, null, 2)}`
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log('Error sending email:', error);
      return res.status(500).json({ message: 'Error sending email', error });
    }
    console.log('Email sent:', info.response);
    res.status(200).json({ message: 'Webhook received and email sent successfully' });
  });
});

module.exports = router;
