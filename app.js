import { db, ref, onValue, showToast } from './firebase-config.js';

// --- Dynamic Logo ---
const logoRef = ref(db, 'branding/logo');
onValue(logoRef, (snapshot) => {
    const logoUrl = snapshot.val();
    const logoImg = document.getElementById('storefrontLogoImg');
    const logoText = document.getElementById('storefrontLogoText');
    if (logoUrl) {
        logoImg.src = logoUrl;
        logoImg.classList.remove('hidden');
        logoText.classList.add('hidden');
    } else {
        logoImg.classList.add('hidden');
        logoText.classList.remove('hidden');
    }
});

// --- Cart Logic ---
let cart = JSON.parse(localStorage.getItem('cart')) || [];
const WHATSAPP_NUMBER = '919876543210'; // Required dummy number

function updateCartUI() {
    const bagCount = document.getElementById('bagCount');
    const bagItemsContainer = document.getElementById('bagItemsContainer');
    const cartTotalValue = document.getElementById('cartTotalValue');
    
    // Total items count
    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    bagCount.innerText = totalCount;

    if (cart.length === 0) {
        bagItemsContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); margin-top: 2rem;">Your bag is currently empty.</p>';
        cartTotalValue.innerText = '₹0';
        return;
    }

    let html = '';
    let total = 0;
    cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        html += `
            <div class="cart-item">
                <img src="${item.img}" alt="${item.name}" class="cart-item-img">
                <div class="cart-item-details">
                    <div class="cart-item-title">${item.name}</div>
                    <div class="cart-item-price">₹${item.price} x ${item.quantity}</div>
                    <button class="remove-item btn" data-index="${index}" style="padding:0; text-align:left; color:var(--danger); border:none; background:none;">Remove</button>
                </div>
            </div>
        `;
    });
    
    bagItemsContainer.innerHTML = html;
    cartTotalValue.innerText = `₹${total}`;

    // Attach remove listeners
    document.querySelectorAll('.remove-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.getAttribute('data-index'));
            removeFromCart(index);
        });
    });
}

function addToCart(product) {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartUI();
    showToast(`${product.name} added to your bag.`, 'success');
}

function removeFromCart(index) {
    cart.splice(index, 1);
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartUI();
    showToast('Item removed from bag.', 'info');
}

// Ensure UI is updated on load
updateCartUI();

// --- Modal Logic ---
const bagModal = document.getElementById('bagModal');
document.getElementById('openBagBtn').addEventListener('click', () => {
    bagModal.classList.add('active');
});
document.getElementById('closeBagBtn').addEventListener('click', () => {
    bagModal.classList.remove('active');
});

// --- Product Grid ---
const productsRef = ref(db, 'products');
onValue(productsRef, (snapshot) => {
    const productsContainer = document.getElementById('productGrid');
    productsContainer.innerHTML = '';
    
    const data = snapshot.val();
    if (!data) {
        productsContainer.innerHTML = '<p style="text-align:center; width:100%; color: var(--text-muted);">No products available currently.</p>';
        return;
    }

    Object.entries(data).forEach(([id, prod]) => {
        const isOutOfStock = prod.stock <= 0;
        
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <div class="product-img-wrapper">
                <img src="${prod.image}" alt="${prod.name}" class="product-img">
                ${isOutOfStock ? '<div class="out-of-stock-overlay"><span class="out-of-stock-text">Out of Stock</span></div>' : ''}
            </div>
            <div class="product-details">
                <h3 class="product-title">${prod.name}</h3>
                <p class="product-desc">${prod.description}</p>
                <div class="product-price">₹${prod.price}</div>
                <div class="product-actions">
                    ${!isOutOfStock ? `
                        <button class="btn btn-outline add-to-cart-btn" data-id="${id}">Add to Bag</button>
                        <button class="btn btn-whatsapp buy-now-btn" data-id="${id}">Buy Now</button>
                    ` : `
                        <button class="btn btn-outline" disabled style="opacity:0.5; cursor:not-allowed;">Sold Out</button>
                    `}
                </div>
            </div>
        `;
        productsContainer.appendChild(card);
    });

    // Attach listeners for dynamic buttons
    document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            const prod = data[id];
            addToCart({ id, name: prod.name, price: prod.price, img: prod.image });
        });
    });

    document.querySelectorAll('.buy-now-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            const prod = data[id];
            const text = `Hello Ayhaan Opulent! I would like to instantly buy:\n- ${prod.name} (₹${prod.price})\nIs it available?`;
            const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
            window.open(url, '_blank');
        });
    });
});

// --- Bulk WhatsApp Checkout ---
document.getElementById('checkoutWhatsappBtn').addEventListener('click', () => {
    if (cart.length === 0) {
        showToast('Your bag is empty!', 'error');
        return;
    }

    let text = "Hello Ayhaan Opulent! I would like to place an order for the following items:\n\n";
    let grandTotal = 0;
    
    cart.forEach((item, i) => {
        const itemTotal = item.price * item.quantity;
        grandTotal += itemTotal;
        text += `${i + 1}. ${item.name} x${item.quantity} - ₹${itemTotal}\n`;
    });
    
    text += `\n*Grand Total: ₹${grandTotal}*\n\nPlease confirm availability and payment details.`;
    
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    
    // Clear cart after checkout
    cart = [];
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartUI();
    bagModal.classList.remove('active');
    showToast('Redirecting to WhatsApp...', 'success');
});
