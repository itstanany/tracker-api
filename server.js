require('dotenv').config({ path: './sample.env' });
const express = require('express');
const installHandler = require('./api_handler.js');
const { connectToDB } = require('./db.js');
const auth = require('./auth.js');
const cookieParser = require('cookie-parser');

const PORT = process.env.PORT || 3000;

const app = express();

// parse cookies on all requests
// populate req.cookies with keyed cookies name and value
app.use(cookieParser());

// mounting the authentication sub app to "/auth" root
app.use('/auth', auth.routes);

// attach Apollo GraphQL server as middleware to the express server (app)
installHandler(app);

// connect to the DB then start listening on PORT
(async function () {
  try {
    await connectToDB();
    app.listen(PORT, () => {
      console.log(`API Server Started Listening on PORT ${PORT}`);
    });
  } catch (e) {
    console.log(`Error during server starting. the Error is: ${e}`);
  }
})()
