// Real Google authentication (Firebase Auth).
// If NEXT_PUBLIC_FIREBASE_* keys are set -> true Google OAuth popup with
// FOREVER login (browserLocalPersistence = "infinite" session).
// If keys are missing -> returns { auth: null } and the site uses demo
// email-key login so it still works out of the box.

let cached = null;

export function getFirebaseAuth() {
  if (cached) return cached;
  cached = (async () => {
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!apiKey || !authDomain || !projectId) return { auth: null };
    try {
      const { initializeApp, getApps } = await import("firebase/app");
      const {
        getAuth, setPersistence, browserLocalPersistence,
        GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
      } = await import("firebase/auth");
      const app = getApps().length
        ? getApps()[0]
        : initializeApp({ apiKey, authDomain, projectId });
      const auth = getAuth(app);
      // ♾️ INFINITE session: stays logged in forever on this browser
      try { await setPersistence(auth, browserLocalPersistence); } catch {}
      const provider = new GoogleAuthProvider();
      return {
        auth,
        signIn: () => signInWithPopup(auth, provider),
        signOutNow: () => signOut(auth),
        onAuthStateChanged: (cb) => onAuthStateChanged(auth, cb),
      };
    } catch (e) {
      console.error("Firebase init failed, falling back to demo login:", e);
      return { auth: null };
    }
  })();
  return cached;
}
