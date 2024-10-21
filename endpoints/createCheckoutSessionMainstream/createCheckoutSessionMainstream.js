require("dotenv").config();
const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const nodemailer = require("nodemailer");
const jsforce = require("jsforce");
const bodyParser = require("body-parser");
const router = express.Router();

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

router.post("/", async (req, res) => {
  // Log request origin and headers
  console.log("Request received from:", req.headers['origin']);
  console.log("Request headers:", req.headers);

  const { data } = req.body;
  data.totalPrice = parseFloat(data.totalPrice);

  if (!data || typeof data.totalPrice !== "number") {
    return res.status(400).send("Invalid data provided.");
  }

  try {
    // Stripe payment session creation
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: "Total Payment",
            },
            unit_amount: data.totalPrice * 100,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      customer_email: data.parent.email,
      success_url: "https://iwsonlineschool.co.uk/thank-you",
      cancel_url: `https://iwsonlineschool.co.uk/`,
      allow_promotion_codes: true,
      invoice_creation: {
        enabled: true,
      },
    });

    // Email sending logic with nodemailer
    let transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

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

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: "it@iwschool.co.uk, cigdem.karaman@iwschool.co.uk, ozlem.ulusoy@iwschool.co.uk, admissions@iwschool.co.uk",
      subject: "New Registration Form Submission",
      html: `<p>New registration form submitted:</p>${jsonToHtmlTable(data)}`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending email:", error);
      } else {
        console.log("Email sent:", info.response);
      }
    });

    try {
      await loginToSalesforce();

      // Create Lead in Salesforce
      const leadData = {
        FirstName: data.parent.firstName,
        LastName: data.parent.lastName,
        Parent_First_Name__c: data.parent.firstName,
        Parent_Last_Name__c: data.parent.lastName,
        Email: data.parent.email,
        Phone: data.parent.parentPhoneNumber,
        Parent_Address__c: data.parent.address,
        City__c: data.parent.city,
        Postal_Code__c: data.parent.postal,
        Countryy__c: data.parent.country,
        Parent_Email__c: data.parent.email,
        Gender__c: data.parent.gender,
        Company: data.selectedPackage,
        // Description: JSON.stringify(data),
        Form_Source__c: "IWS Application Form",
        Student_First_Name__c: data.student.firstName,
        Student_Last_Name__c: data.student.lastName,
        Student_Email__c: data.student.email,
        Student_Mobile_No__c: data.student.studentPhoneNumber,
        Student_Address__c: data.student.address,
        Student_Postal_Code__c: data.student.postal,
        Student_Country__c: data.student.country,
        Student_City__c: data.student.city,
        Year_Group__c: data.selectedPackage,
        Subjects__c: data.selectedSubjects.map((subject) => subject.name).join(", "),
        Desired_Date__c: data.date.day + "/" + data.date.month + "/" + data.year,
        Parent_Guardian__c: data.parent.chooseParent,
        // Registration_Fee__c: "200",
        // Amount__c: data.totalPrice,
      };

      const leadResult = await conn.sobject("Lead").create(leadData);
      if (!leadResult.success) {
        console.error("Salesforce Lead creation error:", leadResult.errors);
      } else {
        console.log("Lead created with ID:", leadResult.id);
      }
    } catch (sfError) {
      console.error("Error sending data to Salesforce:", sfError);
    }

    // Respond with Stripe session URL
    res.json({ url: session.url });
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;