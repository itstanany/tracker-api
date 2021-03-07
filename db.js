const { MongoClient } = require("mongodb");

let db;
async function connectToDB() {
  /**
   * function that establishes a connection pool with the database server
   * it assign the established connection pool to the variable "db"
   */
  const DB_URL = process.env.DB_URL || 'mongodb://127.0.0.1:27017/issuetracker';
  const client = new MongoClient(DB_URL, { useUnifiedTopology: true });
  // create connection pool, default max 5 connections in pool
  // for performance reasons, we establish one connection pool per client
  // increase max value of connections in a pool increases performance of single client
  // but remember, the number of connections to "mongo server"
  // high number of connections by pool ma cause mongo server to crash due to excessive requests
  await client.connect();
  // we already specified the name of DB in he URL, so use it by default for all queries
  db = client.db();
  console.log("Connected Successfully to MongoDB at URL:", DB_URL);
}

function getDB() {
  // pass reference of db to caller
  return db;
}

async function getNextSequence(id) {
  /**
   * (id) => document (_id) 
   * Generate unique consecutive integer "id" for each call
   */
  let result = await db.collection('counters').updateOne({ _id: id }, { $inc: { counter: 1 } });
  if (result.modifiedCount === 1) {
    result = await db.collection('counters').findOne({ _id: id });
    return result.counter;
  }
}
module.exports = {
  connectToDB,
  getDB,
  getNextSequence,
}
