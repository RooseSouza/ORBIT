// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAJjlvBmAd5i0Vs-95WEH5b0NA2YLUBCi4",
  authDomain: "orbit-e753d.firebaseapp.com",
  projectId: "orbit-e753d",
  storageBucket: "orbit-e753d.firebasestorage.app",
  messagingSenderId: "711782247764",
  appId: "1:711782247764:web:0c3d1ad6eb46467026ecc1",
  measurementId: "G-1SVB80LN4S"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Export them so main.js can use them
export { auth, provider, app };