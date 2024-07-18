require("dotenv").config();
const express = require("express");
const nodemailer = require("nodemailer");
const router = express.Router();

const jsonToHtmlTable = (json) => {
  let table = '<table border="1" cellpadding="5" cellspacing="0">';
  for (let key in json) {
    table += '<tr>';
    table += `<th>${key}</th>`;
    if (typeof json[key] === 'object') {
      table += `<td>${jsonToHtmlTable(json[key])}</td>`;
    } else {
      table += `<td>${json[key]}</td>`;
    }
    table += '</tr>';
  }
  table += '</table>';
  return table;
};

router.post("/", (req, res) => {
  const webhookData = req.body;
  console.log("Received webhook:", webhookData);

  let transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: "it@iwschool.co.uk, humgeldi@gmail.com",
    subject: "Enquiry from IWS online school website",
    html: `Enquiry data: ${jsonToHtmlTable(webhookData)}`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log("Error sending email:", error);
      return res.status(500).json({ message: "Error sending email", error });
    }
    console.log("Email sent:", info.response);
    res.status(200).json({ message: "Webhook received and email sent successfully" });
  });
});

module.exports = router;
