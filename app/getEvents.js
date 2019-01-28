'use strict';

const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');
const moment = require('moment')
const request = require("request");

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

module.exports = class UserSchedule {
    constructor(token) {
        this.apiToken = token
    }

    getEvents(day) {
        return new Promise((resolve, reject) => {
            const now = moment().toISOString()
            let timeMIN = now
            if(day == 'today'){
                timeMIN = moment(moment().format("YYYY-MM-DD")).utcOffset("+09:00").toISOString(); // 本日の00:00(日本時間)
            }
            const todayMax = moment(moment().format("YYYY-MM-DD")).add(1, 'days').add(-1, 'minutes').utcOffset("+09:00").toISOString(); // 本日の23:59(日本時間)
            request.get({
                url: "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                headers: {
                    "content-type": "application/json",
                    "Authorization": "Bearer " + this.apiToken
                },
                qs: {
                    calendarId: 'primary',
                    timeMin: timeMIN,
                    timeMax: todayMax,
                    maxResults: 10,
                    singleEvents: true,
                    orderBy: 'startTime',
                }
            }, function(error, response, body) {
                if(error){
                    reject(error)
                }
                resolve(body)
            })
        })
    }
}

// (async () => {
//     let token = "ya29.GltaBgj1bXD1pixy1vJh-u8QK6e0GAUnvT9CbtMhVnSjjuDKcH7oYP2wKQlWkxH5YbSmal-E0XM4ec4dFZpuweqVmI_cjqDUplX8pyqYSh8auB_u4cvyDWTt-Eyq"
//     let events = new UserSchedule(token)
//     let result = await events.getEvents()
//     console.log("結果: " + result)
// })();