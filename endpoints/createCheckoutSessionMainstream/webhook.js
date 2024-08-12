require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require("nodemailer");

const router = express.Router();

router.post('/', async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      console.log("Checkout session completed for session:", session);
      // Additional logic here if needed
      break;

    case 'invoice.payment_succeeded':
      const invoice = event.data.object;
      console.log("Invoice payment succeeded:", invoice);
      const invoicePdfUrl = invoice.invoice_pdf;

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
        to: invoice.customer_email,
        subject: "Your Invoice PDF",
        html: `<p>Your payment was successful. You can download your invoice as a PDF <a href="${invoicePdfUrl}">here</a>.</p>`,
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error("Error sending email:", error);
        } else {
          console.log("Invoice PDF email sent:", info.response);
        }
      });
      break;

    default:
      console.warn(`Unhandled event type ${event.type}`);
  }

  // Acknowledge the event was received
  res.json({ received: true });
});

module.exports = router;
