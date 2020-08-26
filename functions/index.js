const functions = require('firebase-functions');

const admin = require('firebase-admin');
admin.initializeApp();

exports.notifyNewMessage = functions.firestore.document('chatChannels/{channel}/messages/{message}')
    .onCreate((docSnapshot, context) => {
        const message = docSnapshot.data();
        const recipientId = message['recipientId'];
        const senderName = message['senderName'];

        return admin.firestore().doc('users/' + recipientId).get().then(userDoc => {
            const registrationTokens = userDoc.get('registrationTokens');

            var notificationBody = "";
            switch (message['type']) {
                case 9023:
                    notificationBody = message['text'];
                    break;
                case 1289:
                    notificationBody = (message['text'] === "") ? "📸 Photo" : "📸 " + message['text'];
                    break;
                case 4590:
                    notificationBody = "📄 " + message['fileName'];
                    break;
                default:
                    notificationBody = "";
            }
            const payload = {
                notification: {
                    title: senderName + " sent you a message",
                    body: notificationBody,
                    clickAction: "ShowNewMessage",
                    sound: "default"
                },
                data: {
                    otherUserId: message['senderId'],
                    otherUserName: senderName,
                    currentUserName: userDoc.get('firstName') + " " + userDoc.get('lastName')
                }
            };

            return admin.messaging().sendToDevice(registrationTokens, payload).then(response => {
                const stillRegisteredTokens = registrationTokens

                response.results.forEach((result, index) => {
                    const error = result.error
                    if (error) {
                        const failedRegistrationToken = registrationTokens[index]
                        console.error('blah', failedRegistrationToken, error)
                        if (error.code === 'messaging/invalid-registration-token' ||
                            error.code === 'messaging/registration-token-not-registered') {
                            const failedIndex = stillRegisteredTokens.indexOf(failedRegistrationToken)
                            if (failedIndex > -1) {
                                stillRegisteredTokens.splice(failedIndex, 1)
                            }
                        }
                    }
                })

                return admin.firestore().doc("users/" + recipientId).update({
                    registrationTokens: stillRegisteredTokens
                });
            });
        });
    });

exports.notifyNewPost = functions.firestore.document('posts/{post}')
    .onCreate((docSnapshot, context) => {
        const newPost = docSnapshot.data();
        const uid = newPost['uid'];

        return admin.firestore().doc('users/' + uid).get().then(userDoc => {
            const followers = userDoc.get('followers');

            followers.forEach(followerUid => {
                sendPostNotification(followerUid, newPost);
            });
        })
    })

function sendPostNotification(followerUid, post) {
    return admin.firestore().doc('users/' + followerUid).get().then(userDoc => {
        const registrationTokens = userDoc.get('registrationTokens')

        if (Array.isArray(registrationTokens) && registrationTokens.length) {
            const notificationBody = (post['imagePost'] === true) ? "📸 Photo" : post['postDescription'];

            const payload = {
                notification: {
                    title: post['userName'] + " just made a post",
                    body: notificationBody,
                    clickAction: "ShowNewPost",
                    sound: "default"
                },
                data: {
                    postJson: JSON.stringify(post),
                    currentUserName: userDoc.get('firstName') + " " + userDoc.get('lastName')
                }
            }

            return admin.messaging().sendToDevice(registrationTokens, payload).then(response => {
                const stillRegisteredTokens = registrationTokens;

                response.results.forEach((result, index) => {
                    const error = result.error
                    if (error) {
                        const failedRegistrationToken = registrationTokens[index]
                        console.error('blah', failedRegistrationToken, error)
                        if (error.code === 'messaging/invalid-registration-token' ||
                            error.code === 'messaging/registration-token-not-registered') {
                            const failedIndex = stillRegisteredTokens.indexOf(failedRegistrationToken)
                            if (failedIndex > -1) {
                                stillRegisteredTokens.splice(failedIndex, 1)
                            }
                        }
                    }
                })

                return admin.firestore().doc("users/" + followerUid).update({
                    registrationTokens: stillRegisteredTokens
                })
            })
        }
        return;
    })
}