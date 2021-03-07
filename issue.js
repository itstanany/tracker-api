const { UserInputError } = require('apollo-server-express');
const { getDB, getNextSequence } = require('./db.js');
const { mustBeSignedIn } = require('./auth.js');

const PAGE_SIZE = 10;

function validate(issue) {
  /**
   * Function to carry out validation for DB requests
   * Check for: title, owner
   * (issue) => an object contains some fields of Issue type in schema
   */
  const errors = [];
  const {
    title, status, owner,
  } = issue;
  // title must be string of more than 2 characters
  if (title == null || title.length < 3) {
    errors.push('Invalid Title. Title Should Be More Than 2 characters');
  }
  // issue with status of type "Assigned" must have an "owner"
  if (status === 'Assigned' && !owner) {
    errors.push('Issue with Assigned State Should have an OWNER');
  }
  // throw an error if there is any validation error
  if (errors.length > 0) {
    throw new UserInputError('Invalid Input for DB', { errors });
  }
}

async function list(_, {
  status,
  effortMin,
  effortMax,
  page
}) {
  /**
   * INPUT - OPTIONAL:
   *  status => one of enum StatusType or undefined
   *  effortMin => Integer or undefined
   *  effortMax => Integer or undefined
   *  page: Int => current render page "pagination"
   * function:
   *  fetching and returning an filtered array of Issues of size "PAGE_SIZE"
   * return value: 
   *  issues => an array of Issues of size "PAGE_SIZE"
   *  pages Int => number of pages of PAGE_SIZE THE total documents can be divided into
   */
  // filter object to filter request to the database
  const filter = {};
  // adding different properties to the filter object
  if (status) filter.status = status;
  if (effortMin !== undefined || effortMax !== undefined) {
    filter.effort = {};
    // we used !== undefined because if the input is 0, it will resolve to false
    // so, we want ot capture integer input including zero
    if (effortMax !== undefined) filter.effort.$lte = effortMax;
    if (effortMin !== undefined) filter.effort.$gte = effortMin;
  }
  const db = getDB();

  let renderPage = page;
  if (!page || page <= 0) {
    // Ensure "renderPage" is non-negative integer
    // otherwise, initialize it with 1
    renderPage = 1;
  }
  const cursor = await db.collection('issues')
    .find(filter)
    .sort({ id: 1 })
    .skip(PAGE_SIZE * (renderPage - 1))
    .limit(PAGE_SIZE);
  const count = await cursor.count(false);
  const numberOfPages = Math.ceil(count / PAGE_SIZE);
  const issues = cursor.toArray();
  return ({
    issues,
    pages: numberOfPages,
  });
}

async function update(_, { id, changes }) {
  /**
   * Update the selected fields in "changes" in the document with the specified "id".
   * Return the issue with the specified "id"
   *    to ensure the updates has been written successfully in database.
   * "id" => integer
   * "changes" => object of ONE OR MORE of fields to be updated (status, owner, due, effort, title, description)
   */
  const db = getDB();
  if (changes.status || changes.owner || changes.title) {
    // we used this technique of validation not validate the coming "changes" object
    // because we don't have a precondition that ALL CHANGEABLE FIELDS ARE SUPPLIED IN "CHANGES" OBJECT
    // only validate updated to issue fields "title, status, or owner"
    const issue = await db.collection('issues').findOne({ id });
    // copies all properties from "changes" object into "issue" object
    Object.assign(issue, changes);
    validate(issue);
  }
  // USE THIS VALIDATION METHOD ONLY IF YOU WANT HAVE A PRECONDITION THAT
  // THE "CHANGES" OBJECT CONTAINS ALL PROPERTIES THAT CAN BE CHANGED
  // validate(changes);
  // updateOne returns a promise if no callback is supplied
  const updateReturn = await db.collection('issues').updateOne({ id }, { $set: changes });
  // ensure that there is document with he specified "id" has been found
  // we can't use property "updatedCount"
  // ... because if the changes are identical to the document,
  // ... no changes happens and this property has value 0
  if (updateReturn.matchedCount === 1) {
    return db.collection('issues').findOne({ id });
  }
  // if there is no document found with the "id" throw Error.
  throw new UserInputError(`[update function]. Failed Update Issue, Update Return Object is ${updateReturn}`);
}

async function get(_, { id }) {
  /**
   * Return an document with the specified id
   */
  const db = getDB();
  // .findOne() returns a promise if no callback is provided
  const issue = await db.collection('issues').findOne({ id });
  return issue;
}

async function add(_, { issue }) {
  /**
   * Add New Issue procedure
   * It adds the "issue" to DB only if it is valid
   * Fill fields with some default values if fields have no value
   * Returns the newly created issue retrieved from DB
   */
  const db = getDB();
  // validate the "issue"
  validate(issue);
  // it is recommended not to manipulate supplied arguments
  const newIssue = Object.assign({}, issue);
  // assign the new issue an unique "id" if not assigned
  if (getNextSequence) {
    if (!newIssue.id) newIssue.id = await getNextSequence('issues');
  } else {
    throw new Error('Cannot find getNextSequence function');
  }
  // assign to the new issue 
  //  "creation data(current data), due date(10 days after creation), effort(10) and description"
  //    if not assigned to it
  if (!newIssue.created) newIssue.created = new Date();
  if (!newIssue.due) (
    newIssue.due = new Date(newIssue.created.getTime() + (10 * 24 * 60 * 60 * 1000))
  );
  if (!newIssue.effort) newIssue.effort = 10;
  if (!newIssue.description) newIssue.description = 'This Issue Is add with NO description';
  // add the new issue to db
  const result = await db.collection("issues").insertOne(newIssue);
  // get and return the newly created issue using ..._id
  // otherwise throw an error with that prints the returned object
  if (result.insertedId) {
    const insertedIssue = await db.collection('issues').findOne({ _id: result.insertedId });
    return insertedIssue;
  }
  throw new Error(`Failed to add New Issue and returned object is ${result}`);
}

// "delete" is a reserved keyword, so can't use it as a variable name
async function remove(_, { id }) {
  /**
   * Delete an issue == moving it from its collection "issues" to "deletedIssues" collection
   * return => Boolean to indicate success
   * steps:
   *  retrieve the issue with the "id"
   *  assign date of deletion in "deleted" property
   *  insert the retrieved issue in the "deletedIssues" collection
   *  on success of inserting, delete the issue from "issues" collection
   */

  const db = getDB();
  const queryObject = { id };
  // const issue = await db.collection('issues').findOne({ id });
  const issue = await db.collection('issues').findOne(queryObject);
  if (issue.id === id) {
    issue.deleted = new Date();
    const deletionObject = await db.collection("deletedIssues").insertOne(issue);
    if (issue._id === deletionObject.insertedId) {
      await db.collection('counters')
        .updateOne({ _id: 'deletedIssues' }, { $inc: { counter: 1 } }, { upsert: true });
      const result = await db.collection('issues').deleteOne({ id });
      return (result.deletedCount === 1)
    }
  }
  return false;
}

async function counts(_, { status, effortMin, effortMax }) {
  /**
   * INPUT:
   *  status => StatusType "schema types" -- Filter property
   *  effortMin => Int -- Filter property -- the minimum value of "effort" property
   *  effortMax => Int -- Filter property -- the maximum value of "effort" property
   * OUTPUT:
   *  An array of objects
   *    each object contains properties:
   *    "owner" name of the issues owner
   *    ... status:its number
   * Perform an aggregation operation
   * group the filtered documents into unique documents by the combination of "owner" and "status"
   * each output document contains the "unique _id object" and "count" field
   * "count" fields is the number of "status" in the _id object that is associated with the "owner" in the _id object
   */
  const db = getDB();
  const filter = {};
  if (status) filter.status = status;
  if (effortMin !== undefined || effortMax !== undefined) {
    filter.effort = {};
    if (effortMin !== undefined) filter.effort.$gte = parseInt(effortMin, 10);
    if (effortMax !== undefined) filter.effort.$lte = parseInt(effortMax, 10);
  };

  const result = await db.collection('issues').aggregate(
    [
      { $match: filter },
      {
        $group: {
          _id: { owner: '$owner', status: '$status' },
          count: { $sum: 1 }
        }
      }
    ]
  ).toArray();

  if (result) {
    const statistics = {};
    result.forEach(element => {
      const {
        _id: { owner, status }, count,
      } = element;
      if (!statistics[owner]) statistics[owner] = { owner };
      statistics[owner][status] = count;
    });
    return Object.values(statistics);
  }
}

async function restore(_, { id }) {
  /**
   * (id) :Int => the id of required document to restore
   * Restore a deleted issue
   * Procedure:
   *  transfer the document from "deletedIssues" collection to "issues" collection
   */
  const db = getDB();
  let result = await db.collection('deletedIssues').findOne({ id });
  if (result) {
    result.restored = new Date();
    result = await db.collection('issues').insertOne(result);
    if (result) {
      await db.collection('deletedIssues').deleteOne({ id });
      result = await db.collection('issues').findOne({ _id: result.insertedId });
      return result;
    }
  }
}

async function issueSearch(_, { search }) {
  /**
   * (search): String! => user input search string
   * match it against an index of "title" and "description" fields
   * returns an array of found documents
   */
  const db = getDB();
  const result = await db.collection('issues').find({
    $text: { $search: search }
  }).toArray();
  return result;
}

module.exports = {
  // mutation handler need signing in authorization
  list,
  update: mustBeSignedIn(update),
  get,
  add: mustBeSignedIn(add),
  // "delete" is a reserved keyword, so can't use it as a variable name
  delete: mustBeSignedIn(remove),
  counts,
  restore: mustBeSignedIn(restore),
  issueSearch,
}
