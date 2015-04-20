// Pulls the FB graph feed of a group and persists it in mongodb collection
// it overwrites the old records that have the same ID field (facebook feed item ID)
// Returns a promise
var _         = require('lodash'),
    graph     = require('fbgraph'),               // FB Graph API module
    Promise   = require('es6-promise').Promise,
    db                                            // a reference to a mongojs collection
;

var DESCRIPTION_THRESHOLD = 140; // max chars in description (message + story in FB post)
graph.setVersion('2.3');

// FB API related: fields in payload that we will request (no neeed to pull all the fields)
var fbSimpleFields = ['id','message','story','created_time','updated_time'];


// pulls the feed from Graph API, returns a promise that resolves with the response
var getGraphData = function(group) {
  return new Promise(function(resolve, reject) {
    // parameters used to construct query. We are interested in number of comments and likes
    var fbParams = 'fields='+fbSimpleFields.join()+',from,likes.limit(1).summary(true),comments.limit(1).summary(true)&locale=ru_RU';

    // construct URL
    // a typical call would look like this (try at https://developers.facebook.com/tools/explorer):
    // /355096164617904/feed?fields=id,message,story,created_time,updated_time,from,likes.limit(1),comments.limit(1)&locale=ru_RU
    var url = '/'+group.id+'/feed?' + fbParams;
    // get FB graph data
    graph.get(url, handler);

    function handler(err, res) {
      if (err) {
        console.log('Error in Graph API feed call:', err);
        reject(this);
      }
      else {
        // resolve and pass the response data
        resolve({group: group, response: res});
      }
    }
  });
};


// processes Graph API response and returns more convenient list of objects to be persisted in mongodb
// returns a promise (only for then-able purposes)
var processGraphData = function(obj) {
  var rawData = obj.response,
      group = obj.group
  ;

  return new Promise(function(resolve, reject){
    // result data items
    var data = (rawData && rawData.data) || [];
    var currentTime = new Date();

    // tweak the structure of the items
    var items = data.map(function(item) {
      var description = item.message || item.story || '';
      if (description.length > DESCRIPTION_THRESHOLD + 5)
        description = description.substring(0, DESCRIPTION_THRESHOLD) + '...';
      return _.extend(
        {
          groupID: group.id,
          groupName: group.name,
          likes: item.likes && item.likes.summary ? item.likes.summary.total_count : 0,
          comments: item.comments && item.comments.summary ? item.comments.summary.total_count : 0,
          from: item.from ? item.from.name : '',
          description:  description,
          timeStamp: currentTime
        },
        _.pick(item, fbSimpleFields)
      );
    });
    // resolve and pass processed items
    resolve({group: group, items: items});
  });
};


// stores the list of items to db (mongodb)
// returns a promise
function storeGraphData(obj) {
  return new Promise(function(resolve, reject) {
    // IDs of the new items
    var ids = _.pluck(obj.items, 'id');
    if (db) {
      // replace/insert items
      // remove from db items with the IDs we are about to insert to avoid duplicate records (newer items
      // might have updated 'like' and 'comments' count
      db.remove({'id':{'$in': ids}}, function() {
        // insert new items
        db.insert(obj.items, { ordered: false });
        // resolve this promise
        resolve(obj.items);
      });
    }
    else {
      console.log('DB connection error');
      reject('DB connection error');
    }
  });
}

// a function we will publicly expose: reads from Graph API, processes result, persists result and returns a promise
function feed2db ( id, name ) {
  return getGraphData({id: id, name: name})
            .then(processGraphData)
            .then(storeGraphData)
    ;
}

module.exports = {
  setAccessToken: function(token) { graph.setAccessToken(token); },
  setDBConnection: function(_db) { db = _db;},
  feed2db: feed2db
};