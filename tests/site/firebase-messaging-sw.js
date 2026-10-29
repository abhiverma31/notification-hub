/* global firebase */

firebase.initializeApp({
  apiKey: 'AIzaSyCfPUWKAJvOISpRVAjtkHoNcX0ImomTWLY',
  authDomain: 'aarambh-87cdd.firebaseapp.com',
  projectId: 'aarambh-87cdd',
  storageBucket: 'aarambh-87cdd.appspot.com',
  messagingSenderId: '46724638354',
  appId: '1:46724638354:web:00e2e03055af6f942a684b',
  measurementId: 'G-VQC0BQSJPK',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  self.registration.showNotification(payload.notification.title, payload.notification).then(() => {});
});
