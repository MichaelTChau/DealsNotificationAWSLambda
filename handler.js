'use strict';

const request = require('request');

const Mongodb = require('mongodb');
const MONGODB_URI = 'mongodb://admin:password123@ds131551.mlab.com:31551/dealsnotification';

var admin = require("firebase-admin");
var serviceAccount = require("./dealsnotification-firebase-adminsdk-jpj70-1b4a910eb7.json");



admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://dealsnotification.firebaseio.com"
});

function basicFilter(resultArr){
  var fiveMinsAgo = new Date();
  fiveMinsAgo.setMinutes(fiveMinsAgo.getMinutes()-5);

  var filteredArray = resultArr.filter(function(obj) {
      if(fiveMinsAgo > new Date(obj.date * 1000)) {
        return false;
      }

      var text = " " + obj.text;
      var regEx = new RegExp("[^a-z]+ca(nada)?(n)?[^a-z]+", "ig")
      if(!regEx.test(text)) return false;
      return true;
    });
    // filteredArray.push({text:"Canada Zelda $50 testing 1",permalink: "/r/NintendoSwitchDeals/comments/9c09cc/deal_helpquestions_thread_september_2018_need/",date: 1535775098});
    // filteredArray.push({text:"Canada Mario $50 testing 2",permalink: "/r/NintendoSwitchDeals/comments/9c09cc/deal_helpquestions_thread_september_2018_need/",date: 1535775098});
    // filteredArray.push({text:"Canada Splatoon $50 testing 3",permalink: "/r/NintendoSwitchDeals/comments/9c09cc/deal_helpquestions_thread_september_2018_need/",date: 1535775098});
    // if(filteredArray.length != 0)notifyAllUsers(filteredArray);
    return filteredArray;
}

function notifyAllUsers(filteredArr){
  return new Promise(function (resolve, reject) {
    Mongodb.MongoClient.connect(MONGODB_URI,{ useNewUrlParser: true }, function (err, database) {
      if (err) {
        console.log(err);
        process.exit(1);
      }

      var db = database.db('dealsnotification');
      console.log("Database connection ready");
      db.collection("users").find().project({ _id: 0}).toArray(function(err, res) {
        if (err) throw err;
        var userToNotify = [];
        for(var i in res){
          //build regex filter
          var regexString = "";
          var obj = res[i];
          for(var j in res[i].filters){
            if(j == 0) regexString = "(" +  res[i].filters[j] + ")";
            else regexString += "|(" +  res[i].filters[j] + ")";
          }

          if(regexString === ""){
            if(obj.length != 0){
              // let succuss = await sendNotification(res[i].firebaseID,filteredArr);
              var temp = {id:res[i].firebaseID,list:filteredArr};
              userToNotify.push(temp);
            }
            continue;
          }

          //filter list with regex
          var listForUser = filteredArr.filter(function(obj){
            var regEx = new RegExp(regexString, "ig");
            if(!regEx.test(obj.text)) return false;
            return true;
          });

          if(listForUser.length != 0){
            // let succuss = await sendNotification(res[i].firebaseID,listForUser);
            var temp = {id:res[i].firebaseID,list:listForUser};
            userToNotify.push(temp);
          }
        }
        database.close();
        resolve(userToNotify);
      });
    });
  })
}

function sendNotification(id,listOfDeal){
    var option = {
      priority: "high",
      timeToLive: 60 *60 *24
    };

    var body = "";
    for(var i in listOfDeal){
      if(i == 0) body = listOfDeal[i].text;
      else body += " \n" + listOfDeal[i].text;
    }

    var message = {
      notification: {
        title: 'New Deals',
        body: body
      }
    };
    console.log('Sending');
    return admin.messaging().sendToDevice(id, message, option);
}

function getRequest(url) {
  return new Promise(function (resolve, reject) {
    request(url, function (error, res, body) {
      if (!error && res.statusCode == 200) {
        resolve(body);
      } else {
        reject(error);
      }
    });
  });
}

module.exports.run = async (event, context)  => {
  let response = await getRequest('https://www.reddit.com/r/NintendoSwitchDeals/.json');
  var arr = JSON.parse(response).data.children;
  var resultArr = [];
  for(var i in arr){
    var obj = {text:arr[i].data.title,permalink: arr[i].data.permalink,date: arr[i].data.created_utc}
    resultArr.push(obj);
  }
  var basicFilterArray = basicFilter(resultArr);

  if(basicFilterArray.length !=0){
    let userToNotify = await notifyAllUsers(basicFilterArray);
    for(var i in userToNotify){
      var done = await sendNotification(userToNotify[i].id,userToNotify[i].list);
    }
  }

  console.log('Done V 1.1.9');
  return;
};
