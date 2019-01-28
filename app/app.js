'use strict';

// =================================================================================
// App Configuration
// =================================================================================

const { App } = require('jovo-framework');
const Yelp = require('./yelp.js')
const Schedule = require('./getEvents.js')
const Directions = require('./getDirections.js')
const Mail = require('./sendMail.js')
const moment = require('moment')
const YelpToken = process.env.yelpToken
const MapsToken = process.env.mapsToken
const fs = require('fs');

const config = {
    logging: true,
    intentMap: {
        'AMAZON.StopIntent': 'END',
        'AMAZON.CancelIntent': 'CancelIntent',
        'AMAZON.YesIntent': 'YesIntent',
        'AMAZON.NoIntent': 'NoIntent',
        'AMAZON.HelpIntent': 'HelpIntent'
    },
};

const app = new App(config);

let name = "あなた"


// =================================================================================
// App Logic
// =================================================================================

const alexaHandler = {
    'LAUNCH': async function() {

        if (this.user().getName()) {
            name = await this.user().getName()
            console.log('名前' + '%j', name)
            name = name + "さん"
        }
        let m = moment()
        m = m.hours() + 9
        console.log("現在時刻: " + m)
        let greet = "こんにちは。"

        if (m > 3 && m < 12) {
            greet = "おはようございます。"
        } else if (m > 18 || m <= 3) {
            greet = "こんばんは。"
        }

        this.setSessionAttribute('userName', name)
        this.setSessionAttribute('shopNumber', 0)
        this.ask(greet + name + 'のためのコンシェルジュです。何をご所望ですか。私ができることを知りたいときはヘルプと言ってください。')
    },

    'ScheduleIntent': async function() {

        //Google Calender API
        let token = this.getAccessToken()
        console.log("トークン: " + token)
        let schedule = new Schedule(token)
        const date = undefined
        let events = undefined
        try {
            events = await schedule.getEvents(date)
            console.log("GoogleCalender取得情報: " + "%j", events)
        } catch (error) {
            this.tell('アカウントリンクがされていないためスケジュールを取得できませんでした。このスキルを実行するためにアカウントリンクを行ってください。')
            return
        }
        events = JSON.parse(events)
        console.log("結果: " + "%j", events)
        if (events.items.length == 0) {
            this.tell("今日これからの予定は特にありません。ゆっくりとおやすみください。")
        }
        let latestEvent = events.items[0]
        let startTime = moment(latestEvent.start.dateTime).utcOffset("+09:00")
        if (moment().unix() >= startTime.unix()) {
            latestEvent = events.items[1]
        }
        let loc = latestEvent.location
        this.setSessionAttribute('direction', loc)
        console.log("位置情報: " + loc)

        let nextEvent = latestEvent.summary
        startTime = moment(latestEvent.start.dateTime).utcOffset("+09:00")
        this.setSessionAttribute('startTime', startTime)
        let startHour = startTime.hours()
        let startMin = startTime.minutes()
        startTime = startHour + "時" + startMin + "分"

        if (loc != void 0) {
            loc = loc.split(',')[0] + "で"
        } else {
            loc = ""
        }

        this.followUpState('ScheduleState').ask("次のスケジュールは、" + startTime + "より、" + loc + nextEvent + "です。開催地までの所要時間をお調べしますか。")
    },

    'ScheduleState': {
        'YesIntent': async function() {
            console.log("ScheduleState: YesIntentに入りました。")
            this.toIntent('DirectionsIntent')
        }
    },

    'AllScheduleIntent': async function() {

        //Google Calender API
        let token = this.getAccessToken()
        console.log("トークン: " + token)
        let schedule = new Schedule(token)
        let date = undefined
        let events = undefined
        try {
            events = await schedule.getEvents(date)
            console.log("GoogleCalender取得情報: " + "%j", events)
        } catch (error) {
            this.tell('アカウントリンクがされていないためスケジュールを取得できませんでした。このスキルを実行するためにアカウントリンクを行ってください。')
            return
        }
        events = JSON.parse(events)
        console.log("結果: " + "%j", events)
        if (events.items.length == 0) {
            this.tell("今日の予定は特にありません。ゆっくりとおやすみください。")
            return
        }
        let allMessage = []
        events.items.forEach(function(event) {
            let loc = event.location
            console.log("位置情報: " + loc)
            let startTime = moment(event.start.dateTime).utcOffset("+09:00")
            let startHour = startTime.hours()
            let startMin = startTime.minutes()
            startTime = startHour + "時" + startMin + "分"
            if (loc != void 0) {
                loc = loc.split(',')[0] + "で"
            } else {
                loc = ""
            }
            let message = startTime + "より、" + loc + event.summary
            allMessage.push(message)
        });

        this.tell("今日のスケジュールは、" + allMessage.join("、") + "です。")
    },

    'DirectionsIntent': async function(direction = { "value": undefined }, departure = { "value": undefined }, transportation = { "value": undefined }) {
        let way = "車"
        let transit = 'driving' //交通手段(transit, walking)
        let dirflg = 'd' //w = 徒歩、t = 公共交通機関
        console.log("オールスロット: " + "%j", this.getInputs())
        console.log("スロット(transportation): " + "%j", transportation)

        transportation = this.getInputs().transportation ? this.getInputs().transportation : transportation
        direction = this.getInputs().direction ? this.getInputs().direction : direction
        departure = this.getInputs().departure ? this.getInputs().departure : departure

        if (transportation.value == undefined && this.getSessionAttribute('transportation') == undefined) {
            console.log('移動手段指定なし')
        } else if (transportation.value == undefined && this.getSessionAttribute('transportation') != undefined) {
            console.log("移動手段(attribute): " + '%j', this.getSessionAttribute('transportation', way))
            way = this.getSessionAttribute('transportation')
        } else if (transportation.value != undefined && this.getSessionAttribute('transportation') == undefined) {
            console.log("移動手段(slot): " + '%j', transportation.key)
            way = transportation.key
        } else {
            way = transportation.key
        }

        switch (way) {
            case '車':
                transit = 'driving' //交通手段(transit, walking)
                dirflg = 'd' //w = 徒歩、t = 公共交通機関
                break
            case '徒歩':
                transit = 'walking' //交通手段(transit, walking)
                dirflg = 'w' //w = 徒歩、t = 公共交通機関
                break
            case '公共交通機関':
                transit = 'transit' //交通手段(transit, walking)
                dirflg = 't' //w = 徒歩、t = 公共交通機関
                break
        }

        this.setSessionAttribute('transportation', way)

        //Google Directions API
        let directions = new Directions(MapsToken)
        let getDirect = this.getSessionAttribute('direction')
        console.log("目的地: " + "%j", getDirect)

        console.log("スロット(direction): " + "%j", direction)
        console.log("attribute: " + "%j", getDirect)
        if (direction.value == void 0 && getDirect == undefined) {
            this.followUpState('DirectionsState').ask("目的地を取得できませんでした。目的地を教えてください。")
            return
        } else if (direction.value != void 0) {
            getDirect = direction.value
        }
        this.setSessionAttribute('direction', getDirect)

        let nowLocation = await this.user().getDeviceAddress()
        console.log("スロット(departure): " + '%j', departure)
        console.log("デバイス位置: " + '%j', nowLocation)
        if (0 === Object.keys(nowLocation).length && departure.value == void 0 && this.getSessionAttribute('departure') == void 0) {
            this.followUpState('DirectionsState').ask("デバイスの位置情報が取得できませんでした。現在地を教えてください。")
            return
        } else if (this.getSessionAttribute('departure') != undefined && 0 === Object.keys(nowLocation).length && departure.value == void 0) {
            nowLocation = this.getSessionAttribute('departure')
        } else if (this.getSessionAttribute('departure') == undefined && 0 !== Object.keys(nowLocation).length && departure.value == void 0) {
            nowLocation = nowLocation.stateOrRegion + "" + nowLocation.city + "" + nowLocation.addressLine1
        } else {
            nowLocation = departure.value
        }

        console.log("現在地: " + '%j', nowLocation)
        this.setSessionAttribute('departure', nowLocation)
        let departure_time = undefined
        let duration = undefined
        console.log("次のイベント開始時間(UNIX): " + moment(this.getSessionAttribute('startTime')).unix())
        let directionsResult = undefined
        try {
            directionsResult = await directions.getDirections(transit, nowLocation, getDirect, moment(this.getSessionAttribute('startTime')).unix())
        } catch (error) {
            this.tell("経路情報が取得できませんでした。時間を置いてから再度お試しください。")
            return
        }
        console.log("GoogleDirections取得情報: " + "%j", directionsResult)
        if (directionsResult.routes.length == 0) {
            this.followUpState('DirectionsState').ask("経路が取得できませんでした。言い換えてみてください。")
            return
        }
        console.log("directionsResult: " + "%j", directionsResult)
        duration = directionsResult.routes[0].legs[0].duration.text
        duration = duration.replace("hours", "時間").replace("mins", "分").replace("hour", "時間").replace("min", "分")
        console.log("所要時間: " + "%j", duration)


        departure_time = this.getSessionAttribute('startTime') && directionsResult.routes[0].legs[0].departure_time ? directionsResult.routes[0].legs[0].departure_time.value : undefined

        console.log(directionsResult.routes[0].legs[0].departure_time)
        console.log("出発推奨時間: " + departure_time)

        let durationHour = duration.split("時間")
        let durationMin = duration.split("分")

        console.log(durationHour, durationMin)

        if (durationHour.length > 1) {
            durationHour = durationHour[0]
            durationMin = durationHour[1].split("分")
            if (durationMin > 1) {
                durationMin = durationHour[1].split("分")[0]
            } else {
                durationMin = 0
            }
        } else {
            durationHour = 0
            durationMin = duration.split("分")[0]
        }

        console.log(durationHour, durationMin)

        let now = moment()
        let eventTime = moment(this.getSessionAttribute('startTime'))
        let timeDiff = eventTime.diff(now, 'minutes')
        let durationSum = Number(durationHour) * 60 + Number(durationMin)

        let durationDiff = timeDiff - durationSum

        console.log("余裕時間: " + Number(durationDiff))
        let directionUrl = "https://www.google.com/maps/dir/?api=1&origin=" + nowLocation + "&destination=" + getDirect + "&dirflg=" + dirflg
        let emailAdd = await this.user().getEmail()
        let body = fs.readFileSync('./app/html/hero.html', 'utf8')

        let depTimeText = ""
        if (departure_time != undefined) {
            let depTime = moment.unix(departure_time).utcOffset("+09:00")
            depTimeText = String(depTime.hours()) + "時" + String(depTime.minutes()) + "分頃には出発してください。"
            console.log(depTimeText)
        }

        if (durationDiff >= 30) {
            if (emailAdd == undefined) {
                this.showSimpleCard("経路リンク", directionUrl).followUpState('DirectionsState').ask("目的地までの所要時間は" + way + "でおよそ" + duration + "です。" + depTimeText + String(durationDiff) + "分程度余裕があります。目的地周辺でお食事などはいかがでしょうか。")
            }
            let mail = new Mail()
            let setBody = body.replace(/\n/g, '').replace(/\t/g, '')
            let mbody = setBody.replace(/TitleHeadTwo/g, "マイコンシェルジュ")
                .replace(/ExplainOne/g, "マイコンシェルジュのご利用ありがとうございます。")
                .replace(/TitleHeadThree/g, "経路情報")
                .replace(/ShopImage/g, "")
                .replace(/ShopGuide/g, "")
                .replace(/HomePage/g, "")
                .replace(/ExplainTwo/g, "現在地から目的地までの距離は下記のリンクからご確認ください。")
                .replace(/MapURL/g, directionUrl)

            await mail.sendMail(emailAdd, "マイコンシェルジュ 経路情報", mbody)
            this.showSimpleCard("経路リンク", directionUrl).followUpState('DirectionsState').ask("目的地までの所要時間は" + way + "でおよそ" + duration + "です。" + depTimeText + "経路情報をメールでお送りしました。" + String(durationDiff) + "分程度余裕があります。目的地周辺でお食事などはいかがでしょうか。")
        } else {
            if (emailAdd == undefined) {
                this.showSimpleCard("経路リンク", directionUrl).followUpState('DirectionsState').ask("目的地までの所要時間は" + way + "でおよそ" + duration + "です。" + depTimeText)
            }
            let mail = new Mail()
            let setBody = body.replace(/\n/g, '').replace(/\t/g, '')
            let mbody = setBody.replace(/TitleHeadTwo/g, "マイコンシェルジュ")
                .replace(/ExplainOne/g, "マイコンシェルジュのご利用ありがとうございます。")
                .replace(/TitleHeadThree/g, "経路情報")
                .replace(/ShopImage/g, "")
                .replace(/ShopGuide/g, "")
                .replace(/HomePage/g, "")
                .replace(/ExplainTwo/g, "現在地から目的地までの距離は下記のリンクからご確認ください。")
                .replace(/MapURL/g, directionUrl)

            console.log("ファイルの中身: ", mbody)
            // await mail.sendMail(emailAdd, "マイコンシェルジュ 経路情報", "<a href='" + directionUrl + "'>経路リンク</a>")
            await mail.sendMail(emailAdd, "マイコンシェルジュ 経路情報", mbody)
            this.showSimpleCard("経路リンク", directionUrl).tell("目的地までの所要時間は" + way + "でおよそ" + duration + "です。経路情報をメールでお送りしました。" + depTimeText)
        }
    },

    'DirectionsState': {
        'OnlyDirectionsIntent': async function(location) {
            console.log("OnlyDirectionsIntentに入りました。")
            if (this.getSessionAttribute('direction') != undefined) {
                this.setSessionAttribute('departure', location.value)
                const direction = {
                    "value": this.getSessionAttribute('direction')
                }
                this.toIntent('DirectionsIntent', direction, location)
            } else if (this.getSessionAttribute('departure') != undefined) {
                this.setSessionAttribute('direction', location.value)
                const departure = {
                    "value": this.getSessionAttribute('departure')
                }
                this.toIntent('DirectionsIntent', location, departure)
            } else if (this.getSessionAttribute('departure') == undefined && this.getSessionAttribute('direction') == undefined) {
                this.setSessionAttribute('direction', location.value)
                const departure = {
                    "value": this.getSessionAttribute('departure')
                }
                this.toIntent('DirectionsIntent', location, departure)
            } else {
                this.toIntent('DirectionsIntent')
            }
        },

        'YesIntent': function() {
            console.log("DirectionsState: YesIntentに入りました。")
            this.toIntent('ShopIntent')
        }
    },

    'TransportationIntent': function(transportation) {
        console.log("TransportationIntentに入りました。")
        const direction = {
            "value": this.getSessionAttribute('direction')
        }
        const departure = {
            "value": this.getSessionAttribute('departure')
        }
        this.setSessionAttribute('transportation', transportation.key)
        this.toIntent('DirectionsIntent', direction, departure)
    },

    'ShopIntent': async function(keyword = { "value": undefined }, location = { "value": undefined }) {
        //Yelp API
        keyword = this.getInputs().keyword ? this.getInputs().keyword : keyword
        location = this.getInputs().location ? this.getInputs().location : location

        let category = null
        if (keyword.value == void 0) {
            keyword = this.getSessionAttribute('keyword') == void 0 ? null : this.getSessionAttribute('keyword')
            category = "food"
        } else {
            keyword = keyword.value
            this.setSessionAttribute('keyword', keyword)
        }
        let getLocation = this.getSessionAttribute('direction')
        console.log("スロット(location): " + "%j", location)
        console.log("attribute: " + "%j", getLocation)
        if (location.value == void 0 && getLocation == undefined && this.getSessionAttribute('location') == undefined) {
            this.followUpState('ShopState').ask("位置情報が取得できませんでした。どこのお店を調べますか。")
            return
        } else if (location.value == void 0 && getLocation == undefined && this.getSessionAttribute('location') != undefined) {
            getLocation = this.getSessionAttribute('location')
        }
         else if (location.value != undefined) {
            getLocation = location.value
        }

        this.setSessionAttribute('location', getLocation)

        console.log("指定場所: " + "%j", getLocation)
        let shop = undefined
        try {
            let yelp = new Yelp(YelpToken)
            shop = await yelp.searchShop(keyword, getLocation, category)
            console.log("Yelp取得情報: " + "%j", shop)
        } catch (error) {
            this.tell("店舗情報を取得できませんでした。時間を置いてから再度お試しください。")
            return
        }

        if (shop.businesses.length == 0) {
            this.ask("該当するお店は見つかりませんでした。他に知りたいことはありますか。")
            return
        }

        shop.businesses.sort((a, b) => {
            if (a.rating > b.rating) return -1;
            if (a.rating < b.rating) return 1;
            return 0;
        });
        console.log("お店一覧: " + "%j", shop.businesses)

        let shopNum = this.getSessionAttribute('shopNumber') == void 0 ? 0 : this.getSessionAttribute('shopNumber')

        this.setSessionAttribute('shopNumber', shopNum)
        console.log("お店: " + "%j", shop.businesses[shopNum])
        this.setSessionAttribute('shopInfo', shop.businesses[shopNum])

        this.followUpState('ShopState').ask("目的地周辺にあるおすすめのお店は、" + shop.businesses[shopNum].name + "です。いかがでしょうか。");
    },

    'ShopState': {
        'OnlyDirectionsIntent': async function(location) {
            console.log("ShopState: OnlyDirectionsIntentに入りました。")
            if (location != undefined) {
                const keyword = {
                    "value": undefined
                }
                this.toIntent('ShopIntent', keyword, location)
            } else {
                this.ask("検索したい場所を指定してください。")
            }
        },
        'YesIntent': async function() {
            let mail = new Mail()
            let emailAdd = await this.user().getEmail()
            if (emailAdd == undefined) {
                this.tell("メールアドレスへのアクセス権限を有効にすることでお店の情報をメールで受け取ることができます。アクセス権限はアレクサアプリより設定できます。")
                return
            }
            let body = fs.readFileSync('./app/html/hero.html', 'utf8')

            let shopInfo = this.getSessionAttribute('shopInfo')
            const shopName = shopInfo.name
            const shopImg = shopInfo.image_url
            const shopUrl = shopInfo.url
            const shoploc = "http://maps.google.com/maps?q=" + String(shopInfo.coordinates.latitude) + "," + String(shopInfo.coordinates.longitude)

            let setBody = body.replace(/\n/g, '').replace(/\t/g, '')
            let mbody = setBody.replace(/TitleHeadTwo/g, "マイコンシェルジュ")
                .replace(/ExplainOne/g, "マイコンシェルジュのご利用ありがとうございます。")
                .replace(/TitleHeadThree/g, shopName)
                .replace(/ShopImage/g, shopImg)
                .replace(/ShopGuide/g, "お店の詳しい情報は次のリンクをご確認ください。")
                .replace(/HomePage/g, shopUrl)
                .replace(/ExplainTwo/g, "お店の詳しい位置は下記のリンクからご確認ください。")
                .replace(/MapURL/g, shoploc)

            await mail.sendMail(emailAdd, "マイコンシェルジュ 店舗情報", mbody)
            this.tell("お店の情報をメールでお送りしました。")
        },
        'OtherShopIntent': function() {
            let shopNum = this.getSessionAttribute('shopNumber') + 1
            this.setSessionAttribute('shopNumber', shopNum)
            this.toIntent('ShopIntent')
        },

    },

    'HelpIntent': function() {
        this.ask("マイコンシェルジュではあなたのスケジュールをあなたの代わりに管理いたします。直近の予定が知りたい場合はマイコンシェルジュで「次の予定は」と聞いてみてください。さらに詳しい情報が知りたいときはアレクサアプリのスキルページを参照してください。")
    },

    'CancelIntent': function() {
        this.toIntent('END')
    },

    'NoIntent': function() {
        this.toIntent('END')
    },

    'Unhandled': function() {
        this.ask('すみません、もう一度おっしゃっていただけますか？')
    },

    'END': function() {
        this.tell("良い一日をお過ごしください。")
    },

}

const googleHandler = {
    'LAUNCH': function() {
        this.toIntent('WelcomeIntent')
    },

    'WelcomeIntent': function() {
        // this.googleAction().askForName("マイコンシェルジュです。ユーザーデータへのアクセスを許可してください。")

        // if (this.user().getName()) {
        //     name = await this.user().getName()
        //     console.log('名前' + '%j', name)
        //     name = name + "さん"
        // }
        let m = moment()
        m = m.hours() + 9
        console.log("現在時刻: " + m)
        let greet = "こんにちは。"

        if (m > 3 && m < 12) {
            greet = "おはようございます。"
        } else if (m > 18 || m <= 3) {
            greet = "こんばんは。"
        }

        this.setSessionAttribute('userName', name)
        this.ask(greet + name + 'のためのコンシェルジュです。何をご所望ですか。私ができることを知りたいときはヘルプと言ってください。')
    },

    'ON_PERMISSION': function() {
        if (this.googleAction().isPermissionGranted()) {
            let user = this.googleAction().getRequest().getUser();

            // Check, if you have the necessary permission
            if (user.permissions.indexOf('NAME') > -1) {
                /* 
                  user.profile.givenName
                  user.profile.familyName
                  user.profile.displayName
                */
            }
        }
    },

    'END': function() {
        this.tell("良い一日をお過ごしください。")
    }
}

app.setHandler(alexaHandler)
app.setAlexaHandler(alexaHandler)
app.setGoogleActionHandler(googleHandler)
module.exports.app = app;