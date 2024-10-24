// trackingButton.js

const fs = require('fs').promises;
const path = require('path');
const lockFile = require('proper-lockfile');

// Path to the counter file
const COUNTER_FILE = path.join(__dirname, 'counter.txt');

// URL to redirect users after tracking
const REDIRECT_URL = 'https://lu.ma/ymb6rtsu'; // Replace with your actual URL

// Function to handle tracking and redirection
const trackClick = async (req, res, next) => {
  try {
    console.log(`Received request at /track-click from IP: ${req.ip} at ${new Date().toISOString()}`);

    // Check for pre-fetch or pre-render headers
    const userAgent = req.headers['user-agent'] || '';
    const purpose = req.headers['purpose'] || '';
    const xPurpose = req.headers['x-purpose'] || '';
    const prefetch = req.headers['x-moz'] || '';
    const accept = req.headers['accept'] || '';

    if (
      purpose === 'prefetch' ||
      xPurpose === 'prefetch' ||
      prefetch === 'prefetch' ||
      accept === 'text/html+preview' ||
      userAgent.includes('GoogleImageProxy') ||
      userAgent.includes('Googlebot') ||
      userAgent.includes('FeedFetcher')
    ) {
      console.log('Prefetch or bot detected. Ignoring request.');
      res.status(204).end(); // No Content
      return;
    }

    // Acquire a lock on the counter file
    const release = await lockFile.lock(COUNTER_FILE);

    // Read the current count
    let count = 0;
    try {
      const data = await fs.readFile(COUNTER_FILE, 'utf8');
      count = parseInt(data, 10);

      // Handle NaN case
      if (isNaN(count)) {
        console.error('Invalid number in counter.txt during tracking. Resetting count to zero.');
        count = 0;
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Error reading counter.txt:', error);
        throw error;
      }
      console.warn('counter.txt does not exist during tracking. Starting count from zero.');
    }

    // Increment the count
    count += 1;
    console.log(`Incremented count to ${count}`);

    // Write the new count back to the file
    await fs.writeFile(COUNTER_FILE, count.toString(), 'utf8');

    // Release the lock
    await release();

    // Redirect the user
    res.redirect(REDIRECT_URL);
    console.log(`Redirected user to ${REDIRECT_URL}`);
  } catch (error) {
    console.error('Error in trackClick:', error);
    res.status(500).send({ error: 'An error occurred while tracking the click' });
  }
};



// Function to get the current click count
const getClickCount = async (req, res, next) => {
  try {
    let count = 0;
    try {
      const data = await fs.readFile(COUNTER_FILE, 'utf8');
      count = parseInt(data, 10);

      // Handle NaN case
      if (isNaN(count)) {
        console.error('Invalid number in counter.txt. Resetting count to zero.');
        count = 0;
        // Optionally, overwrite the file with zero
        await fs.writeFile(COUNTER_FILE, '0', 'utf8');
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Error reading counter.txt:', error);
        throw error;
      }
      // If the file doesn't exist, count remains zero
      console.warn('counter.txt does not exist. Initializing count to zero.');
    }
    res.send({ clickCount: count });
  } catch (error) {
    console.error('Error in getClickCount:', error);
    res.status(500).send({ error: 'An error occurred while retrieving the click count' });
  }
};


// Export the functions
module.exports = {
  trackClick,
  getClickCount,
};
