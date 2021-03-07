const fs = require('fs');
const { ApolloServer } = require('apollo-server-express');
const GraphQLDate = require('./GraphQLDate');
const issue = require('./issue.js');
const auth = require('./auth.js');


const resolvers = {
  Query: {
    issueList: issue.list,
    issueGet: issue.get,
    counts: issue.counts,
    issueSearch: issue.issueSearch,
    user: auth.resolveUser,
  },
  Mutation: {
    issueUpdate: issue.update,
    issueAdd: issue.add,
    issueDelete: issue.delete,
    issueRestore: issue.restore,
  },
  // Date custom Scalar type
  GraphQLDate,
}

function getContext({ req }) {
  /**
   * Generate a context object passed to each Apollo resolver as the third argument
   * the context object is an object of property "user"
   * "user" => an object contains user sing in information
   *    either "signedIn" false or "signedIn" true and givenName of the signed in user
   * 
   * we defined it here because it is related to Apollo Server
   */
  const user = auth.getUser(req);
  return { user };
}

const server = new ApolloServer({
  typeDefs: fs.readFileSync('./schema.graphql', 'utf-8'),
  resolvers,
  // context must be an object or function that returns an object
  context: getContext,
})

function installHandler(app) {
  /**
   * connect the endpoint /graphql to be the root of apollo server
   * insert the middleware in the application server Express
   */
  const enableCORS = process.env.ENABLE_CORS;
  console.log('CORS Setting:', enableCORS);
  let cors;
  if (enableCORS) {
    const methods = 'POST';
    const origin = process.env.UI_SERVER_ORIGIN || 'http://localhost:8000';
    cors = { methods, origin, credentials: true }
  } else {
    cors = 'false';
  }
  server.applyMiddleware({
    app, path: '/graphql', cors,
  });
}

module.exports = installHandler;