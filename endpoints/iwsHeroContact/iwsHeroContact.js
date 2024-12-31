require("dotenv").config();
const express = require("express");
const nodemailer = require("nodemailer");
const jsforce = require("jsforce");
const https = require("https");
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

// Salesforce connection setup
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
      LastName: webhookData.FullName,
      Email: webhookData.Email,
      Phone: webhookData.contactPhoneNumber,
      Company: "IWS Short Contact", // Salesforce requires a Company name for Lead
      Description: `Page Source: ${webhookData.fullUrl}\nInitial Source: ${webhookData.initialUrl}`,
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
    let transporter = nodemailer.createTransport({
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

const verifyRecaptcha = (token) => {
  return new Promise((resolve, reject) => {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    const url = `/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`;

    const options = {
      hostname: "www.google.com",
      path: url,
      method: "POST",
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const parsedData = JSON.parse(data);
          resolve(parsedData.success);
        } catch (err) {
          reject(new Error("Failed to parse reCAPTCHA response"));
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.end();
  });
};

router.post("/", async (req, res) => {
  const webhookData = req.body;
  const recaptchaToken = webhookData.recaptchaToken;

  console.log("Received webhook data:", webhookData);

  try {
    // Verify reCAPTCHA
    const isRecaptchaValid = await verifyRecaptcha(recaptchaToken);
    if (!isRecaptchaValid) {
      return res.status(400).json({ message: "Invalid reCAPTCHA token" });
    }

    // Send an email notification
    await sendEmailNotification(webhookData);

    // Login to Salesforce
    await loginToSalesforce();

    // Create a Lead in Salesforce
    await createSalesforceLead(webhookData);

    // Send a successful response back to the client
    res.status(200).json({
      message:
        "Webhook received, Lead created in Salesforce, and email sent successfully",
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
