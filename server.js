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

app.use('/create-checkout-session', createCheckoutSession);
app.use('/create-checkout-session-mainstream', createCheckoutSessionMainstream);
app.use('/bitewi-contact', bitewiContact);

const PORT = process.env.PORT || 3500;
app.listen(PORT, () => {
  console.log(`Server is running on porrt ${PORT}`);
});