require("dotenv").config();
const express = require("express");
const nodemailer = require("nodemailer");
const router = express.Router();

const jsonToHtmlTable = (json) => {
  let table = '<table border="1" cellpadding="5" cellspacing="0">';
  for (let key in json) {
    table += "<tr>";
    table += `<th>${key}</th>`;
    if (typeof json[key] === "object") {
      table += `<td>${jsonToHtmlTable(json[key])}</td>`;
    } else {
      table += `<td>${json[key]}</td>`;
    }
    table += "</tr>";
  }
  table += "</table>";
  return table;
};


const sendEmailNotification = async (webhookData) => {
  try {
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
      to: "it@iwschool.co.uk, gokay.burak@evernorthedu.com, cigdem.karaman@evernorthedu.com",
    //   to: "it@iwschool.co.uk, admissions@iwschool.co.uk, cigdem.karaman@iwschool.co.uk",
      subject: "Enquiry from EverNorth website",
      html: `Enquiry data: ${jsonToHtmlTable(webhookData)}`,
    };

    await transporter.sendMail(mailOptions);
    console.log("Email sent successfully");
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};

router.post("/", async (req, res) => {
  const webhookData = req.body;
  console.log("Received webhook data:", webhookData);

  try {
    // Send an email notification
    await sendEmailNotification(webhookData);

    // Send a successful response back to the client
    res.status(200).json({
      message:
        "Webhook received and email sent successfully",
    });
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.status(500).json({
      message: "An error occurred while processing the webhook",
      error: error.message,
    });
  }
});

module.exports = router;
