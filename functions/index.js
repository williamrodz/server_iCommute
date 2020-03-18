// The Cloud Functions for Firebase SDK to create Cloud Functions and setup triggers.
const functions = require('firebase-functions');
// const serviceAccount = require('./icommute-firebase-firebase-adminsdk-k6k3e-ede02571bf.json')
const apiKeys = require('./apiKeys.json');
const fetch = require('node-fetch');

var admin = require("firebase-admin");
var serviceAccount = require("./icommute-firebase-firebase-adminsdk-g9u8z-a0323162ae.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://icommute-firebase.firebaseio.com"
});

const DISTANCES_API_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json?'

exports.helloWorld = functions.https.onRequest((request, response) => {
 response.send("Hello from Firebase @_@");
});


function getDistance(from,to) {
  var requestUrl = DISTANCES_API_URL;
  requestUrl+=`key=${apiKeys.googleplaces}&origins=${from}&destinations=${to}`

  return request(requestUrl, function (error, response, body) {
    object = JSON.parse(body);
    const firstElement = object["rows"][0]["elements"][0];
    if (firstElement["status"] === "OK"){
      const distanceText = firstElement["distance"]["text"];
      const distanceValue = firstElement["distance"]["value"];
      const durationText = firstElement["duration"]["text"];
      const durationValue = firstElement["duration"]["value"]
      return response.json({distanceText:distanceText,durationText:durationText});

    } else{
      return response.json({distanceText:"REQUEST STATUS NOT OK",durationText:"REQUEST STATUS NOT OK"});
    }
  });
}


function scheduleCommutes(){
  const ref = admin.database().ref('/users/test_user/commutes');
  return ref.once('value').then((snapShotCommutes) => {
      // work with the snapshot here, and return another promise
      // that resolves after all your updates are complete
          const commutesJSON = snapShotCommutes.toJSON();
          const timstampHashes = Object.keys(commutesJSON);

          // var computedCommutes = [];
          //
          // timstampHashes.forEach((hash, i) => {
          //     commuteObject = commutesJSON[hash];
          //     const from = commuteObject["from"];
          //     const to = commuteObject["to"];
          //
          //     transitInfo = getDistance(from,to);
          //     computedCommutes.push(transitInfo);
          //
          // });
          return timstampHashes;

      });
    }


exports.scheduledFunction = functions.pubsub.schedule('every 5 minutes').onRun((context) => {
  console.log('This will be run every 5 minutes!');
  return null;
});


exports.updateCommutes = functions.https.onRequest((request, response) => {
  console.log("Called updateCommutes latest");
  const ref = admin.database().ref('/users/test_user/commutes');

  return ref.once('value').then((snapshot)=>{
    const snapshotValue = snapshot.val();
    const timestamps = Object.keys(snapshotValue);

    var urls = [];

    for (var i = 0; i < timestamps.length; i++) {
      var timestamp = timestamps[i];
      var from = snapshotValue[timestamp].from;
      var to = snapshotValue[timestamp].to;
      var url = `http://localhost:5001/icommute-firebase/us-central1/getDistance?from=${from}&to=${to}`;
      urls.push(fetch(url));
    }

    return Promise.all(urls)
    .then((responses)=>{
      return Promise.all(responses.map((res)=>res.json()));
    })
    .then((data)=>{
      console.log("ALLLL");
      console.log(data);
      return response.send(data);
    })


  })
  .catch((error)=>console.log("error$"+error))
});


exports.getDistance = functions.https.onRequest((req, res) => {
  const from = req.query.from;
  const to = req.query.to;

  var requestUrl = DISTANCES_API_URL;

  requestUrl+=`key=${apiKeys.googleplaces}&origins=${from}&destinations=${to}`

  fetch(requestUrl)
  .then(response => response.json())
  .then(data => {
    const status = data.status
    if (status == "OK"){
      const rows = data.rows;
      const elements = rows[0].elements;
      const firstElement = elements[0];
      const distanceText = firstElement.distance.text;
      const durationText = firstElement.duration.text;

      return res.json({distanceText:distanceText,durationText:durationText});

    }
    else{
      return res.json({distanceText:"REQUEST STATUS NOT OK",durationText:"REQUEST STATUS NOT OK"});
    }

  })
  .catch(err => "error@:"+err)
});
