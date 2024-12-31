require("dotenv").config();
const express = require("express");
const nodemailer = require("nodemailer");
const jsforce = require("jsforce");
const fetch = require("node-fetch"); // If fetch is not available
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

const verifyRecaptcha = async (token) => {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  const response = await fetch(
    `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`,
    { method: "POST" }
  );
  const data = await response.json();
  return data.success;
};

const conn = new jsforce.Connection({
  oauth2: {
    clientId: process.env.SALESFORCE_CLIENT_ID,
    clientSecret: process.env.SALESFORCE_CLIENT_SECRET,
  },
});

const loginToSalesforce = async () => {
  try {
    await conn.login(
      process.env.SALESFORCE_USERNAME,
      process.env.SALESFORCE_PASSWORD
    );
    console.log("Salesforce login successful");
  } catch (err) {
    console.error("Salesforce login error:", err);
    throw new Error("Failed to authenticate with Salesforce");
  }
};

const createSalesforceLead = async (webhookData) => {
  try {
    const result = await conn.sobject("Lead").create({
      FirstName: webhookData.parentFirstName,
      LastName: webhookData.parentLastName,
      Email: webhookData.parentEmail,
      Phone: webhookData.parentPhoneNumber,
      Company: webhookData.keystage,
      Description: `${webhookData.message}\nStudent First Name: ${webhookData.studentFirstName}\nStudent Last Name: ${webhookData.studentLastName}\nStudent BirthDate: ${webhookData.studentDOB}\nPage Source: ${webhookData.fullUrl}/nInitial Source: ${webhookData.initialUrl}`,
      Country__c: webhookData.country,
    });
    if (!result.success) {
      throw new Error("Failed to create Lead in Salesforce");
    }
    console.log("Lead created successfully in Salesforce");
    return result;
  } catch (err) {
    console.error("Error creating Lead in Salesforce:", err);
    throw err;
  }
};

const sendEmailNotification = async (webhookData) => {
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    let recipients =
      "it@iwschool.co.uk, admissions@iwschool.co.uk, cigdem.karaman@iwschool.co.uk";

    if (webhookData.initialUrl.includes("partners/cs")) {
      recipients += ", farhaan@iwschool.co.uk";
    } else if (webhookData.initialUrl.includes("partners/omb")) {
      recipients += ", umar@iwschool.co.uk, aisha@iwschool.co.uk, iwsnigeria@iwschool.co.uk";
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: recipients,
      subject: "Enquiry from IWS online school website",
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
    const recaptchaToken = webhookData.recaptchaToken;

    // Verify reCAPTCHA
    const isRecaptchaValid = await verifyRecaptcha(recaptchaToken);
    if (!isRecaptchaValid) {
      return res.status(400).json({ message: "Invalid reCAPTCHA token" });
    }

    // Validate required fields
    if (!webhookData.parentFirstName || !webhookData.parentEmail) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    // Send an email notification
    await sendEmailNotification(webhookData);

    // Login to Salesforce
    await loginToSalesforce();

    // Create a Lead in Salesforce
    await createSalesforceLead(webhookData);

    res.status(200).json({
      message: "Webhook received, Lead created in Salesforce, and email sent successfully",
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
