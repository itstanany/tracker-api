const Router = require('express');
const bodyParser = require('body-parser');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const { AuthenticationError } = require('apollo-server-errors');
const cors = require('cors');




const { JWT_SECRET } = process.env;


if (!JWT_SECRET) {
  /**
   * in case jwt secret string is not supplied as environment variable
   * During development, default it to a string
   * but, in production, DISABLE authentication as we can not generate JWT and thus not set cookies
   */
  if (process.env.mode !== 'production') {
    JWT_SECRET = "TemporaryStringJWT_SECRETForDevOnly";
    console.log('Missing env variable JWT_SECRET. Using unsafe string for DEV only');
  } else {
    console.log('Missing Env Variable, JWT_SECRET. Authorization Disabled');
  }
}


// sub app for authentication
const routes = new Router();

// parse the request body into JSON
// make it available as req.body
routes.use(bodyParser.json());

const origin = process.env.UI_SERVER_ORIGIN || 'http://localhost:8000';
// enable cors requests
routes.use(cors({ origin, credentials: true }));


// retrieve signed in user info
function getUser(req) {
  /**
   * (req) => request object
   * if the request carries a valid jwt cookie, verify it and retrieve its information and return that info
   * otherwise, return an object of a single property, "signedIn" property to false
   */
  const token = req.cookies.jwt;
  if (!token) return { signedIn: false };
  try {
    const credentials = jwt.verify(token, JWT_SECRET);
    return credentials;
  } catch (err) {
    return { signedIn: false };
  }
}

function mustBeSignedIn(resolver) {
  /**
   * Only execute the "resolver" function if user is signed in
   */
  return ((root, args, { user }) => {
    if (!user || !user.signedIn) {
      throw new AuthenticationError('SignedIn Users Only. Authentication Failed.')
    }
    return resolver(root, args, { user })
  })
}


function resolveUser(_, args, { user }) {
  /**
   * GraphQL resolver
   * It returns the "user" context object passed to any graphQL resolver
   * user must contain "signedIn" field
   * and may contain: givenName, name, email
   */
  return user;
}

routes.post('/user', (req, res) => {
  /**
   * and endpoint for retrieval of user information if included as a cookie
   */
  res.send(getUser(req));
})

routes.post('/signin', async (req, res) => {
  /**
   * Verify the google token received from ui
   *
   * return:
   *  if received id is VALID, json object
   *    givenName => name of signin in user
   *    name => full name of signed in user
   *    email => email of signed in user
   *  otherwise:
   *  return 403 response with 'Invalid Credentials' message
   */

  if (!JWT_SECRET) {
    res.status(500).send('Missing JWT_SECRET. Refuse to Authenticate');
  }
  const googleToken = req.body.google_token;
  if (!googleToken) {
    res.status(400).send({ code: 400, message: 'Missing Google Token' });
  }
  const client = new OAuth2Client();
  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken: googleToken });
    // get basic information of signed in user
    payload = ticket.getPayload();
  } catch (err) {
    res.status(403).send('Invalid Credentials');
  }

  const {
    email, name, given_name: givenName,
  } = payload;
  const credentials = {
    givenName, name, email, signedIn: true,
  }
  const token = jwt.sign(credentials, JWT_SECRET);
  res.cookie('jwt', token, { httpOnly: true, domain: process.env.COOKIE_DOMAIN });
  res.json(credentials);
})

routes.post('/signout', (req, res) => {
  /**
   * On sign out, clear user sign in info cookie
   */
  res.clearCookie('jwt', { domain: process.env.COOKIE_DOMAIN });
  res.json({ status: 'ok' });
})


module.exports = {
  routes, getUser, mustBeSignedIn, resolveUser,
};

