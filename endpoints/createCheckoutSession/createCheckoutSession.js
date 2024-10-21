require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require("nodemailer");
const router = express.Router();

router.post("/", async (req, res) => {
  const { data } = req.body;
  console.log(data);

  if (!data || typeof data.totalPrice !== 'number') {
    return res.status(400).send("Invalid data provided.");
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: "Registration Fee",
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

    res.json({ url: session.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;
