// ── Firebase ─────────────────────────────────────────────────────────────────
import { initializeApp }  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, push } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const app = initializeApp({
  apiKey:            "AIzaSyD-ORsWbbxW5mPcoaJNwANezYxSuasvmz0",
  authDomain:        "ayhaandatabase.firebaseapp.com",
  databaseURL:       "https://ayhaandatabase-default-rtdb.firebaseio.com",
  projectId:         "ayhaandatabase",
  storageBucket:     "ayhaandatabase.firebasestorage.app",
  messagingSenderId: "395476273875",
  appId:             "1:395476273875:web:949675fa3461738a8b2226"
});
const db = getDatabase(app);

const WHATSAPP = "918590529249";

// ── Loader ───────────────────────────────────────────────────────────────────
window.addEventListener('load', () => {
  setTimeout(() => {
    const l = document.getElementById('loader');
    if (l) { l.classList.add('fade-out'); setTimeout(() => l.remove(), 900); }
  }, 1200);
});

// ── Cart ─────────────────────────────────────────────────────────────────────
let cart = JSON.parse(localStorage.getItem('ao_cart') || '[]');
const saveCart = () => localStorage.setItem('ao_cart', JSON.stringify(cart));

const updateCount = () => {
  const n = cart.reduce((s, i) => s + i.qty, 0);
  const el = document.getElementById('cart-count');
  if (!el) return;
  el.textContent = n;
  el.style.display = n > 0 ? 'flex' : 'none';
};

const addToCart = p => {
  const ex = cart.find(i => i.id === p.id);
  ex ? ex.qty++ : cart.push({ ...p, qty: 1 });
  saveCart(); updateCount(); renderCart(); openCart();
};

window._rm  = id => { cart = cart.filter(i => i.id !== id); saveCart(); updateCount(); renderCart(); };
window._qty = (id, d) => {
  const it = cart.find(i => i.id === id);
  if (!it) return;
  it.qty += d;
  if (it.qty <= 0) { window._rm(id); return; }
  saveCart(); updateCount(); renderCart();
};

const renderCart = () => {
  const body   = document.getElementById('cart-body');
  const footer = document.getElementById('cart-footer');
  const tot    = document.getElementById('cart-total');
  if (!body) return;

  if (!cart.length) {
    body.innerHTML = '<p class="cart-empty">Your cart is empty.</p>';
    if (footer) footer.style.display = 'none';
    return;
  }

  body.innerHTML = cart.map(i => `
    <div class="cart-item">
      <img src="${i.image || ''}" alt="${i.name}" onerror="this.style.display='none'">
      <div class="cart-item-info">
        <div class="cart-item-name">${i.name}</div>
        <div class="cart-item-price">₹${Number(i.price).toLocaleString('en-IN')}</div>
        <div class="qty-control">
          <button class="qty-btn" onclick="window._qty('${i.id}',-1)">−</button>
          <span>${i.qty}</span>
          <button class="qty-btn" onclick="window._qty('${i.id}',1)">+</button>
        </div>
      </div>
      <button class="cart-item-remove" onclick="window._rm('${i.id}')">&times;</button>
    </div>`).join('');

  const total = cart.reduce((s, i) => s + i.qty * Number(i.price), 0);
  if (tot) tot.textContent = `₹${total.toLocaleString('en-IN')}`;
  if (footer) footer.style.display = 'block';
};

// ── Drawer / Modal helpers ────────────────────────────────────────────────────
const ov  = document.getElementById('overlay');
const cd  = document.getElementById('cart-drawer');
const chm = document.getElementById('checkout-modal');
const sm  = document.getElementById('success-modal');

const openCart    = () => { cd?.classList.add('open');    ov?.classList.add('open');    };
const closeCart   = () => { cd?.classList.remove('open'); ov?.classList.remove('open'); };
const openCheck   = () => { closeCart(); chm?.classList.add('open');    ov?.classList.add('open');    };
const closeCheck  = () => { chm?.classList.remove('open'); ov?.classList.remove('open'); };
const openSuccess = () => { sm?.classList.add('open');    ov?.classList.add('open');    };
const closeAll    = () => { closeCart(); closeCheck(); sm?.classList.remove('open'); ov?.classList.remove('open'); };

document.getElementById('open-cart-btn')?.addEventListener('click', openCart);
document.getElementById('close-cart-btn')?.addEventListener('click', closeCart);
document.getElementById('checkout-btn')?.addEventListener('click', openCheck);
document.getElementById('back-to-cart-btn')?.addEventListener('click', () => { closeCheck(); openCart(); });
document.getElementById('close-checkout-btn')?.addEventListener('click', closeCheck);
document.getElementById('continue-shopping-btn')?.addEventListener('click', closeAll);
ov?.addEventListener('click', closeAll);

// ── Order Submit → WhatsApp ───────────────────────────────────────────────────
document.getElementById('checkout-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const get = id => document.getElementById(id)?.value.trim();
  const name    = get('co-name');
  const phone   = get('co-phone');
  const address = get('co-address');
  const city    = get('co-city');
  const state   = get('co-state');
  const pincode = get('co-pincode');

  if (!name || !phone || !address || !city || !state || !pincode) {
    alert('Please fill all required fields.'); return;
  }

  const total = cart.reduce((s, i) => s + i.qty * Number(i.price), 0);
  const order = {
    customer: { name, phone, address, city, state, pincode },
    items: cart.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
    total,
    createdAt: new Date().toISOString()
  };

  const btn = document.getElementById('place-order-btn');
  btn.disabled = true; btn.textContent = 'Placing…';

  try {
    await push(ref(db, 'ayhaan/orders'), order);

    // Build WhatsApp message
    const itemsText = cart.map(i => `• ${i.name} ×${i.qty} = ₹${(i.qty * Number(i.price)).toLocaleString('en-IN')}`).join('\n');
    const msg = encodeURIComponent(
      `🛍 *New Order — Ayhaan Opulent*\n\n` +
      `*Customer:* ${name}\n*Phone:* ${phone}\n` +
      `*Address:* ${address}, ${city}, ${state} - ${pincode}\n\n` +
      `*Items:*\n${itemsText}\n\n` +
      `*Total: ₹${total.toLocaleString('en-IN')}*`
    );
    window.open(`https://wa.me/${WHATSAPP}?text=${msg}`, '_blank');

    cart = []; saveCart(); updateCount(); renderCart();
    closeCheck(); openSuccess();
    document.getElementById('checkout-form')?.reset();
  } catch (err) {
    alert('Failed to place order. Please try again.'); console.error(err);
  } finally {
    btn.disabled = false; btn.textContent = 'Place Order';
  }
});

// ── Logo ──────────────────────────────────────────────────────────────────────
onValue(ref(db, 'ayhaan/settings/logo'), snap => {
  const logo = snap.val();
  const link = document.getElementById('logo-link');
  if (link && logo) link.innerHTML = `<img src="${logo}" alt="Ayhaan Opulent">`;
});

// ── Hero Slider ───────────────────────────────────────────────────────────────
let curSlide = 0, timer;

onValue(ref(db, 'ayhaan/settings/slider'), snap => {
  const sc   = document.getElementById('slider-container');
  const ctrl = document.getElementById('slider-controls');
  if (!sc || !ctrl) return;
  sc.innerHTML = ''; ctrl.innerHTML = '';

  const items = [];
  snap.forEach(c => items.push(c.val()));

  if (!items.length) {
    sc.innerHTML = `<div class="slide active" style="background:linear-gradient(135deg,#1a1a1a,#2d2418)">
      <div class="slide-content"><h2>Ayhaan Opulent</h2><p>Exquisite jewelry for every occasion</p>
      <a href="#products" class="btn-primary">Explore</a></div></div>`;
    return;
  }

  items.forEach((h, i) => {
    const s = document.createElement('div');
    s.className = `slide${i === 0 ? ' active' : ''}`;
    s.style.backgroundImage = `url('${h.image || h.imageUrl || ''}')`;
    s.innerHTML = `<div class="slide-content"><h2>${h.title || ''}</h2><p>${h.subtitle || ''}</p>
      <a href="#products" class="btn-primary">Explore Collection</a></div>`;
    sc.appendChild(s);

    const dot = document.createElement('div');
    dot.className = `dot${i === 0 ? ' active' : ''}`;
    dot.addEventListener('click', () => goTo(i));
    ctrl.appendChild(dot);
  });

  clearInterval(timer);
  timer = setInterval(() => goTo((curSlide + 1) % items.length), 5000);
});

const goTo = idx => {
  const slides = document.querySelectorAll('.slide');
  const dots   = document.querySelectorAll('.dot');
  if (!slides.length) return;
  slides[curSlide]?.classList.remove('active');
  dots[curSlide]?.classList.remove('active');
  curSlide = (idx + slides.length) % slides.length;
  slides[curSlide]?.classList.add('active');
  dots[curSlide]?.classList.add('active');
};

document.getElementById('prev-slide')?.addEventListener('click', () => { goTo(curSlide - 1); clearInterval(timer); timer = setInterval(() => goTo(curSlide + 1), 5000); });
document.getElementById('next-slide')?.addEventListener('click', () => { goTo(curSlide + 1); clearInterval(timer); timer = setInterval(() => goTo(curSlide + 1), 5000); });

// ── Categories ────────────────────────────────────────────────────────────────
onValue(ref(db, 'ayhaan/categories'), snap => {
  const cc = document.getElementById('categories-container');
  if (!cc) return;
  cc.innerHTML = '';
  if (!snap.exists()) { cc.innerHTML = '<p style="text-align:center;padding:3rem;color:#7A7A7A;grid-column:1/-1">No collections yet.</p>'; return; }

  snap.forEach(child => {
    const c   = child.val();
    const div = document.createElement('div');
    div.className = 'category-card';
    div.innerHTML = `
      <img src="${c.image || c.imageUrl || ''}" alt="${c.name}" loading="lazy">
      <div class="category-title">${c.name}</div>`;
    div.addEventListener('click', () => filterBy(c.name));
    cc.appendChild(div);
  });
});

// ── Products ──────────────────────────────────────────────────────────────────
let allProds = [];

onValue(ref(db, 'ayhaan/products'), snap => {
  allProds = [];
  snap.forEach(c => allProds.push({ id: c.key, ...c.val() }));
  buildFilters();
  renderProds('all');
});

const buildFilters = () => {
  const bar = document.getElementById('filter-bar');
  if (!bar) return;
  const cats = [...new Set(allProds.map(p => p.category).filter(Boolean))];
  bar.innerHTML =
    `<button class="filter-btn active" onclick="window._flt('all',this)">All</button>` +
    cats.map(c => `<button class="filter-btn" onclick="window._flt('${c}',this)">${c}</button>`).join('');
};

window._flt = (cat, btn) => {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn?.classList.add('active');
  filterBy(cat);
};

const filterBy = cat => {
  document.querySelectorAll('.filter-btn').forEach(b => { if (b.textContent === cat || (cat === 'all' && b.textContent === 'All')) b.classList.add('active'); else b.classList.remove('active'); });
  renderProds(cat);
};

const renderProds = cat => {
  const pc = document.getElementById('products-container');
  if (!pc) return;
  const list = cat === 'all' ? allProds : allProds.filter(p => p.category === cat);
  if (!list.length) { pc.innerHTML = '<p style="grid-column:1/-1;text-align:center;padding:3rem;color:#7A7A7A">No products found.</p>'; return; }

  pc.innerHTML = list.map(p => `
    <div class="product-card">
      <div class="product-img-wrap">
        <img src="${p.image || p.imageUrl || ''}" alt="${p.name}" class="product-image" loading="lazy">
        <button class="product-quick-add" onclick="window._add('${p.id}')">Quick Add</button>
      </div>
      <div class="product-info">
        <h3 class="product-name">${p.name}</h3>
        <div class="product-price">₹${Number(p.price).toLocaleString('en-IN')}</div>
        <p class="product-desc">${p.description || p.desc || ''}</p>
        <button class="btn-primary btn-full product-cart-btn" onclick="window._add('${p.id}')">Add to Cart</button>
      </div>
    </div>`).join('');
};

window._add = id => { const p = allProds.find(p => p.id === id); if (p) addToCart(p); };

// ── Init ──────────────────────────────────────────────────────────────────────
updateCount();
renderCart();
