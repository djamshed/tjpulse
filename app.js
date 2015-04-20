// a simple facebook group feed aggregator (can read from multiple groups)
// Reads the latest feed from a facebook group (thru FB Graph API), persists it to mongodb

var feed2db       = require('./fbfeed2db'),        // reads and persists latest feed
    credentials   = require('./credentials'),      // this app is using FB App Access token, stored in this module
    mongojs       = require('mongojs'),
    fs            = require('fs'),
    Promise       = require('es6-promise').Promise,
    http          = require('http'),
    staticServer  = require('node-static'),
    moment        = require('moment')
;


// ----------------- Declarations
// public FB groups
var fbGroups = [
  // TODO: this is an example, add any facebook group ID + Name to this list to be pulled
  {id:'355096164617904', name: 'Я - Душанбинец!'}
];


// number of posts to display (persist in feeds.json)
var NUM_DISPLAYED = 200;

// delay between feed pulls
var TIMEOUT = 10 /* minutes */ * 60000 /* ms in a minute */;

// feeds json
var FEEDS_JSON = 'public/data/feeds.json';

// mongodb connection string, defaults to localhost:
var connection_string = '127.0.0.1:27017/tjpulse';

// not too important job counter
var jobNum = 0;



// ----------------- Functions
// ultra simple logger
function log(message) {
  console.log(new Date() + '\tJob num: ' + jobNum + '\t---' + message +'---');
}

// returns an array of feed promises (feed2db() is returning a Promise)
// TODO: this will run all feed2db functions in parallel
// make sure FB API is OK with multiple simultaneous calls
function getFeedPromises () {
  return fbGroups.map(function(group) {
    return feed2db.feed2db(group.id, group.name);
  });
}

// saves feeds to a file system (feeds.json) and restarts
function saveToJson (db) {
  // pull the last NUM_DISPLAYED items sorted by updated_time and save it to JSON
  db.fb
    .find({ $or: [{story: {$exists: true}},
                  {message: {$exists: true}}] },
          {_id: 0, id: 1, groupName: 1, likes: 1, groupID: 1, comments: 1, description: 1, updated_time: 1})
    .sort({"updated_time": -1})
    .skip(0)
    .limit(NUM_DISPLAYED)
    .toArray(function dbToJson(err, items) {
      if(err) {
        log('error when fetching data from db: ' + err.message);
        db.close();
      }
      else {
        // update `timeAgo` field
        items.forEach(function(item){
          item.timeAgo = moment(item.updated_time).fromNow();
        });
        // write items to JSON
        fs.writeFile(FEEDS_JSON, 'var feeds = ' + JSON.stringify(items), function (err) {
          if(err) {
            log('error when saving to feeds.json' + err.message);
          }
          log('job finished OK');
          db.close();
        });
      }
    });
}

// fetches and persists FB group feeds
function getFeeds() {
  jobNum++;
  log('job started');

  // obtain mongodb connection
  var db = mongojs(connection_string, ['fb']);

  // set credentials
  feed2db.setAccessToken(credentials.fbAccessToken);
  feed2db.setDBConnection(db.fb);

  // wait for all promises to complete
  Promise
    // pull all feeds and save to mongodb
    .all(getFeedPromises())
      // persist latest posts to feeds.json
      .then(function(){
        saveToJson(db);
      })
  ;
}

// Create a node-static server instance to serve the './data' folder
function startStaticServer() {
  var ipaddress = process.env.OPENSHIFT_NODEJS_IP || "127.0.0.1",
      port = process.env.OPENSHIFT_NODEJS_PORT || 8080,
      file = new staticServer.Server('./public')
  ;

  // if OPENSHIFT env variables are present, use the available connection info:
  if(process.env.OPENSHIFT_MONGODB_DB_PASSWORD){
    connection_string = process.env.OPENSHIFT_MONGODB_DB_USERNAME + ":" +
                        process.env.OPENSHIFT_MONGODB_DB_PASSWORD + "@" +
                        process.env.OPENSHIFT_MONGODB_DB_HOST + ':' +
                        process.env.OPENSHIFT_MONGODB_DB_PORT + '/' +
                        process.env.OPENSHIFT_APP_NAME;
  }


  http.createServer(function (request, response) {
    request.addListener('end', function () {
      // Serve files!
      file.serve(request, response);
    }).resume();
  }).listen(port, ipaddress);
}

// start app
function start() {
  log('app started');

  // set moment.js locale
  moment.locale('ru');

  // listen for HTTP requests
  startStaticServer();

  // get initial feeds
  getFeeds();

  // fire getFeeds() every TIMEOUT ms
  setInterval(getFeeds, TIMEOUT);
}


// ----------------- Go!
start();

