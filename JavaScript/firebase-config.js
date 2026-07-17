import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDXk4lFffc5KydG7rgTV-nwJkw0GJtArR4",
  authDomain: "uk-quran-lms.firebaseapp.com",
  databaseURL: "https://uk-quran-lms-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "uk-quran-lms",
  storageBucket: "uk-quran-lms.firebasestorage.app",
  messagingSenderId: "1017438089574",
  appId: "1:1017438089574:web:681f40110377da777d18a7"
};

// Initialize and Export Firebase so ALL files can use it safely
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const database = getDatabase(app);

// Secondary app — only used to create student logins without disturbing
const secondaryApp = initializeApp(firebaseConfig, "Secondary");
export const secondaryAuth = getAuth(secondaryApp);