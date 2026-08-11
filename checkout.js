document.addEventListener('DOMContentLoaded', () => {
  const cart = JSON.parse(localStorage.getItem('ao_cart') || '[]');

  if (cart.length === 0) {
    alert("Your cart is empty. Redirecting to shop.");
    window.location.href = 'index.html';
    return;
  }

  const SUPABASE_URL = "https://orjxoslyjonedljqnzgu.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yanhvc2x5am9uZWRsanFuemd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMTMzMjAsImV4cCI6MjEwMTY4OTMyMH0.dWvnC8CkaUg-uNw2S0rNKklBOwx3ai6bMdI-ZA3RG3I";
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const itemsContainer = document.getElementById('cartItemsContainer');
  let subtotal = 0;

  cart.forEach(item => {
    subtotal += item.price * item.qty;
    itemsContainer.innerHTML += `
      <div class="cart-item">
        <img src="${item.image || 'https://placehold.co/60x75'}" alt="${item.name}">
        <div class="item-info">
          <div class="item-name">${item.name}</div>
          <div class="item-meta">Qty: ${item.qty}</div>
        </div>
        <div class="item-price">₹${item.price * item.qty}</div>
      </div>
    `;
  });

  const totalAmount = subtotal; // Free shipping

  document.getElementById('summarySubtotal').innerText = '₹' + subtotal;
  document.getElementById('summaryTotal').innerText = '₹' + totalAmount;

  function readCheckoutForm() {
    return {
      customer_name: document.getElementById('custName').value,
      customer_email: document.getElementById('custEmail').value,
      customer_phone: document.getElementById('custPhone').value,
      shipping_address: {
        house: document.getElementById('shipHouse').value,
        street: document.getElementById('shipStreet').value,
        city: document.getElementById('shipCity').value,
        district: document.getElementById('shipDistrict').value,
        state: document.getElementById('shipState').value,
        pin: document.getElementById('shipPin').value,
        country: document.getElementById('shipCountry').value,
        instructions: document.getElementById('shipInst').value
      }
    };
  }

  async function createPendingOrder() {
    const orderNumber = 'ORD-' + new Date().getFullYear() + '-' + Math.floor(10000 + Math.random() * 90000);
    const formData = readCheckoutForm();

    const orderData = {
      order_number: orderNumber,
      ...formData,
      subtotal: subtotal,
      total_amount: totalAmount,
      order_status: 'pending',
      payment_status: 'pending'
    };

    const { data: insertedOrder, error: orderError } = await supabase.from('orders').insert([orderData]).select().single();
    if (orderError) throw orderError;

    const orderItemsData = cart.map(item => ({
      order_id: insertedOrder.id,
      product_id: item.id,
      product_name: item.name,
      product_image: item.image,
      quantity: item.qty,
      unit_price: item.price,
      total_price: item.qty * item.price
    }));
    await supabase.from('order_items').insert(orderItemsData);

    return { orderNumber, insertedOrder, orderData };
  }

  const payBtn = document.getElementById('payBtn');
  const paySpinner = document.getElementById('paySpinner');
  const modal = document.getElementById('paymentModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalMessage = document.getElementById('modalMessage');
  const modalIcon = document.getElementById('modalIcon');
  const modalCloseBtn = document.getElementById('modalCloseBtn');

  function showModal(state, title, message) {
    modal.style.display = 'flex';
    modalTitle.textContent = title;
    modalMessage.textContent = message;

    if (state === 'loading') {
      modalIcon.innerHTML = '<div style="width:36px; height:36px; border:3px solid var(--line); border-top-color:var(--gold-deep); border-radius:50%; animation:spin 0.8s linear infinite;"></div>';
      modalCloseBtn.style.display = 'none';
    } else if (state === 'success') {
      modalIcon.innerHTML = '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#2e7d32" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
      modalIcon.style.background = '#e8f5e9';
      modalCloseBtn.style.display = 'inline-block';
      modalCloseBtn.textContent = 'View Order';
      modalCloseBtn.onclick = () => window.location.href = `track-order.html`;
    } else if (state === 'error') {
      modalIcon.innerHTML = '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#c62828" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
      modalIcon.style.background = '#ffebee';
      modalCloseBtn.style.display = 'inline-block';
      modalCloseBtn.textContent = 'Close';
      modalCloseBtn.onclick = () => modal.style.display = 'none';
    }
  }

  payBtn.addEventListener('click', async () => {
    const form = document.getElementById('checkoutForm');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    payBtn.disabled = true;
    paySpinner.style.display = 'inline-block';

    try {
      // 1. Create Pending Order in Supabase DB
      const { orderNumber, orderData } = await createPendingOrder();

      // 2. Call Edge Function to create Razorpay Order
      const { data: rzpOrder, error: createError } = await supabase.functions.invoke('razorpay-handler', {
        body: {
          amount: totalAmount,
          currency: 'INR',
          receipt: orderNumber,
          customer: { name: orderData.customer_name, email: orderData.customer_email }
        }
      });

      if (createError || !rzpOrder) {
        throw new Error((createError && createError.message) || 'Failed to initialize payment gateway.');
      }

      // 3. Setup Razorpay Checkout Options
      const options = {
        key: rzpOrder.key_id, // Passed from edge function
        amount: rzpOrder.amount, // in paise
        currency: rzpOrder.currency,
        name: 'AYHAAN OPULENT',
        description: `Order ${orderNumber}`,
        image: 'https://placehold.co/100x100/2a2622/c5a059?text=AO', // Optional logo
        order_id: rzpOrder.order_id,
        handler: async function (response) {
          // 4. Verify Payment Tokens via Edge Function
          showModal('loading', 'Verifying Payment', 'Please wait while we confirm your payment...');

          try {
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-razorpay-payment', {
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                order_number: orderNumber
              }
            });

            if (!verifyError && verifyData && verifyData.verified) {
              // Clear cart on success
              localStorage.removeItem('ao_cart');
              showModal('success', 'Payment Successful!', `Your order ${orderNumber} has been confirmed. Please click below to send the delivery details to our WhatsApp.`);

              // Construct WhatsApp message
              const address = orderData.shipping_address;
              const waText = `*New Order Confirmed!* 🎊
*Order No:* ${orderNumber}
*Total Paid:* ₹${totalAmount}

*Customer Details:*
Name: ${orderData.customer_name}
Phone: ${orderData.customer_phone}
Email: ${orderData.customer_email}

*Delivery Address:*
${address.house}, ${address.street}
${address.city}, ${address.district}
${address.state} - ${address.pin}
Country: ${address.country}
${address.instructions ? `\n*Instructions:* ${address.instructions}` : ''}`;

              const waUrl = `https://wa.me/918590529249?text=${encodeURIComponent(waText)}`;

              modalCloseBtn.textContent = 'Send via WhatsApp';
              modalCloseBtn.onclick = () => {
                window.open(waUrl, '_blank'); // Opens WhatsApp in a new tab without redirecting the page
                window.location.href = 'index.html'; // Optional: send user back to shop
              };
            } else {
              throw new Error('Signature verification failed.');
            }
          } catch (err) {
            console.error(err);
            showModal('error', 'Verification Failed', 'Payment was processed but verification failed. Please contact support if amount was deducted.');
          }
        },
        prefill: {
          name: orderData.customer_name,
          email: orderData.customer_email,
          contact: orderData.customer_phone
        },
        theme: {
          color: '#9e6a68' // Brand charcol color
        },
        modal: {
          ondismiss: function () {
            showModal('error', 'Payment Cancelled', 'You cancelled the payment. Your order has been saved but remains unpaid.');
          }
        }
      };

      // Open Razorpay Popup
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        showModal('error', 'Payment Failed', response.error.description);
      });
      rzp.open();

    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
    } finally {
      payBtn.disabled = false;
      paySpinner.style.display = 'none';
    }
  });

});