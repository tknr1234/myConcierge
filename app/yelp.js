'use strict';

// const apiKey = 'aKG7KdRpMYR4uwhpqNcJzcspmXTQ36fUN80os1QyWICDylZMFXanOHYvCeUH8MgSlpc6kbAE5v_TmVgVvKewAFP_BgK9adaMnaaBgUB5fRaVThANqlzbLZ9n0frsW3Yx' //環境変数に移行予定


module.exports = class YelpFusion {
    constructor(apiKey) {
        this.apiKey = apiKey
        this.yelp = require('yelp-fusion')
        this.client = this.yelp.client(this.apiKey)
    }

    searchShop(keyword, location, categories) {
        return new Promise((resolve, reject) => {
            this.client.search({
                'term': keyword,
                'location': location,
                'sort_by': 'distance',
                'categories':categories,
                'limit': 20
            }).then(response => {
                resolve(response.jsonBody)
            }).catch(e => {
            	console.log('Yelp Error')
            	console.log(e)
                reject(e)
            });
        })
    }
}

//APIデバッグ
// (async () => {
//     const result1 = new YelpFusion(null, '後楽園')
//     console.log(await result1.searchShop())
// })();