require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require("nodemailer");
const jsforce = require('jsforce');
const bodyParser = require('body-parser');
const router = express.Router();

const conn = new jsforce.Connection({
  oauth2: {
    clientId: process.env.SALESFORCE_CLIENT_ID,
    clientSecret: process.env.SALESFORCE_CLIENT_SECRET,
  }
});

const loginToSalesforce = async () => {
  try {
    await conn.login(process.env.SALESFORCE_USERNAME, process.env.SALESFORCE_PASSWORD);
    console.log("Salesforce login successful");
  } catch (err) {
    console.error("Salesforce login error:", err);
    throw new Error("Failed to authenticate with Salesforce");
  }
};

// Salesforce Account and Contact creation inside the POST request
router.post("/", async (req, res) => {
  const { data } = req.body;
  data.totalPrice = parseFloat(data.totalPrice);
  console.log(data);

  if (!data || typeof data.totalPrice !== 'number') {
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

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: "it@iwschool.co.uk",
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

    await loginToSalesforce();

    // Create Account in Salesforce
    const accountData = {
      Name: `${data.parent.firstName} ${data.parent.lastName}`, // Name the account appropriately
      Phone: data.parent.parentPhoneNumber,
      BillingStreet: data.parent.address,
      BillingCity: data.parent.city,
      // BillingState: data.parent.address.state,
      BillingPostalCode: data.parent.postal,
      BillingCountry: data.parent.country,
      // Type: "Customer", // or another type if necessary
      Parent_Email__c: data.parent.email,
      Gender__c: data.parent.gender,
    };

    const accountResult = await conn.sobject("Account").create(accountData);
    if (!accountResult.success) {
      console.error("Salesforce Account creation error:", accountResult.errors);
      return res.status(500).send("Salesforce Account creation error");
    }
    console.log("Account created with ID:", accountResult.id);

    // Create Contact in Salesforce
    const contactData = {
      FirstName: data.student.firstName,
      LastName: data.student.lastName,
      Email: data.student.email,
      Phone: data.student.studentPhoneNumber,
      AccountId: accountResult.id, // Link contact to the created account
      MailingStreet: data.student.address,
      MailingCity: data.student.city,
      // MailingState: data.student.address.state,
      MailingPostalCode: data.student.postal,
      MailingCountry: data.student.country,
    };

    const contactResult = await conn.sobject("Contact").create(contactData);
    if (!contactResult.success) {
      console.error("Salesforce Contact creation error:", contactResult.errors);
      return res.status(500).send("Salesforce Contact creation error");
    }
    console.log("Contact created with ID:", contactResult.id);

    // Create Opportunity in Salesforce
    const opportunityData = {
      Name: `${data.parent.firstName} + ${data.student.firstName}`,
      StageName: 'Registration Completed',
      CloseDate: new Date().toISOString().split('T')[0],
      Amount: data.totalPrice,
      Description: JSON.stringify(data),
      RecordTypeId: "012Pz000000joDZIAY",
      Registration_Fee__c: "200",
      YearGroup__c: data.selectedPackage,
      Please_list_the_subject_s_you_would_lik__c: data.selectedSubjects.map(subject => subject.name).join(', '),
      AccountId: accountResult.id, // Link opportunity to the created account
      Student_Name__c: contactResult.id
    };

    conn.sobject("Opportunity").create(opportunityData, function(err, result) {
      if (err || !result.success) {
        console.error("Salesforce Opportunity creation error:", err);
        return res.status(500).send("Salesforce Opportunity creation error");
      }
      console.log("Opportunity created with ID:", result.id);
    });

    // Respond with Stripe session URL
    res.json({ url: session.url });
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;

