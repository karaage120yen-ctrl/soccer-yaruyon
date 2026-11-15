// サッカーやるよん：Firebase との接続（ログインとデータ保存・ルーム対戦）
// ゲーム本体は window.KJNET を通してここを使う。設定は firebase-config.js に書く。
const done = (v) => { if (window.__kjResolve) window.__kjResolve(v); };
const cfg = window.FIREBASE_CONFIG;

if (!cfg || !cfg.apiKey || /ここに|YOUR/.test(cfg.apiKey)) {
  console.warn('firebase-config.js がまだ設定されていません。オフラインで動きます。');
  done(null);
} else {
  start().catch((e) => { console.error(e); done(null); });
}

async function start() {
    const V = 'https://www.gstatic.com/firebasejs/10.12.2/';
    const [{ initializeApp }, A, F] = await Promise.all([
      import(V + 'firebase-app.js'), import(V + 'firebase-auth.js'), import(V + 'firebase-firestore.js')
    ]);
    const { getAuth, onAuthStateChanged, signInAnonymously, GoogleAuthProvider,
      signInWithPopup, linkWithPopup, signInWithCredential, signOut } = A;
    const { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot } = F;
    const app = initializeApp(cfg);
    const auth = getAuth(app);
    const fs = getFirestore(app);

    // Firestore は undefined を保存できないので、JSONを通して取り除く
    const clean = (o) => JSON.parse(JSON.stringify(o));
    const mapErr = (e) => ({
      code: e && e.code === 'permission-denied' ? 'invalid_argument'
        : e && e.code === 'unavailable' ? 'unavailable'
        : (e && e.code) || 'unavailable',
      message: (e && e.message) || ''
    });
    const wrap = (s) => ({ id: s.id, exists: s.exists(), data: () => (s.exists() ? s.data() : undefined) });

    const db = {
      doc(path) {
        const r = doc(fs, path);
        return {
          id: r.id, path,
          get: () => getDoc(r).then(wrap).catch((e) => { throw mapErr(e); }),
          set: (d) => setDoc(r, clean(d)).catch((e) => { throw mapErr(e); }),
          update: (d) => updateDoc(r, clean(d)).catch((e) => { throw mapErr(e); }),
          delete: () => deleteDoc(r).catch((e) => { throw mapErr(e); }),
          onSnapshot: (next, err) => onSnapshot(r, (s) => next(wrap(s)), (e) => { if (err) err(mapErr(e)); })
        };
      }
    };

    const subs = [];
    let cur; // undefined = まだ不明、null = ログインできていない
    const info = (u) => (u ? { uid: u.uid, anon: u.isAnonymous, name: u.displayName || '' } : null);
    const notify = () => subs.forEach((f) => { try { f(cur); } catch (e) { console.error(e); } });

    // ログインしていなければ、まずゲスト（匿名）でログインする
    onAuthStateChanged(auth, (u) => {
      if (!u) {
        signInAnonymously(auth).catch((e) => { console.error(e); cur = null; notify(); });
        return;
      }
      cur = info(u);
      notify();
    });

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    window.KJNET = {
      db,
      onUser(f) { subs.push(f); if (cur !== undefined) f(cur); },
      info: () => cur,
      // ゲストのデータを引き継いだまま Google アカウントにつなぐ
      async signInGoogle() {
        const u = auth.currentUser;
        try {
          if (u && u.isAnonymous) await linkWithPopup(u, provider);
          else await signInWithPopup(auth, provider);
        } catch (e) {
          // その Google アカウントがすでに使われている → そちらに切り替える
          if (e && (e.code === 'auth/credential-already-in-use' || e.code === 'auth/email-already-in-use')) {
            const c = GoogleAuthProvider.credentialFromError(e);
            if (c) { await signInWithCredential(auth, c); return; }
          }
          throw e;
        }
        cur = info(auth.currentUser);
        notify();
      },
      async signOut() { await signOut(auth); }
    };
    done(window.KJNET);
}
