'use strict'
const SDK = require('aws-sdk');

module.exports = class Mail {
    async sendMail(mailAddress, subj, text) {
        console.log(mailAddress)
        console.log(text)
        const ses = new SDK.SES({ region: 'us-east-1' });
        const email = {
            // From
            Source: "chkyj_st_titabash@yahoo.co.jp",
            // To
            Destination: { ToAddresses: [mailAddress] },
            Message: {
                // 件名
                Subject: { Data: subj },
                // 本文
                Body: {
                    Html: {
                        Data: text,
                        Charset: 'utf-8'
                    }
                },
            },
        };
        console.log("メール送信")
        const sendEmail = await ses.sendEmail(email).promise();
        console.log(sendEmail)
        console.log("%j", email)
        console.log("送信完了")
    }
}