'use strict';

// const apiKey = 'AIzaSyBeKVYJ1gQUPLHpslPlhRnFtnZ3bVgmGhY' //環境変数に移行予定


module.exports = class MapsDirections {
    constructor(apiKey) {
        this.googleMapsClient = require('@google/maps').createClient({
            key: apiKey,
            Promise: Promise
        });
    }

    getDirections(mode, origin, destination, arrival) {
        return new Promise((resolve, reject) => {
            this.googleMapsClient.directions({ mode: mode, origin: origin, destination: destination, arrival_time: arrival})
                .asPromise()
                .then((response) => {
                    resolve(response.json);
                })
                .catch((err) => {
                    reject(err);
                });
        })
    }
}

//APIデバッグ
// (async () => {
//     const result1 = new MapsDirections()
//     console.log(await result1.getDirections())
// })();