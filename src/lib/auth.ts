/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut, signInWithCredential } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const provider = new GoogleAuthProvider();
// Add required Workspace scopes
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.readonly');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Try loading token from sessionStorage for session persistence (safe for page refresh within the same tab)
  const sessionToken = sessionStorage.getItem('event_qr_token');
  if (sessionToken) {
    cachedAccessToken = sessionToken;
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Clear if we have a user but no token
        cachedAccessToken = null;
        sessionStorage.removeItem('event_qr_token');
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      sessionStorage.removeItem('event_qr_token');
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Start Google sign-in
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  // Check if we are inside an iframe
  let inIframe = false;
  try {
    inIframe = window.self !== window.top;
  } catch (e) {
    inIframe = true;
  }

  if (inIframe) {
    console.log('App is in iframe. Launching Google Auth popup bridge...');
    // We are inside an iframe. Let's open our own page as a top-level popup!
    const authUrl = `${window.location.origin}${window.location.pathname}?auth_popup=true`;
    
    const popup = window.open(
      authUrl,
      'google_auth_popup',
      'width=550,height=680,status=no,resizable=yes,scrollbars=yes'
    );

    if (!popup) {
      throw new Error('Popup blocked! Please allow popups for this site to complete Google Sign-In.');
    }

    // Wait for the popup to post back the credentials
    return new Promise((resolve, reject) => {
      let resolved = false;

      const handleMessage = async (event: MessageEvent) => {
        // Accept messages from our origin
        if (event.origin !== window.location.origin) return;

        if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
          resolved = true;
          window.removeEventListener('message', handleMessage);
          
          const { user, accessToken, idToken } = event.data;
          console.log('Received auth credentials from popup bridge.');
          
          // Sign in the local iframe's Firebase Auth using signInWithCredential
          try {
            const credential = GoogleAuthProvider.credential(idToken, accessToken);
            const signInResult = await signInWithCredential(auth, credential);
            
            cachedAccessToken = accessToken;
            sessionStorage.setItem('event_qr_token', accessToken);
            
            resolve({ user: signInResult.user, accessToken });
          } catch (e: any) {
            console.error('Error signing in iframe Firebase Auth with credentials:', e);
            // Fallback: manually update memory and sessionStorage if signInWithCredential gets restricted
            cachedAccessToken = accessToken;
            sessionStorage.setItem('event_qr_token', accessToken);
            resolve({ user, accessToken });
          }
        } else if (event.data?.type === 'GOOGLE_AUTH_FAILURE') {
          resolved = true;
          window.removeEventListener('message', handleMessage);
          reject(new Error(event.data.error || 'Authentication failed.'));
        }
      };

      window.addEventListener('message', handleMessage);

      // Check if popup closed
      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer);
          window.removeEventListener('message', handleMessage);
          if (!resolved) {
            reject(new Error('Sign-in process cancelled: Popup closed before completion.'));
          }
        }
      }, 1000);
    });
  }

  // If top-level, we can do signInWithPopup directly
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to retrieve access token from Google sign-in credential');
    }

    const idToken = await result.user.getIdToken();
    cachedAccessToken = credential.accessToken;
    sessionStorage.setItem('event_qr_token', cachedAccessToken);
    
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken || sessionStorage.getItem('event_qr_token');
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  sessionStorage.removeItem('event_qr_token');
};
