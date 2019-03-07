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
const Util = require('./Util.js');

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


// =================================================================================
// App Logic
// =================================================================================

const alexaHandler = {
    'LAUNCH': async function() {

        let namePermissionTell = ''
        let name = 'あなた'

        try {
            name = await this.user().getName()
            name = name + "さん"
        } catch (error) {
            if (error.code === 'NO_USER_PERMISSION') {
                name = "あなた"
            } else {
                console.log(error)
            }
        }

        let emailAdd = undefined
        try {
            emailAdd = await this.user().getEmail()
        } catch (error) {
            if (error.code === 'NO_USER_PERMISSION') {
                emailAdd = undefined
            } else {
                console.log(error.code)
            }
        }
        this.setSessionAttribute('email', emailAdd)

        if (name === 'あなた') {
            this.alexaSkill().showAskForContactPermissionCard('name')
            namePermissionTell = 'また、名前へのアクセスを許可することであなたのお名前を呼ぶことが可能になります。アレクサアプリにご案内をお送りしました。'
        }


        let m = moment()
        m = m.hours() + 9
        let greet = "こんにちは。"

        if (m > 3 && m < 12) {
            greet = "おはようございます。"
        } else if (m > 18 || m <= 3) {
            greet = "こんばんは。"
        }

        this.setSessionAttribute('userName', name)
        this.setSessionAttribute('shopNumber', 0)
        console.log("アレクサリクエスト: " + "%j", this.alexaSkill().request.context)
        this.ask(greet + name + 'のためのコンシェルジュです。私ができることを知りたいときはヘルプと言ってください。' + namePermissionTell + '何をご所望ですか。')
    },

    'ScheduleIntent': async function() {

        //Google Calender API
        let token = this.getAccessToken()
        if (!token) {
            this.showAccountLinkingCard().tell('アカウントリンクがされていないためスケジュールを取得できませんでした。この機能を実行するためにGoogleアカウントでアカウントリンクを行ってください。ご案内のカードをアレクサアプリにお送りしました。')
            return
        }
        let schedule = new Schedule(token)
        const date = undefined
        let events = undefined
        try {
            events = await schedule.getEvents(date)
            console.log("GoogleCalender取得情報: " + "%j", events)
        } catch (error) {
            this.tell('問題が発生しました。時間を置いてから再度お試しください。')
            return
        }

        let emailAdd = this.getSessionAttribute('email')
        if (emailAdd == void 0) {
            try {
                emailAdd = await this.user().getEmail()
            } catch (error) {
                if (error.code === 'NO_USER_PERMISSION') {
                    emailAdd = undefined
                } else {
                    console.log(error.code)
                }
            }
        }
        this.setSessionAttribute('email', emailAdd)

        events = JSON.parse(events)
        if (events.items.length == 0) {
            this.tell("今日これからの予定は特にありません。ゆっくりとおやすみください。")
        }
        let latestEvent = events.items[0]
        let startTime = moment(latestEvent.start.dateTime).utcOffset("+09:00")
        if (moment().unix() >= startTime.unix()) {
            latestEvent = events.items[1]
        }
        if (Util.isEmpty(latestEvent)) {
            this.tell("今日これからの予定は特にありません。ゆっくりとおやすみください。")
        }
        let loc = latestEvent.location
        this.setSessionAttribute('direction', loc)

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
        if (!token) {
            this.showAccountLinkingCard().tell('アカウントリンクがされていないためスケジュールを取得できませんでした。この機能を実行するためにGoogleアカウントでアカウントリンクを行ってください。ご案内のカードをアレクサアプリにお送りしました。')
            return
        }
        let schedule = new Schedule(token)
        let date = undefined
        let events = undefined
        try {
            events = await schedule.getEvents(date)
            console.log("GoogleCalender取得情報: " + "%j", events)
        } catch (error) {
            this.tell('問題が発生しました。時間を置いてから再度お試しください。')
            return
        }
        events = JSON.parse(events)
        if (events.items.length == 0) {
            this.tell("今日の予定は特にありません。ゆっくりとおやすみください。")
            return
        }
        let allMessage = []
        events.items.forEach(function(event) {
            let loc = event.location
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
        console.log("%j", this.alexaSkill().request)
        let way = "車"
        let transit = 'driving' //交通手段(transit, walking)
        let dirflg = 'd' //w = 徒歩、t = 公共交通機関

        transportation = this.getInputs().transportation ? this.getInputs().transportation : transportation
        direction = this.getInputs().direction ? this.getInputs().direction : direction
        departure = this.getInputs().departure ? this.getInputs().departure : departure

        let emailAdd = this.getSessionAttribute('email')
        if (emailAdd == void 0) {
            try {
                emailAdd = await this.user().getEmail()
            } catch (error) {
                if (error.code === 'NO_USER_PERMISSION') {
                    emailAdd = undefined
                } else {
                    console.log(error)
                }
            }
        }
        this.setSessionAttribute('email', emailAdd)

        console.log('Eメールアドレス: ' + emailAdd)

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

        if (direction.value == void 0 && getDirect == undefined) {
            this.followUpState('DirectionsState').ask("目的地を取得できませんでした。目的地を教えてください。")
            return
        } else if (direction.value != void 0) {
            getDirect = direction.value
        }
        this.setSessionAttribute('direction', getDirect)
        this.setSessionAttribute('location', getDirect)

        let nowLocation = {}
        let locPermission = false
        let noLocationPermissionMessage = ''
        let noLocationSettingMessage = ''
        try {
            nowLocation = await this.user().getDeviceAddress()
            console.log(nowLocation)
            locPermission = true
            if (0 === Object.keys(nowLocation).length || Util.isEmpty(nowLocation.stateOrRegion)) {
                nowLocation = {}
                noLocationSettingMessage = 'デバイスの住所は許可されていますが、デバイスの住所が登録されていないか、無効な住所が登録されています。アレクサアプリよりデバイスの住所を設定してください。'
            }
        } catch (error) {
            if (error.code === 'NO_USER_PERMISSION' || error.code === 'ACCESS_NOT_REQUESTED') {
                nowLocation = {}
                noLocationSettingMessage = 'デバイスの住所の権限を許可することで、位置を指定しなくてもお調べすることが可能になります。アレクサアプリにご案内をお送りしました。'
            } else {
                console.log('DeviceAddress: ' + error.code)
            }
            locPermission = false
        }
        if (this.alexaSkill().request.context.System.device.supportedInterfaces.Geolocation) {
            if (this.alexaSkill().request.context.Geolocation) {
                const geo = this.alexaSkill().request.context.Geolocation.coordinate
                locPermission = false
                let origin = String(geo.latitudeInDegrees) + ',' + String(geo.longitudeInDegrees)
                nowLocation = origin
            } else if (Util.isEmpty(this.alexaSkill().request.context.Geolocation) && this.alexaSkill().request.session.user.permissions.scopes['alexa::devices:all:geolocation:read'].status == "DENIED") {
                noLocationPermissionMessage = '位置情報サービスを許可することで位置を指定しなくてもお調べすることが可能になります。アレクサアプリにご案内をお送りしました。それでは'
                this.alexaSkill().response.responseObj.response.card = {
                    "type": "AskForPermissionsConsent",
                    "permissions": [
                        "read::alexa:device:all:geolocation"
                    ]
                }
            }
        } else {
            let cantUseLocationService = ''
            if (locPermission) {
                this.alexaSkill().showAskForAddressCard()
            }
            if (this.alexaSkill().request.session.user.permissions.scopes['alexa::devices:all:geolocation:read'].status == "GRANTED") {
                cantUseLocationService = 'お使いの端末では位置情報サービスをお使いいただくことができないため、一部機能が制限されています。'
            }
            noLocationPermissionMessage = cantUseLocationService + noLocationSettingMessage + 'それでは'
        }

        if (0 === Object.keys(nowLocation).length && departure.value == void 0 && this.getSessionAttribute('departure') == void 0) {
            this.followUpState('DirectionsState').ask("デバイスの位置情報が取得できませんでした。" + noLocationPermissionMessage +
                "現在地を教えてください。", "デバイスの位置情報が取得できませんでした。現在地を教えてください。")
            return
        } else if (this.getSessionAttribute('departure') != undefined && 0 === Object.keys(nowLocation).length && departure.value == void 0) {
            nowLocation = this.getSessionAttribute('departure')
        } else if (this.getSessionAttribute('departure') == undefined && 0 !== Object.keys(nowLocation).length && departure.value == void 0 && locPermission == true) {
            nowLocation = nowLocation.stateOrRegion + "" + nowLocation.city + "" + nowLocation.addressLine1
        } else if (this.getSessionAttribute('departure') == undefined && 0 !== Object.keys(nowLocation).length && departure.value == void 0 && locPermission == false) {
            nowLocation = nowLocation
        } else {
            nowLocation = departure.value
        }

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
        duration = duration.replace("hours", "時間").replace("mins", "分").replace("hour", "時間").replace("min", "分").replace("days", "日と").replace("day", "日と")


        departure_time = this.getSessionAttribute('startTime') && directionsResult.routes[0].legs[0].departure_time ? directionsResult.routes[0].legs[0].departure_time.value : undefined

        let durationDay = duration.split("日")
        let durationHour = duration.split("時間")
        let durationMin = duration.split("分")

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

        console.log(durationDay, durationHour, durationMin)

        let now = moment()
        let eventTime = moment(this.getSessionAttribute('startTime'))
        let timeDiff = eventTime.diff(now, 'minutes')
        let durationSum = Number(durationHour) * 60 + Number(durationMin)

        let durationDiff = timeDiff - durationSum

        console.log("余裕時間: " + Number(durationDiff))
        let directionUrl = "http://maps.google.com/maps?saddr=" + nowLocation + "&daddr=" + getDirect + "&dirflg=" + dirflg

        let body = fs.readFileSync('./app/html/hero.html', 'utf8')

        let depTimeText = ""
        if (departure_time != undefined) {
            let depTime = moment.unix(departure_time).utcOffset("+09:00")
            depTimeText = String(depTime.hours()) + "時" + String(depTime.minutes()) + "分頃には出発してください。"
            console.log(depTimeText)
        }

        if (durationDiff >= 30 && durationDay.length <= 1) {
            if (emailAdd == undefined) {
                this.alexaSkill().showAskForContactPermissionCard('email')
                this.followUpState('DirectionsState').ask("目的地までの所要時間は" + way + "でおよそ" + duration + "です。" + depTimeText + "メールアドレスへのアクセスを許可すると経路情報をメールで送信いたします。アレクサアプリにご案内をお送りしました。" + String(durationDiff) + "分程度余裕があります。目的地周辺でお食事などはいかがでしょうか。")
                return
            }
            let mail = new Mail()
            let setBody = body.replace(/\n/g, '').replace(/\t/g, '')
            let mbody = setBody.replace(/TitleHeadTwo/g, "ユニークコンシェルジュ")
                .replace(/ExplainOne/g, "ユニークコンシェルジュのご利用ありがとうございます。")
                .replace(/TitleHeadThree/g, "")
                .replace(/ShopImage/g, "")
                .replace(/ShopGuide/g, "")
                .replace(/HomePage/g, "")
                .replace(/ExplainTwo/g, "現在地から目的地までの距離は下記のリンクからご確認ください。")
                .replace(/MapURL/g, directionUrl)

            await mail.sendMail(emailAdd, "ユニークコンシェルジュ 経路情報", mbody)
            this.followUpState('DirectionsState').ask("目的地までの所要時間は" + way + "でおよそ" + duration + "です。" + depTimeText + "経路情報をメールでお送りしました。" + String(durationDiff) + "分程度余裕があります。目的地周辺でお食事などはいかがでしょうか。")
            return
        } else {
            if (emailAdd == undefined) {
                this.alexaSkill().showAskForContactPermissionCard('email')
                this.followUpState('DirectionsState').tell("目的地までの所要時間は" + way + "でおよそ" + duration + "です。" + depTimeText + "メールアドレスへのアクセスを許可すると経路情報をメールで送信いたします。アレクサアプリにご案内をお送りしました。")
                return
            }
            let mail = new Mail()
            let setBody = body.replace(/\n/g, '').replace(/\t/g, '')
            let mbody = setBody.replace(/TitleHeadTwo/g, "ユニークコンシェルジュ")
                .replace(/ExplainOne/g, "ユニークコンシェルジュのご利用ありがとうございます。")
                .replace(/TitleHeadThree/g, "経路情報")
                .replace(/ShopImage/g, "")
                .replace(/ShopGuide/g, "")
                .replace(/HomePage/g, "")
                .replace(/ExplainTwo/g, "現在地から目的地までの距離は下記のリンクからご確認ください。")
                .replace(/MapURL/g, directionUrl)

            console.log("ファイルの中身: ", mbody)
            // await mail.sendMail(emailAdd, "ユニークコンシェルジュ 経路情報", "<a href='" + directionUrl + "'>経路リンク</a>")
            await mail.sendMail(emailAdd, "ユニークコンシェルジュ 経路情報", mbody)
            this.tell("目的地までの所要時間は" + way + "でおよそ" + duration + "です。経路情報をメールでお送りしました。" + depTimeText)
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

        let emailAdd = this.getSessionAttribute('email')
        if (emailAdd == void 0) {
            try {
                emailAdd = await this.user().getEmail()
            } catch (error) {
                if (error.code === 'NO_USER_PERMISSION') {
                    emailAdd = undefined
                } else {
                    console.log(error.code)
                }
            }
        }
        this.setSessionAttribute('email', emailAdd)

        let category = null
        if (keyword.value == void 0) {
            keyword = this.getSessionAttribute('keyword') == void 0 ? null : this.getSessionAttribute('keyword')
            category = "food"
        } else {
            keyword = keyword.value
            this.setSessionAttribute('keyword', keyword)
        }

        let getLocation = undefined
        let deviceAdd = false

        let noLocationPermissionMessage = ''
        let noLocationSettingMessage = ''

        try {
            getLocation = await this.user().getDeviceAddress()
            console.log('デバイスの住所: ' + '%j', getLocation)
            deviceAdd = true
            if (0 === Object.keys(getLocation).length || Util.isEmpty(getLocation.stateOrRegion)) {
                getLocation = void 0
                noLocationSettingMessage = 'デバイスの住所は許可されていますが、デバイスの住所が登録されていないか、無効な住所が登録されています。アレクサアプリよりデバイスの住所を設定してください。'
            }
        } catch (error) {
            if (error.code === 'NO_USER_PERMISSION' || error.code === 'ACCESS_NOT_REQUESTED') {
                getLocation = undefined
                noLocationSettingMessage = 'デバイスの住所の権限を許可することで、位置を指定しなくても周辺情報をお調べすることが可能になります。アレクサアプリにご案内をお送りしました。'
            } else {
                console.log(error)
            }
            deviceAdd = false
        }

        let geoflag = false
        if (this.alexaSkill().request.context.System.device.supportedInterfaces.Geolocation) {
            if (location.value == void 0 && this.alexaSkill().request.context.Geolocation) {
                const geo = this.alexaSkill().request.context.Geolocation.coordinate
                let origin = String(geo.latitudeInDegrees) + ',' + String(geo.longitudeInDegrees)
                getLocation = origin
                deviceAdd = false
                geoflag = true
            } else if (location.value == void 0 && Util.isEmpty(this.alexaSkill().request.context.Geolocation) && this.alexaSkill().request.session.user.permissions.scopes['alexa::devices:all:geolocation:read'].status == "DENIED") {
                noLocationPermissionMessage = '位置情報サービスを許可することで位置を指定しなくてもお調べすることが可能になります。アレクサアプリにご案内をお送りしました。それでは'
                this.alexaSkill().response.responseObj.response.card = {
                    "type": "AskForPermissionsConsent",
                    "permissions": [
                        "read::alexa:device:all:geolocation"
                    ]
                }
            }
        } else {
            let cantUseLocationService = ''
            if (deviceAdd) {
                this.alexaSkill().showAskForAddressCard()
            }
            if (this.alexaSkill().request.session.user.permissions.scopes['alexa::devices:all:geolocation:read'].status == "GRANTED") {
                cantUseLocationService = 'お使いの端末では位置情報サービスをお使いいただくことができないため、一部機能が制限されています。'
            }
            noLocationPermissionMessage = cantUseLocationService + noLocationSettingMessage + 'それでは'
        }

        console.log("スロット(location): " + "%j", location)
        console.log("attribute: " + "%j", getLocation)
        let fromOtherIntent = false
        let locationVal = ''

        if (location.value == void 0 && getLocation == undefined && this.getSessionAttribute('location') == undefined) {
            this.followUpState('ShopState').ask("位置情報が取得できませんでした。" + noLocationPermissionMessage +
                "どこのお店を調べますか。", "位置情報が取得できませんでした。どこのお店を調べますか。")
            return
        } else if (location.value == void 0 && this.getSessionAttribute('location') != undefined) {
            getLocation = this.getSessionAttribute('location')
            fromOtherIntent = true
        } else if (location.value != undefined) {
            getLocation = location.value
            geoflag = false
        } else if (location.value == void 0 && getLocation != void 0) {
            if (deviceAdd == true) {
                getLocation = getLocation.stateOrRegion + "" + getLocation.city + "" + getLocation.addressLine1
            } else {
                getLocation = getLocation
            }
        }

        if (geoflag == false) {
            locationVal = getLocation
        }

        this.setSessionAttribute('location', getLocation)

        console.log("deviceAdd: " + "%j", deviceAdd)
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
        if (shop.businesses.length - 1 < shopNum) {
            this.ask("これ以上周辺のお店をみつけられませんでした。他に知りたいことはありますか。")
        }

        let shopName = shop.businesses[shopNum].alias
        shopName = shopName.split('-')
        shopName.pop()
        console.log(shopName)
        shopName = shopName.join('')

        if (fromOtherIntent == true) {
            this.followUpState('ShopState').ask("目的地周辺にあるおすすめのお店は、" + shopName + "です。いかがでしょうか。");
        } else {
            this.followUpState('ShopState').ask(locationVal + "周辺にあるおすすめのお店は、" + shopName + "です。いかがでしょうか。");
        }
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
            console.log("ShopState: YesIntentに入りました。")
            let mail = new Mail()
            let emailAdd = this.getSessionAttribute('email')
            console.log('stateの中: ' + emailAdd)
            if (emailAdd == void 0) {
                this.alexaSkill().showAskForContactPermissionCard('email')
                this.tell("メールアドレスへのアクセス権限を有効にすることでお店の情報をメールで受け取ることができます。アレクサアプリにご案内をお送りしました。")
                return
            }

            let body = fs.readFileSync('./app/html/hero.html', 'utf8')

            let shopInfo = this.getSessionAttribute('shopInfo')
            // const shopName = shopInfo.name
            let shopName = shopInfo.alias
            shopName = shopName.split('-')
            shopName.pop()
            shopName = shopName.join('')
            const shopImg = shopInfo.image_url
            const shopUrl = shopInfo.url
            const shoploc = "http://maps.google.com/maps?q=" + String(shopInfo.coordinates.latitude) + "," + String(shopInfo.coordinates.longitude)

            let setBody = body.replace(/\n/g, '').replace(/\t/g, '')
            let mbody = setBody.replace(/TitleHeadTwo/g, "ユニークコンシェルジュ")
                .replace(/ExplainOne/g, "ユニークコンシェルジュのご利用ありがとうございます。")
                .replace(/TitleHeadThree/g, shopName)
                .replace(/ShopImage/g, shopImg)
                .replace(/ShopGuide/g, "お店の詳しい情報は次のリンクをご確認ください。")
                .replace(/ShopUrl/g, shopUrl)
                .replace(/HomePage/g, "詳細情報")
                .replace(/ExplainTwo/g, "お店の詳しい位置は下記のリンクからご確認ください。")
                .replace(/MapURL/g, shoploc)

            await mail.sendMail(emailAdd, "ユニークコンシェルジュ 店舗情報", mbody)
            this.tell("お店の情報をメールでお送りしました。")
        },
        'OtherShopIntent': function() {
            let shopNum = this.getSessionAttribute('shopNumber') + 1
            this.setSessionAttribute('shopNumber', shopNum)
            this.toIntent('ShopIntent')
        },

    },

    'HelpIntent': function() {
        this.ask("ユニークコンシェルジュではあなたのスケジュールをあなたの代わりに管理いたします。直近の予定が知りたい場合はユニークコンシェルジュで「次の予定は」と聞いてみてください。さらに詳しい情報が知りたいときはアレクサアプリのスキルページを参照してください。")
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
        this.tell("またのご利用をお待ちしてます。")
    },

}

const googleHandler = {
    'LAUNCH': function() {
        this.toIntent('WelcomeIntent')
    },

    'WelcomeIntent': function() {
        // this.googleAction().askForName("ユニークコンシェルジュです。ユーザーデータへのアクセスを許可してください。")

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
        this.tell("またのご利用をお待ちしてます。")
    }
}

app.setHandler(alexaHandler)
app.setAlexaHandler(alexaHandler)
app.setGoogleActionHandler(googleHandler)
module.exports.app = app;