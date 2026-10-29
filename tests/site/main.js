/* global firebase */

function displayError(errorMessage) {
  const errorBlock = document.getElementById('error-block');
  const errorsList = document.getElementById('errors');
  const newError = document.createElement('li');
  newError.textContent = errorMessage;
  errorsList.appendChild(newError);
  errorBlock.style.display = 'block';
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker
      .register('/firebase-messaging-sw.js')
      .then(function (registration) {
        console.log('Service Worker is registered', registration);

        const firebaseConfig = {
          apiKey: 'AIzaSyCfPUWKAJvOISpRVAjtkHoNcX0ImomTWLY',
          authDomain: 'aarambh-87cdd.firebaseapp.com',
          projectId: 'aarambh-87cdd',
          storageBucket: 'aarambh-87cdd.appspot.com',
          messagingSenderId: '46724638354',
          appId: '1:46724638354:web:00e2e03055af6f942a684b',
          measurementId: 'G-VQC0BQSJPK',
        };

        firebase.initializeApp(firebaseConfig);
        const messaging = firebase.messaging();

        messaging
          .getToken({
            vapidKey: 'BNm31COF8BI0NYY-Yg6h9np0IL5X_gBosa2m9ecv-fDznnKEFlF7UA9OIZwsxMNyXKeWTRvqFq2kvC8Zh_FJSDA',
          })
          .then((token) => {
            if (token) {
              console.log('Token:', token);
              document.getElementById('tokenDisplay').innerHTML = token;
            } else {
              console.log('No registration token available. Allow notification permission to generate one.');
            }
          })
          .catch((err) => {
            displayError('An error occurred while retrieving token. ' + JSON.stringify(err, null, 2));
          });

        messaging.onMessage((payload) => {
          console.log('Message received. ', payload);
          const li = document.createElement('li');
          li.textContent = JSON.stringify(payload, null, 2);
          document.getElementById('notificationDisplay').prepend(li);

          const emptyNotification = document.getElementById('emptyNotifications');
          if (emptyNotification) {
            emptyNotification.remove();
          }
        });
      })
      .catch(function (error) {
        console.log('Registration failed with ' + error);
        displayError('Registration failed with ' + JSON.stringify(error, null, 2));
      });
  });
}
