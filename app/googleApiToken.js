var readline = require('readline');
var { google } = require('googleapis');
var OAuth2 = google.auth.OAuth2;
const moment = require('moment')

var CLIENT_ID = '301822403619-8bhi6liucn9k2f8qq2vb5utu6686kkl1.apps.googleusercontent.com',
    CLIENT_SECRET = 'Ftf_AExdSVyOZYn_aCB2f7_J',
    REDIRECT_URL = 'urn:ietf:wg:oauth:2.0:oob',
    SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

var auth = new OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);

var url = auth.generateAuthUrl({ scope: SCOPE });
var getAccessToken = async function(code) {
  auth.getToken(code, function(err, tokens) {
    if (err) {
      console.log('Error while trying to retrieve access token', err);
      return;
    }
    auth.credentials = tokens;
    console.log("結果: " + "%j", listEvents(auth))
  });
};

function listEvents(auth) {
    return new Promise((resolve, reject) => {
        console.log("認証情報:" + "%j", auth)
        const calendar = google.calendar({ version: 'v3', auth });
        const today = moment(moment().format("YYYY-MM-DD")).utcOffset("+09:00"); // 本日の00:00(日本時間)
        const todayMax = moment(moment().format("YYYY-MM-DD")).add(1, 'days').add(-1, 'minutes').utcOffset("+09:00"); // 本日の23:59(日本時間)
        calendar.events.list({
            calendarId: 'primary',
            timeMin: today.toISOString(),
            timeMax: todayMax.toISOString(),
            maxResults: 10,
            singleEvents: true,
            orderBy: 'startTime',
        }, (err, res) => {
            if (err) return console.log('The API returned an error: ' + err);
            const events = res.data.items;
            if (events.length) {
                console.log('Upcoming 10 events:');
                events.map((event, i) => {
                    console.log(event)
                    const start = event.start.dateTime || event.start.date;
                    console.log(`${start} - ${event.summary}`)
                    const dayEvents = {
                        'startTime': start,
                        'eventSummary': event.summary,
                        'location': event.location
                    }
                    // console.log(dayEvents)
                    resolve(dayEvents)
                });
            } else {
                // console.log('No upcoming events found.')
                reject('No upcoming events found.')
            }
        })
    })
}

console.log('Visit the url: ', url);
rl.question('Enter the code here:', getAccessToken);
