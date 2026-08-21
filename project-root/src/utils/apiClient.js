import { getIdToken } from "firebase/auth";
import { getLimitedUseToken } from "firebase/app-check";
import { auth, appCheckInstance } from "../firebase";

/**
 * Calls a protected custom backend endpoint.
 * Limited-use App Check tokens are required because the server verifies
 * replay protection for custom backend requests.
 */
export async function secureApi(path, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in.");

  const [idToken, appCheckToken] = await Promise.all([
    getIdToken(user, true),
    getLimitedUseToken(appCheckInstance),
  ]);

  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      Authorization: `Bearer ${idToken}`,
      "X-Firebase-AppCheck": appCheckToken.token,
    },
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw new Error(body?.error || `Request failed (${response.status})`);
  }
  return body;
}
