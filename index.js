var Botkit = require('./botkit/lib/Botkit.js');
var os = require('os');
var commandLineArgs = require('command-line-args');
var localtunnel = require('localtunnel');
var spawn = require("child_process").spawn;
//const gcal = require('./services/g_cal.js');
var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
Q = require('q');

const CBOT_PAGE_TOKEN = 'EAAE5hkZBFy7kBABEwkBzQKhhMFKgqI0aCZBCCV5oSmOdhdxFKOlj3P6T94FD6B2aendNQDC4ZAt0dpyjPaqZAl5kI3EHHmAd2uI4AHIJ87wFB55ZB4wRG17j5WGLaZA2rYyCJgZAKLPhuXVfJSmmOfJdN6PeGVpkrEEGDjIr4J4WQZDZD'
const CBOT_VERIFY_TOKEN = 'a680ba8eefca0e974a51913a5d8ba'
const CBOT_APP_SECRET = '35afc9073916257145c18e9e2e5bd11b'
const CBOT_WIT_TOKEN = '45a927606989421d899c4285574b1e82'
const MONGO_URI = 'mongodb://ahmed:ibrahim#1@cupbots-shard-00-02-oiwfs.mongodb.net:27017,cupbots-shard-00-02-oiwfs.mongodb.net:27017,cupbots-shard-00-02-oiwfs.mongodb.net:27017/bookbot?ssl=true&replicaSet=Cupbots-shard-0&authSource=admin'
const db = require('monk')(MONGO_URI)

//var mongoStorage = require('./botkit-storage-mongo/src/index.js')({mongoUri: MONGO_URI, tables: ['bookbot']})
  
var apiai = require('./botkit-middleware-apiai/src/botkit-middleware-apiai.js')({
  token: CBOT_WIT_TOKEN,
  skip_bot: true // or false. If true, the middleware don't send the bot reply/says to api.ai
});

if (!CBOT_PAGE_TOKEN) {
  console.log('Error: Specify page_token in environment');
  process.exit(1);
}

// The webhook URL is /facebook/receive
if (!CBOT_VERIFY_TOKEN) {
  console.log('Error: Specify verify_token in environment');
  process.exit(1);
}

if (!CBOT_APP_SECRET) {
  console.log('Error: Specify app_secret in environment');
  process.exit(1);
}

const ops = commandLineArgs([{
  name: 'lt',
  alias: 'l',
  args: 1,
  description: 'Use localtunnel.me to make your bot available on the web.',
  type: Boolean,
  defaultValue: false
}, {
  name: 'ltsubdomain',
  alias: 's',
  args: 1,
  description: 'Custom subdomain for the localtunnel.me URL. This option can only be used together with --lt.',
  type: String,
  defaultValue: null
}, ]);

var controller = Botkit.facebookbot({
  debug: true,
  log: true,
  access_token: CBOT_PAGE_TOKEN,
  verify_token: CBOT_VERIFY_TOKEN,
  app_secret: CBOT_APP_SECRET,
  validate_requests: true, // Refuse any requests that don't come from FB on your receive webhook, must provide FB_APP_SECRET in environment variables
  //storage: mongoStorage,
});

var bot = controller.spawn({});
controller.middleware.receive.use(apiai.receive);

var bookbot = db.get('bookbot', { castIds: false })

controller.setupWebserver(process.env.port || 5050, function(err, webserver) {
  controller.createWebhookEndpoints(webserver, bot, function() {
    console.log('ONLINE!');
    if (ops.lt) {
      var tunnel = localtunnel(process.env.port || 5050, {
        subdomain: ops.ltsubdomain
      }, function(err, tunnel) {
        if (err) {
          console.log(err);
          process.exit();
        }
        console.log("Your bot is available on the web at the following URL: " + tunnel.url + '/facebook/receive');
      });

      tunnel.on('close', function() {
        console.log("Your bot is no longer available on the web at the localtunnnel.me URL.");
        process.exit();
      });
    }
  });
});


controller.api.messenger_profile.greeting("Hello! Cupbots are chatbots you can stack to meet your need");
controller.api.messenger_profile.get_started('sample_get_started_payload');
controller.api.messenger_profile.menu([{
  "locale": "default",
  "composer_input_disabled": false
}, {
  "locale": "zh_CN",
  "composer_input_disabled": false
}]);

controller.hears(['sample_get_started_payload'], 'facebook_postback', function(bot, message) {
  bot.startConversation(message, function(err, convo) {
    convo.say("Hi, I'm Cupbot and I'm a ready-made chatbot for you to use.")
    convo.say("Like stacking Lego, you can stack Cupbots to meet your needs.")
    convo.ask({
      text: 'Would you like to try a Reservation Cupbot?',
      quick_replies: [{
        content_type: 'text',
        title: 'Yes',
        payload: 'yes-reservation-cupbot',
      }, {
        content_type: 'text',
        title: 'No',
        payload: 'no-reservation-cupbot',
      }]
    })
  })
})


// If nothing precoded, send to API.AI to process
controller.hears('.*', 'message_received', function(bot, message) {
  apiai.hears(message, bot)

  console.log("API.AI: ", message)
  

  // If API.ai has action and confidence is above 70%
  if (message.nlpResponse.result.action &&
    message.nlpResponse.result.action != "input.unknown" &&
    message.confidence >= 0.7) {
    console.log("API.AI has something to say.")

    // Check if has Facebook specific replies from API.AI
    var resp = message.fulfillment.messages
    var fb_resp = resp.filter(obj => obj.platform == 'facebook')
    
    if (fb_resp.length <= 1) {
      bot.replyWithTyping(message, message.fulfillment.speech)
    } else {
      // reply a random choice set in API.AI
      var choice = Math.ceil(Math.random() * fb_resp.length)
      // console.log('RANDOM CHOICE: ', choice)
      var fb_resp_msg = fb_resp[choice]
      // console.log("CHOSEN REPLY: ", fb_resp_msg)
      switch (fb_resp_msg.type) {
        case 0: // plain text
          bot.reply(message, fb_resp_msg.speech)
          break;
        case 2: // quick replies
          var replies = fb_resp_msg.replies
            // loop to make the quick_replies
          var arr = []
          for (var i = 0, l = replies.length; i < l; i++) {
            arr[i] = {
              "content_type": "text",
              "title": replies[i],
              "payload": replies[i],
            }
          }
          var msg = {
            text: fb_resp_msg.title,
            quick_replies: arr
          }
          bot.reply(message, msg)
          break;

        case 3: // image
          var msg = {
            "attachment": {
              "type": "image",
              "payload": {
                "url": fb_resp_msg.imageUrl
              }
            }
          }
          bot.reply(message, msg)
          break

        case 4: // generic/carousel
          bot.reply(message, fb_resp_msg.payload.facebook)
          break
        default:
          break
      }
    }
  } else {
    bot.replyWithTyping(message, "I didn't understand that. I'll feedback to my creator.")
  }
})


// // Add to document
// var Ob  = 
//     {_id: '656561',
//   Name:'Ahmed',
//   Email:'Ahmed@as.com',
//   phone:01119093531}

//bookbot.insert(Ob)

// Show all documents in collection
// bookbot.find({}, function (err, data) {
//   if(!err)
// 		{
// 			console.log("MONGODB: ", data);
// 		}
// });


/// Google Calendar integration
var calendar = google.calendar('v3');

function listEvents(auth) {
  calendar.events.list({
    auth: auth,
    calendarId: 'primary',
    timeMin: (new Date()).toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime'
  }, function(err, response) {
    if (err) {
      console.log('The API returned an error: ' + err);
      return;
    }
    var events = response.items;
    if (events.length == 0) {
      console.log('No upcoming events found.');
    } else {
      console.log('Upcoming 10 events:');
      for (var i = 0; i < events.length; i++) {
        var event = events[i];
        var start = event.start.dateTime || event.start.date;
        console.log('%s - %s', start, event.summary);
      }
    }
  });
}

fs.readFile('./services/client_secret.json', function processClientSecrets(err, content) {
  if (err) {
    console.log('Error loading client secret file: ' + err);
    return;
  }
  // Authorize a client with the loaded credentials, then call the
  // Google Calendar API.
  //authorize(JSON.parse(content), listEvents);
  //authorize(JSON.parse(content), )
  getAvail(JSON.parse(content), {start: new Date("2017-08-01:08:00:00"), end: new Date("2017-08-01:08:30:00")}, 'primary')
});

var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
    process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'calendar-nodejs-quickstart.json';

function authorize(credentials, callback) {
  var clientSecret = credentials.installed.client_secret;
  var clientId = credentials.installed.client_id;
  var redirectUrl = credentials.installed.redirect_uris[0];
  var auth = new googleAuth();
  var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, function(err, token) {
    if (err) {
      getNewToken(oauth2Client, callback);
    } else {
      oauth2Client.credentials = JSON.parse(token);
      callback(oauth2Client);
    }
  });
}

function getAvail(auth, dateTimeRange, calID) {
    console.log(dateTimeRange)
    console.log('auth:'+JSON.stringify(auth));
    console.log('date Time Range :'+(dateTimeRange.start).toISOString()+' --->'+(dateTimeRange.end).toISOString());
    console.log('calendar id to check freebusy:'+calID);
    var deferred = Q.defer(); // get a new deferral
    calendar.freebusy.query({
            auth: auth,
            headers: { "content-type" : "application/json" },
            resource:{items: [{"id" : calID}],   //needed to include resource instead of sending the params directly.

                      timeMin: (dateTimeRange.start).toISOString(),
                      timeMax: (dateTimeRange.end).toISOString()
                    }   
    }, function(err, response) {
                    console.log('Response from the Calendar service: ' + JSON.stringify(response));
                    if (err) {
                            console.log('There was an error contacting the Calendar service: ' + err);
                            deferred.reject(); // deferred reject here
                            return;
                    }   
                    var events = response.calendars[calID].busy;
                    if (events.length == 0) {
                            console.log('No upcoming events found.');
                    } else {
                            console.log('busy in here...');
                    }   
                    deferred.resolve(response); // deferred resolve here
            }); 
    return deferred.promise; // return a promise
}