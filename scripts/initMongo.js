const NUMBER_OF_DOCUMENTS = 115;

db.issues.remove({});
db.counters.remove({ _id: 'issues' });

const owners = [
  'Ali', 'Hanan', 'Sara', 'Ibrahem', 'Ahmed', 'Mohamed'
];

const titles = [
  "TITLE 1 TITLE 1 TITLE 1",
  'TITLE2 TITLE 2 TITLE 2',
  'TITLE3 TITLE 3',
  'TITLE 4 TITLE 4 TITLE 4',
  'TITLE 5 TITLE 5 TITLE 5',
  'TITLE 6 TITLE 6 TITLE 6',
];

const efforts = [
  1, 2, 3, 4, 5, 6
];
const statuses = [
  'Closed',
  'Fixed',
  'Assigned',
  'New',
  'Closed',
  'Fixed',
];

function description(num) {
  return (`Description for Issue with Random Number ${num}`);
}

const ownersLength = owners.length;
for (let i = 1; i <= NUMBER_OF_DOCUMENTS; i += 1) {
  const randomNum = Math.floor(Math.random() * (ownersLength - 1));
  const issue = {};
  issue.id = i
  issue.owner = owners[randomNum];
  issue.status = statuses[Math.floor(Math.random() * (ownersLength - 1))];
  issue.created = new Date();
  issue.due = new Date((new Date().getTime()) + (10 * 24 * 60 * 60 * 1000));
  issue.title = titles[randomNum];
  issue.description = description(randomNum);
  issue.effort = i;
  db.issues.insertOne(issue);
}

const count = db.issues.count();
print(`Number of inserted issues is ${count}`);
db.counters.insertOne({ _id: 'issues', counter: count });
print('The initial value of counter of _id=issues is', db.counters.findOne({ _id: 'issues' }, { counter: 1 }).counter);
db.issues.createIndex({ id: 1 }, { unique: true });
db.issues.createIndex({ title: 'text', description: 'text' });