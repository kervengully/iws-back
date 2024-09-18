const express = require('express');
const bodyParser = require('body-parser');
const cors = require("cors");

const app = express();
app.use(express.static("public"));
app.use(bodyParser.json());
app.use(cors());

const createCheckoutSession = require('./endpoints/createCheckoutSession/createCheckoutSession');
const createCheckoutSessionMainstream = require('./endpoints/createCheckoutSessionMainstream/createCheckoutSessionMainstream');
const bitewiContact = require('./endpoints/bitewiContact/bitewiContact');
const iwsContact = require('./endpoints/iwsContact/iwsContact');
const evernorthContact = require('./endpoints/evernorthContact/evernorthContact');

const safeEndpoint = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: 'An error occurred' });
  }
};

app.use('/create-checkout-session', safeEndpoint(createCheckoutSession));
app.use('/create-checkout-session-mainstream', safeEndpoint(createCheckoutSessionMainstream));
app.use('/bitewi-contact', safeEndpoint(bitewiContact));
app.use('/iws-contact', safeEndpoint(iwsContact));
app.use('/evernorth-contact', safeEndpoint(evernorthContact));

const PORT = process.env.PORT || 3500;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
