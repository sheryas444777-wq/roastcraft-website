import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import {
  get,
  getDatabase,
  ref,
  remove,
  set
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDSUfLRu1Wp28k0ltUAjxCPeS2JO79xfQ0",
  authDomain: "fewd-database.firebaseapp.com",
  projectId: "fewd-database",
  storageBucket: "fewd-database.firebasestorage.app",
  messagingSenderId: "341909619247",
  appId: "1:341909619247:web:b5d9cf0c5bef91310a7cda",
  measurementId: "G-1PG7C1ZS4P",
  databaseURL: "https://fewd-database-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const LOCAL_CART_KEY = "roastcraft-cart";
const LOCAL_USER_KEY = "roastcraft-user";
const LOCAL_USERS_KEY = "roastcraft-users";

let currentUser = null;
let authResolved = false;
const authListeners = [];
let useLocalAuth = window.location.protocol === "file:";

if (useLocalAuth) {
  currentUser = readLocalUser();
  authResolved = true;
  updateAuthButtons(currentUser);
  notifyAuthListeners(currentUser);
} else {
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;

    try {
      if (user) {
        await syncLocalCartToFirebase(user.uid);
      }
    } catch {
      enableLocalAuthFallback(user);
      return;
    }

    authResolved = true;
    updateAuthButtons(user);
    notifyAuthListeners(user);
  });
}

function notifyAuthListeners(user) {
  authListeners.forEach((listener) => listener(user));
}

function createLocalUserRecord(user) {
  if (!user) return null;

  return {
    uid: user.uid || `local-${Date.now()}`,
    email: user.email || "",
    displayName: user.displayName || user.email || "Account"
  };
}

function readLocalUser() {
  try {
    const raw = localStorage.getItem(LOCAL_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLocalUser(user) {
  if (!user) {
    localStorage.removeItem(LOCAL_USER_KEY);
    return;
  }

  localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(createLocalUserRecord(user)));
}

function readLocalUsers() {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalUsers(users) {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
}

function enableLocalAuthFallback(user = null) {
  useLocalAuth = true;
  currentUser = user ? createLocalUserRecord(user) : readLocalUser();
  writeLocalUser(currentUser);
  authResolved = true;
  updateAuthButtons(currentUser);
  notifyAuthListeners(currentUser);
}

function cloneCart(items) {
  return items.map((item) => ({
    name: item.name,
    price: Number(item.price),
    qty: Number(item.qty)
  }));
}

function readLocalCart() {
  try {
    const raw = localStorage.getItem(LOCAL_CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? cloneCart(parsed) : [];
  } catch {
    return [];
  }
}

function writeLocalCart(items) {
  localStorage.setItem(LOCAL_CART_KEY, JSON.stringify(cloneCart(items)));
}

function normaliseCart(data) {
  if (!data) return [];
  const list = Array.isArray(data) ? data : Object.values(data);
  return list
    .filter((item) => item && item.name)
    .map((item) => ({
      name: item.name,
      price: Number(item.price),
      qty: Number(item.qty) || 1
    }));
}

async function readRemoteCart(uid) {
  const snapshot = await get(ref(db, "carts/" + uid));
  return snapshot.exists() ? normaliseCart(snapshot.val()) : [];
}

async function writeRemoteCart(uid, items) {
  if (!items.length) {
    await remove(ref(db, "carts/" + uid));
    return;
  }

  const cartObject = {};
  cloneCart(items).forEach((item, index) => {
    cartObject[index] = item;
  });
  await set(ref(db, "carts/" + uid), cartObject);
}

function mergeCartLists(baseItems, incomingItems) {
  const merged = cloneCart(baseItems);

  incomingItems.forEach((incoming) => {
    const existing = merged.find((item) => item.name === incoming.name);
    if (existing) {
      existing.qty += incoming.qty;
    } else {
      merged.push({ ...incoming });
    }
  });

  return merged;
}

async function syncLocalCartToFirebase(uid) {
  const localItems = readLocalCart();
  const remoteItems = await readRemoteCart(uid);
  const mergedItems = mergeCartLists(remoteItems, localItems);

  await writeRemoteCart(uid, mergedItems);
  writeLocalCart(mergedItems);
}

function updateAuthButtons(user) {
  document.querySelectorAll(".order-btn").forEach((button) => {
    if (user) {
      const displayName = user.displayName || user.email || "Account";
      button.textContent = "Hi, " + displayName.split(" ")[0];
      button.href = "signin.html";
    } else {
      button.textContent = "Sign In";
      button.href = "signin.html";
    }
  });
}

export function getCurrentUser() {
  return currentUser;
}

export function onUserChange(callback) {
  authListeners.push(callback);

  if (authResolved) {
    callback(currentUser);
  }
}

export async function waitForAuthReady() {
  if (authResolved) return currentUser;

  return new Promise((resolve) => {
    onUserChange((user) => resolve(user));
  });
}

export async function getCartItems() {
  await waitForAuthReady();

  if (useLocalAuth || !currentUser) {
    return readLocalCart();
  }

  try {
    const remoteItems = await readRemoteCart(currentUser.uid);
    writeLocalCart(remoteItems);
    return remoteItems;
  } catch {
    enableLocalAuthFallback(currentUser);
    return readLocalCart();
  }
}

export async function saveCartItems(items) {
  const cartItems = cloneCart(items);
  writeLocalCart(cartItems);

  if (useLocalAuth || !currentUser) {
    return;
  }

  try {
    await writeRemoteCart(currentUser.uid, cartItems);
  } catch {
    enableLocalAuthFallback(currentUser);
  }
}

export async function addItemToCart(name, price, qty = 1) {
  const cartItems = await getCartItems();
  const amount = Math.max(1, Number(qty) || 1);
  const existing = cartItems.find((item) => item.name === name);

  if (existing) {
    existing.qty += amount;
  } else {
    cartItems.push({ name, price: Number(price), qty: amount });
  }

  await saveCartItems(cartItems);
  return cartItems;
}

export async function updateCartItemQuantity(index, qty) {
  const cartItems = await getCartItems();
  const item = cartItems[index];

  if (!item) {
    return cartItems;
  }

  item.qty = Math.max(1, Number(qty) || 1);
  await saveCartItems(cartItems);
  return cartItems;
}

export async function removeCartItem(index) {
  const cartItems = await getCartItems();
  cartItems.splice(index, 1);
  await saveCartItems(cartItems);
  return cartItems;
}

export async function clearCart() {
  await saveCartItems([]);
}

export async function signInUser(email, password) {
  if (useLocalAuth) {
    const users = readLocalUsers();
    const user = users.find((entry) => entry.email === email && entry.password === password);

    if (!user) {
      const error = new Error("Invalid email or password.");
      error.code = "auth/invalid-credential";
      throw error;
    }

    currentUser = createLocalUserRecord(user);
    writeLocalUser(currentUser);
    updateAuthButtons(currentUser);
    notifyAuthListeners(currentUser);
    localStorage.setItem("userName", currentUser.displayName || currentUser.email || "");
    return currentUser;
  }

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const user = credential.user;
    localStorage.setItem("userName", user.displayName || user.email || "");
    return user;
  } catch (error) {
    if (window.location.protocol === "file:" || error.code === "auth/network-request-failed") {
      enableLocalAuthFallback();
      return signInUser(email, password);
    }
    throw error;
  }
}

export async function signUpUser({ firstName, lastName, email, password }) {
  const displayName = `${firstName} ${lastName}`.trim();

  if (useLocalAuth) {
    const users = readLocalUsers();
    const existingUser = users.find((entry) => entry.email === email);

    if (existingUser) {
      const error = new Error("Email already in use.");
      error.code = "auth/email-already-in-use";
      throw error;
    }

    const user = {
      uid: `local-${Date.now()}`,
      firstName,
      lastName,
      email,
      password,
      displayName,
      createdAt: new Date().toISOString(),
      discountCode: "WELCOME15",
      isNewUser: true
    };

    users.push(user);
    writeLocalUsers(users);
    currentUser = createLocalUserRecord(user);
    writeLocalUser(currentUser);
    updateAuthButtons(currentUser);
    notifyAuthListeners(currentUser);
    localStorage.setItem("userName", displayName);
    localStorage.setItem("isNewUser", "true");
    return currentUser;
  }

  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const user = credential.user;

    await updateProfile(user, { displayName });
    await set(ref(db, "users/" + user.uid), {
      firstName,
      lastName,
      email,
      createdAt: new Date().toISOString(),
      discountCode: "WELCOME15",
      isNewUser: true
    });

    localStorage.setItem("userName", displayName);
    localStorage.setItem("isNewUser", "true");
    return user;
  } catch (error) {
    if (window.location.protocol === "file:" || error.code === "auth/network-request-failed") {
      enableLocalAuthFallback();
      return signUpUser({ firstName, lastName, email, password });
    }
    throw error;
  }
}

export async function signOutUser() {
  if (!useLocalAuth) {
    try {
      await signOut(auth);
    } catch {
      enableLocalAuthFallback(currentUser);
    }
  }

  currentUser = null;
  writeLocalUser(null);
  updateAuthButtons(null);
  notifyAuthListeners(null);
  localStorage.removeItem("userName");
}
