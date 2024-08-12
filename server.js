const express = require('express');
const bodyParser = require('body-parser');
const cors = require("cors");

const app = express();
app.use(express.static("public"));
app.use(cors());

// Use the raw body parser for the Stripe webhook route
app.post('/webhook', bodyParser.raw({ type: 'application/json' }));

const createCheckoutSession = require('./endpoints/createCheckoutSession/createCheckoutSession');
const createCheckoutSessionMainstream = require('./endpoints/createCheckoutSessionMainstream/createCheckoutSessionMainstream');
const webhook = require('./endpoints/createCheckoutSessionMainstream/webhook');
const bitewiContact = require('./endpoints/bitewiContact/bitewiContact');
const iwsContact = require('./endpoints/iwsContact/iwsContact');

const safeEndpoint = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: 'An error occurred' });
  }
};

// Use JSON body parser for other routes
app.use('/create-checkout-session', bodyParser.json(), safeEndpoint(createCheckoutSession));
app.use('/create-checkout-session-mainstream', bodyParser.json(), safeEndpoint(createCheckoutSessionMainstream));
app.use('/webhook', webhook); // This route now expects a raw body, so don't use safeEndpoint here
app.use('/bitewi-contact', bodyParser.json(), safeEndpoint(bitewiContact));
app.use('/iws-contact', bodyParser.json(), safeEndpoint(iwsContact));

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
